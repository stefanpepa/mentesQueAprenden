const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const { getAuthenticatedClient } = require('../middleware/auth');

const router = express.Router();

// GET /profesionales - Lista todos los profesionales activos
router.get('/', requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profesionales')
    .select('id, nombre, apellido, especialidad, rol, matricula, activo, porcentaje_honorarios')
    .eq('activo', true)
    .order('apellido');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
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

    if (req.params.id !== req.profesional.id && req.profesional.rol !== 'admin') {
      return res.status(403).json({ error: 'Sin permiso' });
    }

    const { id, created_at, email, rol, ...updateData } = req.body;

    // Solo admin puede cambiar el porcentaje
    if (updateData.porcentaje_honorarios && req.profesional.rol !== 'admin') {
      delete updateData.porcentaje_honorarios;
    }

    const { data, error } = await supabaseAdmin
      .from('profesionales')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  }
);

// DELETE (desactivar) /profesionales/:id - Solo admin
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('profesionales')
    .update({ activo: false })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Profesional desactivado' });
});

module.exports = router;
