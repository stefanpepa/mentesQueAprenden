const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth, getAuthenticatedClient } = require('../middleware/auth');
const sesionService = require('../services/SesionService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// GET /sesiones/:id
router.get('/:id',
  requireAuth,
  async (req, res) => {
    try {
      const data = await sesionService.obtener(getAuthenticatedClient(req), req.params.id, req.profesional.id, req);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// POST /sesiones
router.post('/',
  requireAuth,
  [
    body('paciente_id').isUUID(),
    body('fecha').isISO8601(),
    body('tipo').isIn(['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria']),
    body('duracion_minutos').optional().isInt({ min: 1, max: 480 }),
    body('notas_libres').optional().isString(),
    body('notas_estructuradas').optional().isObject(),
    body('monto').optional().isFloat({ min: 0 }),
    body('turno_id').optional().isUUID(),
    body('consultorio').optional({ nullable: true }).isInt({ min: 1, max: 3 }).toInt()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await sesionService.crear(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.status(201).json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// PATCH /sesiones/:id
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('fecha').optional().isISO8601(),
    body('tipo').optional().isIn(['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria']),
    body('duracion_minutos').optional().isInt({ min: 1, max: 480 }),
    body('consultorio').optional({ nullable: true }).isInt({ min: 1, max: 3 }).toInt(),
    body('notas_libres').optional().isString(),
    body('notas_estructuradas').optional().isObject(),
    body('resumen_ia').optional().isString(),
    body('monto').optional({ nullable: true }).isFloat({ min: 0 }),
    body('pagado').optional().isBoolean(),
    body('fecha_pago').optional().isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await sesionService.actualizar(getAuthenticatedClient(req), req.params.id, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// GET /sesiones/:id/versiones
router.get('/:id/versiones',
  requireAuth,
  async (req, res) => {
    try {
      const data = await sesionService.listarVersiones(getAuthenticatedClient(req), req.params.id);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

module.exports = router;
