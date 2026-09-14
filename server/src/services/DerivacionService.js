class DerivacionService {
  // db es el cliente de Supabase autenticado con el JWT del usuario (respeta RLS).
  // Cada método lo recibe como parámetro porque depende de la request.

  async crear(db, profesionalOrigenId, body) {
    if (body.profesional_destino_id === profesionalOrigenId) {
      const err = new Error('No podés derivar al mismo profesional');
      err.status = 422;
      throw err;
    }

    const { data: destino } = await db
      .from('profesionales')
      .select('id, activo')
      .eq('id', body.profesional_destino_id)
      .single();

    if (!destino || !destino.activo) {
      const err = new Error('El profesional destinatario no existe o está inactivo');
      err.status = 422;
      throw err;
    }

    const { data, error } = await db
      .from('derivaciones')
      .insert({
        paciente_id: body.paciente_id,
        profesional_origen_id: profesionalOrigenId,
        profesional_destino_id: body.profesional_destino_id,
        motivo: body.motivo,
        observaciones: body.observaciones
      })
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido),
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
        destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async responder(db, id, profesionalId, body) {
    // Verificar que el profesional destino es quien responde
    const { data: derivacion } = await db
      .from('derivaciones')
      .select('profesional_destino_id, estado')
      .eq('id', id)
      .single();

    if (!derivacion) {
      const err = new Error('Derivación no encontrada');
      err.status = 404;
      throw err;
    }
    if (derivacion.profesional_destino_id !== profesionalId) {
      const err = new Error('Solo el profesional destinatario puede responder');
      err.status = 403;
      throw err;
    }
    if (derivacion.estado !== 'pendiente') {
      const err = new Error('Esta derivación ya fue respondida');
      err.status = 409;
      throw err;
    }

    const { data, error } = await db
      .from('derivaciones')
      .update({
        estado: body.estado,
        observaciones: body.observaciones,
        fecha_respuesta: new Date().toISOString(),
        activa: body.estado === 'aceptada'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async completar(db, id, profesionalId) {
    // Cierra el acceso del destino al paciente: cualquiera de las dos partes
    // puede marcarla completada (ej: terminó el tratamiento derivado).
    const { data: derivacion } = await db
      .from('derivaciones')
      .select('profesional_origen_id, profesional_destino_id, estado, activa')
      .eq('id', id)
      .single();

    if (!derivacion) {
      const err = new Error('Derivación no encontrada');
      err.status = 404;
      throw err;
    }
    if (derivacion.profesional_origen_id !== profesionalId && derivacion.profesional_destino_id !== profesionalId) {
      const err = new Error('No tenés permiso sobre esta derivación');
      err.status = 403;
      throw err;
    }
    if (derivacion.estado !== 'aceptada' || !derivacion.activa) {
      const err = new Error('Solo se puede completar una derivación aceptada y activa');
      err.status = 409;
      throw err;
    }

    const { data, error } = await db
      .from('derivaciones')
      .update({ estado: 'completada', activa: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async listar(db, profesionalId) {
    const { data, error } = await db
      .from('derivaciones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni),
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
        destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
      `)
      .or(`profesional_origen_id.eq.${profesionalId},profesional_destino_id.eq.${profesionalId}`)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async listarPendientes(db, profesionalId) {
    const { data, error } = await db
      .from('derivaciones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento),
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad)
      `)
      .eq('profesional_destino_id', profesionalId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new DerivacionService();
