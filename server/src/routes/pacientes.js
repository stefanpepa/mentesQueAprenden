const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { registrarAcceso } = require('../middleware/auditLog');
const { getAuthenticatedClient } = require('../middleware/auth');
const pacienteService = require('../services/PacienteService');

const router = express.Router();

// GET /pacientes
router.get('/',
  requireAuth,
  async (req, res) => {
    try {
      const resultado = await pacienteService.listar(getAuthenticatedClient(req), req.query, req.profesional.id);
      res.json(resultado);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// GET /pacientes/:id
router.get('/:id',
  requireAuth,
  registrarAcceso('ver', 'paciente'),
  async (req, res) => {
    try {
      const data = await pacienteService.obtener(getAuthenticatedClient(req), req.params.id);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
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

    try {
      const data = await pacienteService.crear(getAuthenticatedClient(req), req.body, req.profesional);
      res.status(201).json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
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

    try {
      const data = await pacienteService.actualizar(getAuthenticatedClient(req), req.params.id, req.body);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// DELETE /pacientes/:id (soft delete — el historial clínico nunca se borra, Ley 25.326)
router.delete('/:id',
  requireAuth,
  registrarAcceso('editar', 'paciente'),
  [param('id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await pacienteService.eliminar(getAuthenticatedClient(req), req.params.id);
      res.json(resultado);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// GET /pacientes/:id/sesiones
router.get('/:pacienteId/sesiones',
  requireAuth,
  registrarAcceso('ver', 'sesiones_paciente'),
  async (req, res) => {
    try {
      const resultado = await pacienteService.listarSesiones(getAuthenticatedClient(req), req.params.pacienteId, req.query);
      res.json(resultado);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// GET /pacientes/:id/turnos
router.get('/:pacienteId/turnos',
  requireAuth,
  async (req, res) => {
    try {
      const data = await pacienteService.listarTurnos(getAuthenticatedClient(req), req.params.pacienteId);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// GET /pacientes/:id/derivaciones
router.get('/:pacienteId/derivaciones',
  requireAuth,
  async (req, res) => {
    try {
      const data = await pacienteService.listarDerivaciones(getAuthenticatedClient(req), req.params.pacienteId);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

// GET /pacientes/:id/archivos
router.get('/:pacienteId/archivos',
  requireAuth,
  registrarAcceso('ver', 'archivos_paciente'),
  async (req, res) => {
    try {
      const data = await pacienteService.listarArchivos(getAuthenticatedClient(req), req.params.pacienteId);
      res.json(data);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

module.exports = router;
