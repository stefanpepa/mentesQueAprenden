const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { getAuthenticatedClient } = require('../middleware/auth');

const router = express.Router();

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

    if (req.body.profesional_destino_id === req.profesional.id) {
      return res.status(422).json({ error: 'No podés derivar al mismo profesional' });
    }

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('derivaciones')
      .insert({
        paciente_id: req.body.paciente_id,
        profesional_origen_id: req.profesional.id,
        profesional_destino_id: req.body.profesional_destino_id,
        motivo: req.body.motivo,
        observaciones: req.body.observaciones
      })
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido),
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
        destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
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

    const db = getAuthenticatedClient(req);

    // Verificar que el profesional destino es quien responde
    const { data: derivacion } = await db
      .from('derivaciones')
      .select('profesional_destino_id, estado')
      .eq('id', req.params.id)
      .single();

    if (!derivacion) return res.status(404).json({ error: 'Derivación no encontrada' });
    if (derivacion.profesional_destino_id !== req.profesional.id) {
      return res.status(403).json({ error: 'Solo el profesional destinatario puede responder' });
    }
    if (derivacion.estado !== 'pendiente') {
      return res.status(409).json({ error: 'Esta derivación ya fue respondida' });
    }

    const { data, error } = await db
      .from('derivaciones')
      .update({
        estado: req.body.estado,
        observaciones: req.body.observaciones,
        fecha_respuesta: new Date().toISOString(),
        activa: req.body.estado === 'aceptada'
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

// GET /derivaciones - todas las del profesional (enviadas + recibidas)
router.get('/', requireAuth, async (req, res) => {
  const db = getAuthenticatedClient(req);
  const profId = req.profesional.id;

  const { data, error } = await db
    .from('derivaciones')
    .select(`
      *,
      paciente:pacientes(id, nombre, apellido, dni),
      origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
      destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
    `)
    .or(`profesional_origen_id.eq.${profId},profesional_destino_id.eq.${profId}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /derivaciones/pendientes - Derivaciones recibidas pendientes
router.get('/pendientes',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('derivaciones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento),
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad)
      `)
      .eq('profesional_destino_id', req.profesional.id)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

module.exports = router;
