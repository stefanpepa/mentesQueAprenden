class TurnoService {
  // Trae los turnos propios (o accesibles por derivación) con todos los
  // datos, y los de otros profesionales reducidos a "consultorio ocupado"
  // sin paciente ni notas — así se puede armar un calendario compartido
  // sin filtrar datos clínicos ajenos.
  async listar(db, { fecha_inicio, fecha_fin, profesional_id }, profesionalActualId) {
    let q = db
      .from('turnos')
      .select(`
        id, fecha_inicio, fecha_fin, estado, tipo, notas, consultorio, recordatorio_enviado,
        paciente_id,
        paciente:pacientes(id, nombre, apellido, telefono),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad),
        sesion:sesiones(id)
      `)
      .neq('estado', 'cancelado')
      .order('fecha_inicio', { ascending: true });

    if (fecha_inicio) q = q.gte('fecha_inicio', fecha_inicio);
    if (fecha_fin) q = q.lte('fecha_inicio', fecha_fin);
    if (profesional_id) q = q.eq('profesional_id', profesional_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return data.map(t => {
      const esPropio = t.profesional?.id === profesionalActualId;
      if (esPropio) return t;
      // Turno ajeno: solo señal de ocupación del consultorio, sin datos clínicos.
      return {
        id: t.id,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        estado: t.estado,
        consultorio: t.consultorio,
        ocupado: true,
        profesional: t.profesional ? { id: t.profesional.id, nombre: t.profesional.nombre, apellido: t.profesional.apellido } : null
      };
    });
  }

  async crear(db, profesionalId, body) {
    const { data, error } = await db
      .from('turnos')
      .insert({ ...body, created_by: profesionalId })
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, telefono),
        profesional:profesionales!profesional_id(id, nombre, apellido)
      `)
      .single();

    if (error) {
      if (error.code === '23P01') {
        const err = new Error(error.message);
        err.status = 409;
        throw err;
      }
      throw new Error(error.message);
    }
    return data;
  }

  async actualizar(db, id, body) {
    const { created_by, created_at, id: _id, ...updateData } = body;

    const { data, error } = await db
      .from('turnos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const err = new Error(error.code === '23P01' ? error.message : 'Error al actualizar el turno');
      err.status = error.code === 'PGRST116' ? 404 : error.code === '23P01' ? 409 : 500;
      throw err;
    }
    return data;
  }

  async cancelar(db, id) {
    const { error } = await db
      .from('turnos')
      .update({ estado: 'cancelado' })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}

module.exports = new TurnoService();
