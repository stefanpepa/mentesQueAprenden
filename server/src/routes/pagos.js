const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getAuthenticatedClient } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

// GET /pagos?mes=2024-06&profesional_id=
router.get('/', requireAuth, async (req, res) => {
  const db = getAuthenticatedClient(req);
  const { mes, profesional_id } = req.query;

  let q = db
    .from('pagos')
    .select(`
      *,
      sesion:sesiones(id, fecha, tipo),
      paciente:pacientes(id, nombre, apellido),
      profesional:profesionales(id, nombre, apellido, especialidad)
    `)
    .order('fecha_pago', { ascending: false });

  if (mes) {
    const inicio = `${mes}-01`;
    const fin = new Date(mes + '-01');
    fin.setMonth(fin.getMonth() + 1);
    q = q.gte('fecha_pago', inicio).lt('fecha_pago', fin.toISOString().slice(0, 10));
  }
  if (profesional_id) q = q.eq('profesional_id', profesional_id);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /pagos/sesiones-pendientes - sesiones sin pago registrado
router.get('/sesiones-pendientes', requireAuth, async (req, res) => {
  const db = getAuthenticatedClient(req);

  const { data, error } = await db
    .from('sesiones')
    .select(`
      id, fecha, tipo, monto, duracion_minutos,
      paciente:pacientes(id, nombre, apellido),
      profesional:profesionales(id, nombre, apellido)
    `)
    .eq('pagado', false)
    .not('monto', 'is', null)
    .order('fecha', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

    const { sesion_id, monto_total, metodo_pago, numero_comprobante } = req.body;

    // Obtener datos de la sesión y del profesional
    const { data: sesion, error: sesErr } = await supabaseAdmin
      .from('sesiones')
      .select('*, profesional:profesionales(porcentaje_honorarios)')
      .eq('id', sesion_id)
      .single();

    if (sesErr || !sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (sesion.pagado) return res.status(409).json({ error: 'Esta sesión ya fue pagada' });

    const porcentaje = sesion.profesional.porcentaje_honorarios || 70;
    const monto_profesional = (monto_total * porcentaje) / 100;
    const monto_espacio = monto_total - monto_profesional;

    const db = getAuthenticatedClient(req);

    // Registrar pago
    const { data: pago, error: pagoErr } = await db
      .from('pagos')
      .insert({
        sesion_id,
        paciente_id: sesion.paciente_id,
        profesional_id: sesion.profesional_id,
        monto_total,
        monto_profesional,
        monto_espacio,
        porcentaje_profesional: porcentaje,
        metodo_pago,
        numero_comprobante,
        registrado_por: req.profesional.id
      })
      .select()
      .single();

    if (pagoErr) return res.status(500).json({ error: pagoErr.message });

    // Marcar sesión como pagada
    await supabaseAdmin
      .from('sesiones')
      .update({ pagado: true, fecha_pago: new Date().toISOString(), metodo_pago })
      .eq('id', sesion_id);

    res.status(201).json(pago);
  }
);

// GET /pagos/liquidacion?mes=2024-06 - resumen por profesional (solo admin)
router.get('/liquidacion', requireAuth, requireAdmin, async (req, res) => {
  const { mes } = req.query;
  if (!mes) return res.status(422).json({ error: 'Se requiere el parámetro mes (YYYY-MM)' });

  const inicio = `${mes}-01`;
  const fin = new Date(mes + '-01');
  fin.setMonth(fin.getMonth() + 1);

  const { data, error } = await supabaseAdmin
    .from('pagos')
    .select(`
      profesional_id,
      monto_total, monto_profesional, monto_espacio,
      profesional:profesionales(nombre, apellido, especialidad)
    `)
    .gte('fecha_pago', inicio)
    .lt('fecha_pago', fin.toISOString().slice(0, 10));

  if (error) return res.status(500).json({ error: error.message });

  // Agrupar por profesional
  const resumen = data.reduce((acc, p) => {
    const key = p.profesional_id;
    if (!acc[key]) {
      acc[key] = {
        profesional: p.profesional,
        total_facturado: 0,
        total_profesional: 0,
        total_espacio: 0,
        cantidad_sesiones: 0
      };
    }
    acc[key].total_facturado += Number(p.monto_total);
    acc[key].total_profesional += Number(p.monto_profesional);
    acc[key].total_espacio += Number(p.monto_espacio);
    acc[key].cantidad_sesiones++;
    return acc;
  }, {});

  res.json({
    mes,
    profesionales: Object.values(resumen),
    total_espacio: Object.values(resumen).reduce((s, p) => s + p.total_espacio, 0),
    total_facturado: Object.values(resumen).reduce((s, p) => s + p.total_facturado, 0)
  });
});

module.exports = router;
