const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { getAuthenticatedClient } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { enviarRecordatorio } = require('../services/whatsapp');

const router = express.Router();

// GET /turnos?fecha_inicio=&fecha_fin=&profesional_id=
router.get('/', requireAuth, async (req, res) => {
  const db = getAuthenticatedClient(req);
  const { fecha_inicio, fecha_fin, profesional_id } = req.query;

  let q = db
    .from('turnos')
    .select(`
      id, fecha_inicio, fecha_fin, estado, tipo, notas, recordatorio_enviado,
      paciente:pacientes(id, nombre, apellido, telefono),
      profesional:profesionales!profesional_id(id, nombre, apellido, especialidad),
      sesion:sesiones(id)
    `)
    .order('fecha_inicio', { ascending: true });

  if (fecha_inicio) q = q.gte('fecha_inicio', fecha_inicio);
  if (fecha_fin) q = q.lte('fecha_inicio', fecha_fin);
  if (profesional_id) q = q.eq('profesional_id', profesional_id);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /turnos
router.post('/',
  requireAuth,
  [
    body('fecha_inicio').isISO8601(),
    body('fecha_fin').isISO8601(),
    body('profesional_id').isUUID(),
    body('paciente_id').optional().isUUID(),
    body('tipo').optional().isIn(['evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('turnos')
      .insert({ ...req.body, created_by: req.profesional.id })
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, telefono),
        profesional:profesionales!profesional_id(id, nombre, apellido)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  }
);

// PATCH /turnos/:id
router.patch('/:id',
  requireAuth,
  [param('id').isUUID()],
  async (req, res) => {
    const { created_by, created_at, id, ...updateData } = req.body;
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('turnos')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// DELETE /turnos/:id - cancelar
router.delete('/:id', requireAuth, async (req, res) => {
  const db = getAuthenticatedClient(req);
  const { error } = await db
    .from('turnos')
    .update({ estado: 'cancelado' })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Turno cancelado' });
});

// POST /turnos/:id/recordatorio - enviar WhatsApp manualmente
router.post('/:id/recordatorio', requireAuth, async (req, res) => {
  const { data: turno, error } = await supabaseAdmin
    .from('turnos')
    .select('*, paciente:pacientes(nombre, apellido, telefono), profesional:profesionales!profesional_id(nombre, apellido)')
    .eq('id', req.params.id)
    .single();

  if (error || !turno) return res.status(404).json({ error: 'Turno no encontrado' });
  if (!turno.paciente?.telefono) return res.status(422).json({ error: 'El paciente no tiene teléfono registrado' });

  const resultado = await enviarRecordatorio(turno);
  if (!resultado.ok) return res.status(500).json({ error: resultado.error });

  await supabaseAdmin
    .from('turnos')
    .update({ recordatorio_enviado: true, recordatorio_enviado_at: new Date().toISOString() })
    .eq('id', req.params.id);

  res.json({ message: 'Recordatorio enviado', resultado });
});

module.exports = router;
