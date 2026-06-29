const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { registrarAcceso } = require('../middleware/auditLog');
const { getAuthenticatedClient } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

// GET /pacientes
router.get('/',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);
    const { busqueda, estado, profesional_id, page = 1, limit = 20 } = req.query;

    let query = db
      .from('pacientes')
      .select(`
        id, nombre, apellido, dni, fecha_nacimiento, estado,
        telefono, email,
        profesional_principal:profesionales!profesional_principal_id(id, nombre, apellido, especialidad),
        obra_social:obras_sociales(id, nombre),
        created_at
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('apellido', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    if (busqueda) {
      query = query.or(`nombre.ilike.%${busqueda}%,apellido.ilike.%${busqueda}%,dni.ilike.%${busqueda}%`);
    }
    if (estado) query = query.eq('estado', estado);
    if (profesional_id) query = query.eq('profesional_principal_id', profesional_id);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({
      data,
      pagination: { total: count, page: Number(page), limit: Number(limit), pages: Math.ceil(count / limit) }
    });
  }
);

// GET /pacientes/:id
router.get('/:id',
  requireAuth,
  registrarAcceso('ver', 'paciente'),
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('pacientes')
      .select(`
        *,
        profesional_principal:profesionales!profesional_principal_id(id, nombre, apellido, especialidad, email),
        obra_social:obras_sociales(id, nombre, codigo),
        creado_por:profesionales!created_by(id, nombre, apellido)
      `)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// POST /pacientes
router.post('/',
  requireAuth,
  [
    body('nombre').trim().notEmpty(),
    body('apellido').trim().notEmpty(),
    body('dni').trim().notEmpty().matches(/^\d{7,8}$/),
    body('fecha_nacimiento').customSanitizer(v => {
      // Convertir dd/MM/yyyy → yyyy-MM-dd si viene del browser en español
      if (v && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const [d, m, y] = v.split('/');
        return `${y}-${m}-${d}`;
      }
      return v;
    }).isISO8601(),
    body('profesional_principal_id').optional().isUUID(),
    body('obra_social_id').optional().isUUID(),
    body('estado').optional().isIn(['activo', 'derivado', 'alta', 'inactivo']),
    body('telefono').optional().trim(),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('pacientes')
      .insert({
        ...req.body,
        profesional_principal_id: req.body.profesional_principal_id || req.profesional.id,
        created_by: req.profesional.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un paciente con ese DNI' });
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
  }
);

// PATCH /pacientes/:id
router.patch('/:id',
  requireAuth,
  registrarAcceso('editar', 'paciente'),
  [
    param('id').isUUID(),
    body('dni').optional().matches(/^\d{7,8}$/),
    body('fecha_nacimiento').optional().isISO8601(),
    body('estado').optional().isIn(['activo', 'derivado', 'alta', 'inactivo']),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    // Allowlist explícita de campos editables
    const CAMPOS_EDITABLES = [
      'nombre', 'apellido', 'dni', 'fecha_nacimiento', 'telefono', 'email',
      'estado', 'motivo_consulta', 'obra_social_id', 'numero_afiliado',
      'profesional_principal_id', 'responsable_nombre', 'responsable_vinculo',
      'responsable_telefono', 'observaciones'
    ];
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    const db = getAuthenticatedClient(req);
    const { data, error } = await db
      .from('pacientes')
      .update(updateData)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
  }
);

// GET /pacientes/:id/sesiones
router.get('/:pacienteId/sesiones',
  requireAuth,
  registrarAcceso('ver', 'sesiones_paciente'),
  async (req, res) => {
    const db = getAuthenticatedClient(req);
    const { page = 1, limit = 20 } = req.query;

    const { data, error, count } = await db
      .from('sesiones')
      .select(`
        id, fecha, tipo, duracion_minutos, notas_libres, resumen_ia,
        monto, pagado, fecha_pago,
        profesional:profesionales(id, nombre, apellido, especialidad)
      `, { count: 'exact' })
      .eq('paciente_id', req.params.pacienteId)
      .order('fecha', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, pagination: { total: count, page: Number(page), limit: Number(limit) } });
  }
);

// GET /pacientes/:id/derivaciones
router.get('/:pacienteId/derivaciones',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('derivaciones')
      .select(`
        *,
        origen:profesionales!profesional_origen_id(id, nombre, apellido, especialidad),
        destino:profesionales!profesional_destino_id(id, nombre, apellido, especialidad)
      `)
      .eq('paciente_id', req.params.pacienteId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

// GET /pacientes/:id/archivos
router.get('/:pacienteId/archivos',
  requireAuth,
  registrarAcceso('ver', 'archivos_paciente'),
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data, error } = await db
      .from('archivos_adjuntos')
      .select(`
        id, nombre_original, tipo, mime_type, tamanio_bytes, descripcion, created_at,
        subido_por:profesionales!subido_por(id, nombre, apellido)
      `)
      .eq('paciente_id', req.params.pacienteId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

module.exports = router;
