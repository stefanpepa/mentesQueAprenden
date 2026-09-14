const { generarInformeTexto } = require('./informeGenerator');

const CAMPOS_EVALUACION = ['paciente_id', 'fecha_evaluacion', 'motivo_consulta', 'antecedentes', 'observacion_conducta', 'conclusiones', 'sugerencias'];
const CAMPOS_EVALUACION_UPDATE = [...CAMPOS_EVALUACION.filter(c => c !== 'paciente_id'), 'estado'];

class EvaluacionService {
  // db es el cliente de Supabase autenticado con el JWT del usuario (respeta RLS).
  // Cada método lo recibe como parámetro porque depende de la request.

  async obtener(db, id) {
    const { data, error } = await db
      .from('evaluaciones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento, genero),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad, matricula),
        pruebas:pruebas_aplicadas(id, nombre_prueba, resultados, observaciones, orden)
      `)
      .eq('id', id)
      .order('orden', { referencedTable: 'pruebas_aplicadas', ascending: true })
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
  }

  async crear(db, profesionalId, body) {
    const payload = Object.fromEntries(Object.entries(body).filter(([k]) => CAMPOS_EVALUACION.includes(k)));

    const { data, error } = await db
      .from('evaluaciones')
      .insert({
        ...payload,
        profesional_id: profesionalId,
        created_by: profesionalId
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async actualizar(db, id, body) {
    const updateData = Object.fromEntries(Object.entries(body).filter(([k]) => CAMPOS_EVALUACION_UPDATE.includes(k)));

    const { data, error } = await db
      .from('evaluaciones')
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

  async listarPorPaciente(db, pacienteId) {
    const { data, error } = await db
      .from('evaluaciones')
      .select('id, fecha_evaluacion, estado, motivo_consulta, created_at')
      .eq('paciente_id', pacienteId)
      .order('fecha_evaluacion', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async agregarPrueba(db, evaluacionId, { nombre_prueba, resultados_texto, observaciones }) {
    const { count } = await db
      .from('pruebas_aplicadas')
      .select('id', { count: 'exact', head: true })
      .eq('evaluacion_id', evaluacionId);

    const { data, error } = await db
      .from('pruebas_aplicadas')
      .insert({
        evaluacion_id: evaluacionId,
        nombre_prueba,
        resultados: { texto: resultados_texto || '' },
        observaciones,
        orden: count || 0
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async actualizarPrueba(db, pruebaId, body) {
    const updateData = {};
    if (body.nombre_prueba !== undefined) updateData.nombre_prueba = body.nombre_prueba;
    if (body.observaciones !== undefined) updateData.observaciones = body.observaciones;
    if (body.resultados_texto !== undefined) updateData.resultados = { texto: body.resultados_texto };

    const { data, error } = await db
      .from('pruebas_aplicadas')
      .update(updateData)
      .eq('id', pruebaId)
      .select()
      .single();

    if (error) {
      const err = new Error(error.message);
      err.status = error.code === 'PGRST116' ? 404 : 500;
      throw err;
    }
    return data;
  }

  async eliminarPrueba(db, pruebaId) {
    const { error } = await db.from('pruebas_aplicadas').delete().eq('id', pruebaId);
    if (error) throw new Error(error.message);
  }

  async generarInforme(db, id) {
    const { data: evaluacion, error: evalErr } = await db
      .from('evaluaciones')
      .select(`
        *,
        paciente:pacientes(nombre, apellido, dni, fecha_nacimiento, genero),
        profesional:profesionales!profesional_id(nombre, apellido, especialidad, matricula),
        pruebas:pruebas_aplicadas(nombre_prueba, resultados, observaciones, orden)
      `)
      .eq('id', id)
      .single();

    if (evalErr || !evaluacion) {
      const err = new Error('Evaluación no encontrada');
      err.status = 404;
      throw err;
    }

    const informe = await generarInformeTexto(evaluacion);

    const { data, error } = await db
      .from('evaluaciones')
      .update({ informe_generado: informe })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}

module.exports = new EvaluacionService();
