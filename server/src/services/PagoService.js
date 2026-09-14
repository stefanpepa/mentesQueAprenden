const { supabaseAdmin } = require('../config/supabase');

function rangoDelMes(mes) {
  const inicio = `${mes}-01T00:00:00-03:00`;
  const fin = new Date(`${mes}-01T00:00:00-03:00`);
  fin.setMonth(fin.getMonth() + 1);
  return { inicio, fin: fin.toISOString() };
}

class PagoService {
  async listar(db, { mes, profesional_id }) {
    let q = db
      .from('pagos')
      .select(`
        *,
        sesion:sesiones(id, fecha, tipo),
        paciente:pacientes(id, nombre, apellido),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad)
      `)
      .order('fecha_pago', { ascending: false });

    if (mes) {
      const { inicio, fin } = rangoDelMes(mes);
      q = q.gte('fecha_pago', inicio).lt('fecha_pago', fin);
    }
    if (profesional_id) q = q.eq('profesional_id', profesional_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async listarSesionesPendientes(db) {
    const { data, error } = await db
      .from('sesiones')
      .select(`
        id, fecha, tipo, monto, duracion_minutos,
        paciente:pacientes(id, nombre, apellido),
        profesional:profesionales!profesional_id(id, nombre, apellido)
      `)
      .eq('pagado', false)
      .not('monto', 'is', null)
      .order('fecha', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async crear(db, profesionalId, { sesion_id, monto_total, metodo_pago, numero_comprobante }) {
    const { data: sesion, error: sesErr } = await supabaseAdmin
      .from('sesiones')
      .select('*, profesional:profesionales!profesional_id(porcentaje_honorarios)')
      .eq('id', sesion_id)
      .single();

    if (sesErr || !sesion) {
      const err = new Error('Sesión no encontrada');
      err.status = 404;
      throw err;
    }
    if (sesion.pagado) {
      const err = new Error('Esta sesión ya fue pagada');
      err.status = 409;
      throw err;
    }

    const porcentaje = sesion.profesional.porcentaje_honorarios || 70;
    const monto_profesional = (monto_total * porcentaje) / 100;
    const monto_espacio = monto_total - monto_profesional;

    const { data: pago, error: pagoErr } = await db
      .from('pagos')
      .insert({
        sesion_id,
        paciente_id: sesion.paciente_id,
        profesional_id: sesion.profesional_id,
        monto_total,
        monto_profesional,
        monto_espacio,
        porcentaje_profesional: porcentaje,
        metodo_pago,
        numero_comprobante,
        registrado_por: profesionalId
      })
      .select()
      .single();

    if (pagoErr) throw new Error(pagoErr.message);

    await supabaseAdmin
      .from('sesiones')
      .update({ pagado: true, fecha_pago: new Date().toISOString(), metodo_pago })
      .eq('id', sesion_id);

    return pago;
  }

  async liquidacion(mes) {
    const { inicio, fin } = rangoDelMes(mes);

    const { data, error } = await supabaseAdmin
      .from('pagos')
      .select(`
        profesional_id,
        monto_total, monto_profesional, monto_espacio,
        profesional:profesionales!profesional_id(nombre, apellido, especialidad)
      `)
      .gte('fecha_pago', inicio)
      .lt('fecha_pago', fin);

    if (error) throw new Error(error.message);

    const resumen = data.reduce((acc, p) => {
      const key = p.profesional_id;
      if (!acc[key]) {
        acc[key] = {
          profesional: p.profesional,
          total_facturado: 0,
          total_profesional: 0,
          total_espacio: 0,
          cantidad_sesiones: 0
        };
      }
      acc[key].total_facturado += Number(p.monto_total);
      acc[key].total_profesional += Number(p.monto_profesional);
      acc[key].total_espacio += Number(p.monto_espacio);
      acc[key].cantidad_sesiones++;
      return acc;
    }, {});

    return {
      mes,
      profesionales: Object.values(resumen),
      total_espacio: Object.values(resumen).reduce((s, p) => s + p.total_espacio, 0),
      total_facturado: Object.values(resumen).reduce((s, p) => s + p.total_facturado, 0)
    };
  }
}

module.exports = new PagoService();
