const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth, getAuthenticatedClient } = require('../middleware/auth');
const derivacionService = require('../services/DerivacionService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// POST /derivaciones
router.post('/',
  requireAuth,
  [
    body('paciente_id').isUUID(),
    body('profesional_destino_id').isUUID(),
    body('motivo').trim().notEmpty().isLength({ max: 1000 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await derivacionService.crear(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.status(201).json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// PATCH /derivaciones/:id/responder
router.patch('/:id/responder',
  requireAuth,
  [
    param('id').isUUID(),
    body('estado').isIn(['aceptada', 'rechazada']),
    body('observaciones').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await derivacionService.responder(getAuthenticatedClient(req), req.params.id, req.profesional.id, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// PATCH /derivaciones/:id/completar
router.patch('/:id/completar',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await derivacionService.completar(getAuthenticatedClient(req), req.params.id, req.profesional.id);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// GET /derivaciones - todas las del profesional (enviadas + recibidas)
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await derivacionService.listar(getAuthenticatedClient(req), req.profesional.id);
    res.json(data);
  } catch (err) {
    manejarError(res, err);
  }
});

// GET /derivaciones/pendientes - Derivaciones recibidas pendientes
router.get('/pendientes',
  requireAuth,
  async (req, res) => {
    try {
      const data = await derivacionService.listarPendientes(getAuthenticatedClient(req), req.profesional.id);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

module.exports = router;
