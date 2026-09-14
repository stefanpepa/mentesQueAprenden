const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth, getAuthenticatedClient } = require('../middleware/auth');
const evaluacionService = require('../services/EvaluacionService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// GET /evaluaciones/:id — detalle completo con sus pruebas aplicadas
router.get('/:id',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await evaluacionService.obtener(getAuthenticatedClient(req), req.params.id);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
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

    try {
      const data = await evaluacionService.crear(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.status(201).json(data);
    } catch (err) {
      manejarError(res, err);
    }
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

    try {
      const data = await evaluacionService.actualizar(getAuthenticatedClient(req), req.params.id, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// GET /evaluaciones/paciente/:pacienteId — listado de evaluaciones de un paciente
router.get('/paciente/:pacienteId',
  requireAuth,
  [param('pacienteId').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await evaluacionService.listarPorPaciente(getAuthenticatedClient(req), req.params.pacienteId);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
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

    try {
      const data = await evaluacionService.agregarPrueba(getAuthenticatedClient(req), req.params.id, req.body);
      res.status(201).json(data);
    } catch (err) {
      manejarError(res, err);
    }
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

    try {
      const data = await evaluacionService.actualizarPrueba(getAuthenticatedClient(req), req.params.pruebaId, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// DELETE /evaluaciones/pruebas/:pruebaId
router.delete('/pruebas/:pruebaId',
  requireAuth,
  [param('pruebaId').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      await evaluacionService.eliminarPrueba(getAuthenticatedClient(req), req.params.pruebaId);
      res.json({ message: 'Prueba eliminada' });
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// POST /evaluaciones/:id/generar-informe — la IA redacta el informe completo
router.post('/:id/generar-informe',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await evaluacionService.generarInforme(getAuthenticatedClient(req), req.params.id);
      res.json(data);
    } catch (err) {
      console.error('Error al generar informe:', err.message);
      manejarError(res, err, { status: 502, message: 'Error al generar el informe con IA' });
    }
  }
);

module.exports = router;
