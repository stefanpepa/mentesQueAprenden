const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { registrarAcceso } = require('../middleware/auditLog');
const { getAuthenticatedClient } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

// GET /sesiones/:id
router.get('/:id',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('sesiones')
      .select(`
        *,
        paciente:pacientes(id, nombre, apellido, dni, fecha_nacimiento),
        profesional:profesionales!profesional_id(id, nombre, apellido, especialidad)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });

    // Log acceso
    if (data?.paciente_id) {
      supabaseAdmin.from('logs_acceso').insert({
        profesional_id: req.profesional.id,
        paciente_id: data.paciente_id,
        accion: 'ver',
        recurso: 'sesion',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    }

    res.json(data);
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
    body('monto').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('sesiones')
      .insert({
        ...req.body,
        profesional_id: req.profesional.id,
        created_by: req.profesional.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  }
);

// PATCH /sesiones/:id
router.patch('/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('notas_libres').optional().isString(),
    body('notas_estructuradas').optional().isObject(),
    body('resumen_ia').optional().isString(),
    body('monto').optional().isFloat({ min: 0 }),
    body('pagado').optional().isBoolean(),
    body('fecha_pago').optional().isISO8601()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    // Allowlist explícita: solo campos que el profesional puede editar post-creación
    const CAMPOS_EDITABLES = ['notas_libres', 'notas_estructuradas', 'resumen_ia', 'monto', 'pagado', 'fecha_pago', 'metodo_pago'];
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('sesiones')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// GET /sesiones/:id/versiones
router.get('/:id/versiones',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('versiones_notas')
      .select(`
        *,
        modificado_por:profesionales(id, nombre, apellido)
      `)
      .eq('sesion_id', req.params.id)
      .order('modificado_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

module.exports = router;
