const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /auth/register - Solo admin puede registrar profesionales
router.post('/register',
  requireAuth,
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('nombre').trim().notEmpty(),
    body('apellido').trim().notEmpty(),
    body('especialidad').isIn(['psicopedagogia', 'psicologia', 'fonoaudiologia', 'otro']),
    body('rol').optional().isIn(['admin', 'profesional']),
    body('matricula').optional().trim(),
    body('porcentaje_honorarios').optional().isFloat({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password, nombre, apellido, especialidad, rol, matricula, porcentaje_honorarios, telefono } = req.body;

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Crear registro en tabla profesionales
    const { data: profesional, error: profError } = await supabaseAdmin
      .from('profesionales')
      .insert({
        id: authData.user.id,
        email,
        nombre,
        apellido,
        especialidad,
        rol: rol || 'profesional',
        matricula,
        telefono,
        porcentaje_honorarios: porcentaje_honorarios || 70.00
      })
      .select()
      .single();

    if (profError) {
      // Rollback: eliminar usuario de auth si falla el insert
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Error al crear el profesional' });
    }

    res.status(201).json({ profesional });
  }
);

// POST /auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Traer datos del profesional
    const { data: profesional } = await supabaseAdmin
      .from('profesionales')
      .select('id, nombre, apellido, email, rol, especialidad, matricula, activo')
      .eq('id', data.user.id)
      .single();

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      profesional
    });
  }
);

// POST /auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  // Revocar el JWT del servidor usando el token del usuario, no la sesión anon del cliente
  if (req.token) {
    await supabaseAdmin.auth.admin.signOut(req.token);
  }
  res.json({ message: 'Sesión cerrada' });
});

// POST /auth/refresh
router.post('/refresh',
  [body('refresh_token').notEmpty()],
  async (req, res) => {
    const { refresh_token } = req.body;
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: 'Token inválido' });

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    });
  }
);

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ profesional: req.profesional });
});

// PATCH /auth/change-password
router.patch('/change-password',
  requireAuth,
  [body('password').isLength({ min: 8 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      { password: req.body.password }
    );

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Contraseña actualizada' });
  }
);

module.exports = router;
