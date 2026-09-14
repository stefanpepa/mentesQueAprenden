const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth, getAuthenticatedClient } = require('../middleware/auth');
const archivoService = require('../services/ArchivoService');

const router = express.Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function manejarError(res, err, fallback = { status: 500, message: 'Error interno' }) {
  const status = err.status || fallback.status;
  res.status(status).json({ error: err.status ? err.message : fallback.message });
}

// POST /archivos/upload-url - Genera una URL firmada para upload directo desde el cliente
router.post('/upload-url',
  requireAuth,
  [
    body('paciente_id').isUUID(),
    body('nombre_original').trim().notEmpty(),
    body('mime_type').isIn(ALLOWED_MIME),
    body('tamanio_bytes').isInt({ min: 1, max: MAX_FILE_SIZE }),
    body('tipo').isIn(['informe', 'estudio', 'consentimiento', 'otro'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    try {
      const data = await archivoService.generarUrlSubida(getAuthenticatedClient(req), req.profesional.id, req.body);
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// GET /archivos/:id/download-url - URL firmada para descarga
router.get('/:id/download-url',
  requireAuth,
  async (req, res) => {
    try {
      const data = await archivoService.obtenerUrlDescarga(
        getAuthenticatedClient(req),
        req.params.id,
        req.profesional.id,
        { ip: req.ip, userAgent: req.get('User-Agent') }
      );
      res.json(data);
    } catch (err) {
      manejarError(res, err);
    }
  }
);

// DELETE /archivos/:id - Solo el que subió el archivo o admin
router.delete('/:id',
  requireAuth,
  async (req, res) => {
    try {
      await archivoService.eliminar(getAuthenticatedClient(req), req.params.id, req.profesional);
      res.json({ message: 'Archivo eliminado' });
    } catch (err) {
      manejarError(res, err);
    }
  }
);

module.exports = router;
