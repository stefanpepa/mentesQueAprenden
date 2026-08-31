const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { getAuthenticatedClient } = require('../middleware/auth');
const { generarInformeTexto } = require('../services/informeGenerator');

const router = express.Router();

// GET /evaluaciones/:id — detalle completo con sus pruebas aplicadas
router.get('/:id',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('evaluaciones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento, genero),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad, matricula),
        pruebas:pruebas_aplicadas(id, nombre_prueba, resultados, observaciones, orden)
      `)
      .eq('id', req.params.id)
      .order('orden', { referencedTable: 'pruebas_aplicadas', ascending: true })
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// POST /evaluaciones — crear el borrador de una evaluación
router.post('/',
  requireAuth,
  [
    body('paciente_id').isUUID(),
    body('fecha_evaluacion').isISO8601(),
    body('motivo_consulta').optional().isString(),
    body('antecedentes').optional().isString(),
    body('observacion_conducta').optional().isString(),
    body('conclusiones').optional().isString(),
    body('sugerencias').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const CAMPOS = ['paciente_id', 'fecha_evaluacion', 'motivo_consulta', 'antecedentes', 'observacion_conducta', 'conclusiones', 'sugerencias'];
    const payload = Object.fromEntries(Object.entries(req.body).filter(([k]) => CAMPOS.includes(k)));

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('evaluaciones')
      .insert({
        ...payload,
        profesional_id: req.profesional.id,
        created_by: req.profesional.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  }
);

// PATCH /evaluaciones/:id — editar el contenido del informe
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('fecha_evaluacion').optional().isISO8601(),
    body('motivo_consulta').optional().isString(),
    body('antecedentes').optional().isString(),
    body('observacion_conducta').optional().isString(),
    body('conclusiones').optional().isString(),
    body('sugerencias').optional().isString(),
    body('estado').optional().isIn(['borrador', 'finalizado'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const CAMPOS = ['fecha_evaluacion', 'motivo_consulta', 'antecedentes', 'observacion_conducta', 'conclusiones', 'sugerencias', 'estado'];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([k]) => CAMPOS.includes(k)));

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('evaluaciones')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// GET /evaluaciones/paciente/:pacienteId — listado de evaluaciones de un paciente
router.get('/paciente/:pacienteId',
  requireAuth,
  [param('pacienteId').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('evaluaciones')
      .select('id, fecha_evaluacion, estado, motivo_consulta, created_at')
      .eq('paciente_id', req.params.pacienteId)
      .order('fecha_evaluacion', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

// POST /evaluaciones/:id/pruebas — agregar una prueba aplicada (nombre + texto libre)
router.post('/:id/pruebas',
  requireAuth,
  [
    param('id').isUUID(),
    body('nombre_prueba').trim().notEmpty().isLength({ max: 150 }),
    body('resultados_texto').optional().isString(),
    body('observaciones').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);

    const { count } = await db
      .from('pruebas_aplicadas')
      .select('id', { count: 'exact', head: true })
      .eq('evaluacion_id', req.params.id);

    const { data, error } = await db
      .from('pruebas_aplicadas')
      .insert({
        evaluacion_id: req.params.id,
        nombre_prueba: req.body.nombre_prueba,
        resultados: { texto: req.body.resultados_texto || '' },
        observaciones: req.body.observaciones,
        orden: count || 0
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  }
);

// PATCH /evaluaciones/pruebas/:pruebaId — editar una prueba aplicada
router.patch('/pruebas/:pruebaId',
  requireAuth,
  [
    param('pruebaId').isUUID(),
    body('nombre_prueba').optional().trim().notEmpty().isLength({ max: 150 }),
    body('resultados_texto').optional().isString(),
    body('observaciones').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const updateData = {};
    if (req.body.nombre_prueba !== undefined) updateData.nombre_prueba = req.body.nombre_prueba;
    if (req.body.observaciones !== undefined) updateData.observaciones = req.body.observaciones;
    if (req.body.resultados_texto !== undefined) updateData.resultados = { texto: req.body.resultados_texto };

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('pruebas_aplicadas')
      .update(updateData)
      .eq('id', req.params.pruebaId)
      .select()
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// DELETE /evaluaciones/pruebas/:pruebaId
router.delete('/pruebas/:pruebaId',
  requireAuth,
  [param('pruebaId').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { error } = await db.from('pruebas_aplicadas').delete().eq('id', req.params.pruebaId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Prueba eliminada' });
  }
);

// POST /evaluaciones/:id/generar-informe — la IA redacta el informe completo
router.post('/:id/generar-informe',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data: evaluacion, error: evalErr } = await db
      .from('evaluaciones')
      .select(`
        *,
        paciente:pacientes(nombre, apellido, dni, fecha_nacimiento, genero),
        profesional:profesionales!profesional_id(nombre, apellido, especialidad, matricula),
        pruebas:pruebas_aplicadas(nombre_prueba, resultados, observaciones, orden)
      `)
      .eq('id', req.params.id)
      .single();

    if (evalErr || !evaluacion) return res.status(404).json({ error: 'Evaluación no encontrada' });

    try {
      const informe = await generarInformeTexto(evaluacion);

      const { data, error } = await db
        .from('evaluaciones')
        .update({ informe_generado: informe })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      res.json(data);
    } catch (err) {
      console.error('Error al generar informe:', err.message);
      res.status(502).json({ error: 'Error al generar el informe con IA' });
    }
  }
);

module.exports = router;
