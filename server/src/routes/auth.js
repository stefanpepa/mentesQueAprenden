const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const authService = require('../services/AuthService');

const router = express.Router();

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

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
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await authService.registrar(req.body);
      res.status(201).json(resultado);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// POST /auth/signup - Registro público de profesionales (sin admin)
router.post('/signup',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('nombre').trim().notEmpty(),
    body('apellido').trim().notEmpty(),
    body('especialidad').isIn(['psicopedagogia', 'psicologia', 'fonoaudiologia', 'otro']),
    body('matricula').optional().trim(),
    body('telefono').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await authService.signup(req.body);
      res.status(201).json(resultado);
    } catch (err) {
      manejarError(res, err);
    }
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
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await authService.login(req.body);
      res.json(resultado);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// POST /auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  await authService.logout(req.token);
  res.json({ message: 'Sesión cerrada' });
});

// POST /auth/forgot-password - Envía email con link para restablecer contraseña
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    await authService.forgotPassword(req.body.email);
    // Respuesta genérica siempre, para no revelar si el email existe
    res.json({ message: 'Si el email existe, vas a recibir un link para restablecer tu contraseña.' });
  }
);

// POST /auth/refresh
router.post('/refresh',
  [body('refresh_token').notEmpty()],
  async (req, res) => {
    try {
      const resultado = await authService.refresh(req.body.refresh_token);
      res.json(resultado);
    } catch (err) {
      manejarError(res, err);
    }
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
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      await authService.changePassword(req.user.id, req.body.password);
      res.json({ message: 'Contraseña actualizada' });
    } catch (err) {
      manejarError(res, err);
    }
  }
);

module.exports = router;
