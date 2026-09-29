const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth, getAuthenticatedClient } = require('../middleware/auth');
const turnoService = require('../services/TurnoService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// GET /turnos?fecha_inicio=&fecha_fin=&profesional_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await turnoService.listar(getAuthenticatedClient(req), req.query, req.profesional.id, { incluirSesiones: true });
    res.json(data);
  } catch (err) {
    manejarError(res, err);
  }
});

// POST /turnos
router.post('/',
  requireAuth,
  [
    body('fecha_inicio').isISO8601(),
    body('fecha_fin').isISO8601(),
    body('profesional_id').isUUID(),
    body('paciente_id').optional().isUUID(),
    body('tipo').optional().isIn(['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria']),
    body('consultorio').optional().isInt({ min: 1, max: 3 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await turnoService.crear(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.status(201).json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// PATCH /turnos/:id
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('fecha_inicio').optional().isISO8601(),
    body('fecha_fin').optional().isISO8601(),
    body('estado').optional().isIn(['programado', 'confirmado', 'cancelado', 'ausente', 'realizado']),
    body('tipo').optional().isIn(['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria']),
    body('paciente_id').optional().isUUID(),
    body('profesional_id').optional().isUUID(),
    body('consultorio').optional().isInt({ min: 1, max: 3 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await turnoService.actualizar(getAuthenticatedClient(req), req.params.id, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// DELETE /turnos/:id - cancelar
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await turnoService.cancelar(getAuthenticatedClient(req), req.params.id);
    res.json({ message: 'Turno cancelado' });
  } catch (err) {
    manejarError(res, err);
  }
});

module.exports = router;
