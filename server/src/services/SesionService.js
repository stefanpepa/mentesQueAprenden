const { supabaseAdmin } = require('../config/supabase');

const CAMPOS_EDITABLES = ['notas_libres', 'notas_estructuradas', 'resumen_ia', 'monto', 'pagado', 'fecha_pago', 'metodo_pago'];

class SesionService {
  async obtener(db, id, profesionalId, req) {
    const { data, error } = await db
      .from('sesiones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad)
      `)
      .eq('id', id)
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }

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

  async crear(db, profesionalId, body) {
    const { data, error } = await db
      .from('sesiones')
      .insert({
        ...body,
        profesional_id: profesionalId,
        created_by: profesionalId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async actualizar(db, id, body) {
    // Allowlist explícita: solo campos que el profesional puede editar post-creación
    const updateData = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    const { data, error } = await db
      .from('sesiones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
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
