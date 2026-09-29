const { supabaseAdmin } = require('../config/supabase');

// Un turno de una sesión futura todavía no ocurrió.
const estadoSegunFecha = (fecha) => (new Date(fecha) > new Date() ? 'confirmado' : 'realizado');

function errorDeTurno(error) {
  const choque = error.code === '23P01';
  const err = new Error(choque
    ? `${error.message}. No se guardaron los cambios: elegí otro horario u otro consultorio.`
    : 'No se pudo actualizar el turno de la agenda');
  err.status = choque ? 409 : 500;
  return err;
}

const CAMPOS_EDITABLES = ['fecha', 'tipo', 'duracion_minutos', 'notas_libres', 'notas_estructuradas', 'resumen_ia', 'monto', 'pagado', 'fecha_pago', 'metodo_pago'];

class SesionService {
  async obtener(db, id, profesionalId, req) {
    const { data, error } = await db
      .from('sesiones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad),
        turnos(id, consultorio, estado)
      `)
      .eq('id', id)
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }

    // El consultorio de la sesión es el de su turno activo (si tiene).
    const turno = (data.turnos || []).find(t => t.estado !== 'cancelado');
    data.consultorio = turno?.consultorio ?? null;
    data.turno_id = turno?.id ?? null;
    delete data.turnos;

    if (data?.paciente_id) {
      supabaseAdmin.from('logs_acceso').insert({
        profesional_id: profesionalId,
        paciente_id: data.paciente_id,
        accion: 'ver',
        recurso: 'sesion',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    return data;
  }

  // Sesiones registradas por el profesional, de la más reciente a la más vieja.
  async listarDelProfesional(db, profesionalId, { paciente_id, hasta, limit = 20 } = {}) {
    let q = db
      .from('sesiones')
      .select('id, fecha, tipo, duracion_minutos, pagado, paciente:pacientes(id, nombre, apellido)')
      .eq('profesional_id', profesionalId)
      .order('fecha', { ascending: false })
      .limit(limit);

    if (paciente_id) q = q.eq('paciente_id', paciente_id);
    if (hasta) q = q.lte('fecha', hasta);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async crear(db, profesionalId, body) {
    // turno_id y consultorio no son columnas de "sesiones": el consultorio se
    // reserva a través del turno vinculado (turnos.sesion_id), que es lo que
    // usan la agenda y el control de choques de la base.
    const { turno_id, consultorio, ...datosSesion } = body;
    const inicio = new Date(datosSesion.fecha);
    const fin = new Date(inicio.getTime() + (datosSesion.duracion_minutos || 50) * 60000);

    if (consultorio) await this.verificarConsultorioLibre(db, consultorio, inicio, fin, turno_id);

    const { data, error } = await db
      .from('sesiones')
      .insert({
        ...datosSesion,
        profesional_id: profesionalId,
        created_by: profesionalId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    try {
      if (turno_id) {
        // El turno de origen queda con los datos con que se registró la sesión.
        await this.actualizarTurno(db, turno_id, consultorio === null
          ? { sesion_id: data.id, estado: 'cancelado' }
          : {
              sesion_id: data.id,
              estado: estadoSegunFecha(inicio),
              fecha_inicio: inicio.toISOString(),
              fecha_fin: fin.toISOString(),
              tipo: data.tipo,
              ...(consultorio && { consultorio })
            });
      } else if (consultorio) {
        await this.crearTurnoParaSesion(db, data, consultorio, inicio, fin);
      }
    } catch (err) {
      // Sin turno la sesión quedaría sin el consultorio que se pidió: se deshace.
      await supabaseAdmin.from('sesiones').delete().eq('id', data.id);
      throw err;
    }

    return data;
  }

  async actualizar(db, id, body) {
    // Allowlist explícita: solo campos que el profesional puede editar post-creación
    const updateData = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    // El turno se sincroniza ANTES que la sesión: si no se puede mover
    // (consultorio ocupado), se aborta todo en vez de dejar la sesión y la
    // agenda mostrando datos distintos.
    if (['fecha', 'duracion_minutos', 'tipo'].some(k => k in updateData) || 'consultorio' in body) {
      await this.sincronizarTurno(db, id, updateData, body.consultorio);
    }

    const consulta = Object.keys(updateData).length
      ? db.from('sesiones').update(updateData).eq('id', id).select().single()
      : db.from('sesiones').select().eq('id', id).single();
    const { data, error } = await consulta;

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
  }

  // El turno vinculado guarda su propia copia de fecha, duración, tipo y
  // consultorio; si no se actualiza junto con la sesión, la agenda y las
  // barras de consultorios siguen mostrando los datos viejos.
  // consultorioNuevo: undefined = no cambia, null = sin consultorio, 1-3.
  async sincronizarTurno(db, id, cambios, consultorioNuevo) {
    const { data: previa, error } = await db
      .from('sesiones')
      .select('id, fecha, duracion_minutos, tipo, paciente_id, profesional_id')
      .eq('id', id)
      .single();

    if (error) {
      const err = new Error(error.code === 'PGRST116' ? 'Sesión no encontrada' : error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }

    const inicioNuevo = cambios.fecha ? new Date(cambios.fecha) : new Date(previa.fecha);
    const duracion = Number(cambios.duracion_minutos ?? previa.duracion_minutos ?? 50);
    const cambiaFecha = inicioNuevo.getTime() !== new Date(previa.fecha).getTime();
    const cambiaDuracion = duracion !== previa.duracion_minutos;
    const cambiaTipo = cambios.tipo && cambios.tipo !== previa.tipo;

    const { turno, recienVinculado } = await this.buscarTurnoVinculado(db, id, previa);
    const cambiaConsultorio = consultorioNuevo !== undefined && consultorioNuevo !== (turno?.consultorio ?? null);
    if (!cambiaFecha && !cambiaDuracion && !cambiaTipo && !cambiaConsultorio) return;

    if (!turno) {
      if (consultorioNuevo) {
        const fin = new Date(inicioNuevo.getTime() + duracion * 60000);
        await this.crearTurnoParaSesion(db, { ...previa, tipo: cambios.tipo ?? previa.tipo }, consultorioNuevo, inicioNuevo, fin);
      }
      return;
    }

    if (consultorioNuevo === null) {
      // "Sin consultorio": la sesión deja de reservar sala.
      await this.actualizarTurno(db, turno.id, { sesion_id: id, estado: 'cancelado' });
      return;
    }

    const actualizacion = recienVinculado ? { sesion_id: id, estado: estadoSegunFecha(inicioNuevo) } : {};
    if (cambiaFecha || cambiaDuracion) {
      const inicio = cambiaFecha ? inicioNuevo : new Date(turno.fecha_inicio);
      actualizacion.fecha_inicio = inicio.toISOString();
      actualizacion.fecha_fin = new Date(inicio.getTime() + duracion * 60000).toISOString();
    }
    if (cambiaTipo) actualizacion.tipo = cambios.tipo;
    if (cambiaConsultorio) actualizacion.consultorio = consultorioNuevo;

    if (Object.keys(actualizacion).length) await this.actualizarTurno(db, turno.id, actualizacion);
  }

  async crearTurnoParaSesion(db, sesion, consultorio, inicio, fin) {
    const { error } = await db.from('turnos').insert({
      paciente_id: sesion.paciente_id,
      profesional_id: sesion.profesional_id,
      created_by: sesion.profesional_id,
      fecha_inicio: inicio.toISOString(),
      fecha_fin: fin.toISOString(),
      tipo: sesion.tipo,
      consultorio,
      estado: estadoSegunFecha(inicio),
      sesion_id: sesion.id
    });
    if (error) throw errorDeTurno(error);
  }

  async actualizarTurno(db, turnoId, cambios) {
    const { error } = await db.from('turnos').update(cambios).eq('id', turnoId);
    if (error) throw errorDeTurno(error);
  }

  // Chequeo previo a crear la sesión, para no insertarla si el consultorio
  // está tomado. La base igual lo impide (trigger), esto solo da el aviso antes.
  async verificarConsultorioLibre(db, consultorio, inicio, fin, excluirTurnoId) {
    let q = db
      .from('turnos')
      .select('id')
      .eq('consultorio', consultorio)
      .neq('estado', 'cancelado')
      .lt('fecha_inicio', fin.toISOString())
      .gt('fecha_fin', inicio.toISOString());
    if (excluirTurnoId) q = q.neq('id', excluirTurnoId);

    const { data } = await q.limit(1);
    if (data?.length) {
      const err = new Error(`Consultorio ${consultorio} ocupado en ese horario. Elegí otro horario u otro consultorio.`);
      err.status = 409;
      throw err;
    }
  }

  async buscarTurnoVinculado(db, id, previa) {
    const { data: vinculados } = await db
      .from('turnos')
      .select('id, fecha_inicio, consultorio')
      .eq('sesion_id', id)
      .neq('estado', 'cancelado')
      .limit(1);
    if (vinculados?.length) return { turno: vinculados[0], recienVinculado: false };

    // Sesiones creadas antes de que existiera el vínculo turno↔sesión nunca
    // quedaron conectadas a su turno. Si hay un único turno sin sesión, del
    // mismo paciente y profesional, a menos de 12 h de la fecha que tenía la
    // sesión, es el turno del que salió — se lo vincula. Con más de un
    // candidato no se adivina.
    const referencia = new Date(previa.fecha).getTime();
    const margen = 12 * 60 * 60 * 1000;
    const { data: candidatos } = await db
      .from('turnos')
      .select('id, fecha_inicio, consultorio')
      .is('sesion_id', null)
      .neq('estado', 'cancelado')
      .eq('paciente_id', previa.paciente_id)
      .eq('profesional_id', previa.profesional_id)
      .gte('fecha_inicio', new Date(referencia - margen).toISOString())
      .lte('fecha_inicio', new Date(referencia + margen).toISOString());

    return candidatos?.length === 1
      ? { turno: candidatos[0], recienVinculado: true }
      : { turno: null, recienVinculado: false };
  }

  async listarVersiones(db, sesionId) {
    const { data, error } = await db
      .from('versiones_notas')
      .select(`
        *,
        modificado_por:profesionales(id, nombre, apellido)
      `)
      .eq('sesion_id', sesionId)
      .order('modificado_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new SesionService();
