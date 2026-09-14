const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const iaService = require('../services/IAService');

const router = express.Router();

// POST /ia/sugerir-notas — completa notas parciales del profesional con contexto del paciente
router.post('/sugerir-notas',
  requireAuth,
  [
    body('notas_parciales').isString().notEmpty(),
    body('paciente_id').isUUID(),
    body('tipo_sesion').isString(),
    body('especialidad').isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const sugerencia = await iaService.sugerirNotas(req.body);
      res.json({ sugerencia });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al conectar con la IA de texto' });
    }
  }
);

// POST /ia/resumir-sesion — genera resumen de 3 oraciones para el historial
router.post('/resumir-sesion',
  requireAuth,
  [
    body('sesion_id').isUUID(),
    body('notas_libres').isString().notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resumen = await iaService.resumirSesion(req.body);
      res.json({ resumen });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al generar el resumen' });
    }
  }
);

// POST /ia/sugerir-derivacion — analiza el caso y sugiere si conviene derivar y a quién
router.post('/sugerir-derivacion',
  requireAuth,
  [body('paciente_id').isUUID()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const sugerencia = await iaService.sugerirDerivacion(req.body);
      res.json({ sugerencia });
    } catch (err) {
      console.error('OpenRouter error:', err.message);
      res.status(502).json({ error: 'Error al analizar el caso' });
    }
  }
);

// POST /ia/analizar-pdf — lee un archivo PDF del paciente y extrae información clínica relevante
router.post('/analizar-pdf',
  requireAuth,
  [
    body('archivo_id').isUUID(),
    body('pregunta').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await iaService.analizarPDF(req.body);
      res.json(resultado);
    } catch (err) {
      console.error('Error al analizar PDF:', err.message);
      res.status(err.status || 502).json({ error: err.status ? err.message : 'Error al analizar el archivo con IA' });
    }
  }
);

// POST /ia/chat — chatbot con function calling manual
router.post('/chat',
  requireAuth,
  [body('messages').isArray({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const resultado = await iaService.chat({ messages: req.body.messages, profesional: req.profesional });
      res.json(resultado);
    } catch (err) {
      console.error('Chat IA error:', err.message, err.status, JSON.stringify(err.error));
      res.status(502).json({ error: err.message || 'Error al conectar con la IA' });
    }
  }
);

module.exports = router;
