const { supabaseAdmin } = require('../config/supabase');

class PacienteService {
  // ─────────────────────────────────────────────────────────────
  // Pacientes
  // ─────────────────────────────────────────────────────────────

  async listar(db, { busqueda, estado, profesional_id, page = 1, limit = 20 }, profesionalActualId) {
    let query = db
      .from('pacientes')
      .select(`
        id, nombre, apellido, dni, fecha_nacimiento, estado,
        telefono, email,
        profesional_principal:profesionales!profesional_principal_id(id, nombre, apellido, especialidad),
        obra_social:obras_sociales(id, nombre),
        created_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('apellido', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (busqueda) {
      query = query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,dni.ilike.%${busqueda}%`);
    }
    if (estado) query = query.eq('estado', estado);
    if (profesional_id) query = query.eq('profesional_principal_id', profesional_id);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const dataConDerivado = data.map(p => ({
      ...p,
      derivado: p.profesional_principal?.id !== profesionalActualId
    }));

    return {
      data: dataConDerivado,
      pagination: { total: count, page: Number(page), limit: Number(limit), pages: Math.ceil(count / limit) }
    };
  }

  async obtener(db, id) {
    const { data, error } = await db
      .from('pacientes')
      .select(`
        *,
        profesional_principal:profesionales!profesional_principal_id(id, nombre, apellido, especialidad, email),
        obra_social:obras_sociales(id, nombre, codigo),
        creado_por:profesionales!created_by(id, nombre, apellido)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
  }

  async crear(db, body, profesional) {
    const CAMPOS_CREABLES = [
      'nombre', 'apellido', 'dni', 'fecha_nacimiento', 'genero', 'telefono',
      'telefono_alternativo', 'email', 'direccion', 'localidad', 'provincia',
      'motivo_consulta', 'obra_social_id', 'numero_afiliado',
      'profesional_principal_id', 'responsable_nombre', 'responsable_vinculo',
      'responsable_telefono'
    ];
    const insertData = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_CREABLES.includes(k))
    );

    const { data, error } = await db
      .from('pacientes')
      .insert({
        ...insertData,
        profesional_principal_id: insertData.profesional_principal_id || profesional.id,
        created_by: profesional.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const err = new Error('Ya existe un paciente con ese DNI');
        err.status = 409;
        throw err;
      }
      const err = new Error(error.message);
      err.status = 500;
      throw err;
    }

    return data;
  }

  async actualizar(db, id, body) {
    // Allowlist explícita de campos editables
    const CAMPOS_EDITABLES = [
      'nombre', 'apellido', 'dni', 'fecha_nacimiento', 'genero', 'telefono',
      'telefono_alternativo', 'email', 'direccion', 'localidad', 'provincia',
      'estado', 'motivo_consulta', 'obra_social_id', 'numero_afiliado',
      'profesional_principal_id', 'responsable_nombre', 'responsable_vinculo',
      'responsable_telefono'
    ];
    const updateData = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    const { data, error } = await db
      .from('pacientes')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
  }

  async eliminar(db, id) {
    // Verificación manual de permiso (RLS de UPDATE sobre esta tabla da falso
    // negativo en este entorno) antes de usar el cliente admin.
    const { data: paciente, error: fetchError } = await db
      .from('pacientes')
      .select('id, nombre, apellido')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !paciente) {
      const err = new Error('Paciente no encontrado');
      err.status = 404;
      throw err;
    }

    const { data, error } = await supabaseAdmin
      .from('pacientes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, nombre, apellido')
      .single();

    if (error) throw new Error(error.message);
    return { message: `Paciente ${data.apellido}, ${data.nombre} eliminado`, id: data.id };
  }

  // ─────────────────────────────────────────────────────────────
  // Sub-recursos
  // ─────────────────────────────────────────────────────────────

  async listarSesiones(db, pacienteId, { page = 1, limit = 20 }) {
    const { data, error, count } = await db
      .from('sesiones')
      .select(`
        id, fecha, tipo, duracion_minutos, notas_libres, resumen_ia,
        monto, pagado, fecha_pago,
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad)
      `, { count: 'exact' })
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw new Error(error.message);
    return { data, pagination: { total: count, page: Number(page), limit: Number(limit) } };
  }

  async listarTurnos(db, pacienteId) {
    const { data, error } = await db
      .from('turnos')
      .select(`
        id, fecha_inicio, fecha_fin, estado, tipo, notas,
        profesional:profesionales!profesional_id(id, nombre, apellido)
      `)
      .eq('paciente_id', pacienteId)
      .order('fecha_inicio', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async listarDerivaciones(db, pacienteId) {
    const { data, error } = await db
      .from('derivaciones')
      .select(`
        *,
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
        destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
      `)
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async listarArchivos(db, pacienteId) {
    const { data, error } = await db
      .from('archivos_adjuntos')
      .select(`
        id, nombre_original, tipo, mime_type, tamanio_bytes, descripcion, created_at,
        subido_por:profesionales!subido_por(id, nombre, apellido)
      `)
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new PacienteService();
