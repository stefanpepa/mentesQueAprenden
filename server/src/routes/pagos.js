const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin, getAuthenticatedClient } = require('../middleware/auth');
const pagoService = require('../services/PagoService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// GET /pagos?mes=2024-06&profesional_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await pagoService.listar(getAuthenticatedClient(req), req.query);
    res.json(data);
  } catch (err) {
    manejarError(res, err);
  }
});

// GET /pagos/sesiones-pendientes - sesiones sin pago registrado
router.get('/sesiones-pendientes', requireAuth, async (req, res) => {
  try {
    const data = await pagoService.listarSesionesPendientes(getAuthenticatedClient(req));
    res.json(data);
  } catch (err) {
    manejarError(res, err);
  }
});

// POST /pagos
router.post('/',
  requireAuth,
  [
    body('sesion_id').isUUID(),
    body('monto_total').isFloat({ min: 0.01 }),
    body('metodo_pago').isIn(['efectivo', 'transferencia', 'debito', 'credito', 'obra_social'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const pago = await pagoService.crear(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.status(201).json(pago);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// GET /pagos/liquidacion?mes=2024-06 - resumen por profesional (solo admin)
router.get('/liquidacion', requireAuth, requireAdmin, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(422).json({ error: 'Se requiere el parámetro mes (YYYY-MM)' });

  try {
    const resultado = await pagoService.liquidacion(mes);
    res.json(resultado);
  } catch (err) {
    manejarError(res, err);
  }
});

module.exports = router;
