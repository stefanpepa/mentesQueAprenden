const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const profesionalService = require('../services/ProfesionalService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// GET /profesionales - Lista todos los profesionales activos
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await profesionalService.listar();
    res.json(data);
  } catch (err) {
    manejarError(res, err);
  }
});

// PATCH /profesionales/:id - Actualizar datos propios o admin
router.patch('/:id',
  requireAuth,
  [
    body('telefono').optional().trim(),
    body('porcentaje_honorarios').optional().isFloat({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await profesionalService.actualizar(req.params.id, req.profesional, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// DELETE (desactivar) /profesionales/:id - Solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await profesionalService.desactivar(req.params.id);
    res.json({ message: 'Profesional desactivado' });
  } catch (err) {
    manejarError(res, err);
  }
});

module.exports = router;
