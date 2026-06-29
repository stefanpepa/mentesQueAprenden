const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { registrarAcceso } = require('../middleware/auditLog');
const { getAuthenticatedClient } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');

const router = express.Router();

const BUCKET = 'historias-clinicas';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

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

    const { paciente_id, nombre_original, mime_type, tamanio_bytes, tipo, sesion_id, descripcion } = req.body;

    // Verificar acceso al paciente
    const db = getAuthenticatedClient(req);
    const { data: paciente } = await db
      .from('pacientes')
      .select('id')
      .eq('id', paciente_id)
      .single();

    if (!paciente) return res.status(403).json({ error: 'Sin acceso a este paciente' });

    // Derivar extensión desde mime_type (no del nombre enviado por el cliente)
    const MIME_TO_EXT = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    const ext = MIME_TO_EXT[mime_type] || 'bin';
    const nombre_storage = `${paciente_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // URL firmada para upload (5 minutos)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(nombre_storage);

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    // Registrar el archivo en la BD (pendiente hasta que se confirme el upload)
    const { data: archivo, error: dbError } = await db
      .from('archivos_adjuntos')
      .insert({
        paciente_id,
        sesion_id,
        nombre_original,
        nombre_storage,
        storage_path: nombre_storage,
        tipo,
        mime_type,
        tamanio_bytes,
        descripcion,
        subido_por: req.profesional.id
      })
      .select()
      .single();

    if (dbError) return res.status(500).json({ error: dbError.message });

    res.json({
      archivo_id: archivo.id,
      upload_url: uploadData.signedUrl,
      token: uploadData.token
    });
  }
);

// GET /archivos/:id/download-url - URL firmada para descarga
router.get('/:id/download-url',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data: archivo, error } = await db
      .from('archivos_adjuntos')
      .select('*, paciente:pacientes(id)')
      .eq('id', req.params.id)
      .single();

    if (error || !archivo) return res.status(404).json({ error: 'Archivo no encontrado' });

    // Log descarga
    supabaseAdmin.from('logs_acceso').insert({
      profesional_id: req.profesional.id,
      paciente_id: archivo.paciente_id,
      accion: 'descargar_archivo',
      recurso: 'archivo:' + req.params.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      metadata: { nombre_original: archivo.nombre_original }
    });

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(archivo.storage_path, 300); // 5 minutos

    if (urlError) return res.status(500).json({ error: urlError.message });
    res.json({ url: urlData.signedUrl, nombre_original: archivo.nombre_original });
  }
);

// DELETE /archivos/:id - Solo el que subió el archivo o admin
router.delete('/:id',
  requireAuth,
  async (req, res) => {
    const db = getAuthenticatedClient(req);

    const { data: archivo } = await db
      .from('archivos_adjuntos')
      .select('storage_path, subido_por')
      .eq('id', req.params.id)
      .single();

    if (!archivo) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (archivo.subido_por !== req.profesional.id && req.profesional.rol !== 'admin') {
      return res.status(403).json({ error: 'Sin permiso para eliminar este archivo' });
    }

    // Eliminar del storage
    await supabaseAdmin.storage.from(BUCKET).remove([archivo.storage_path]);

    // Eliminar de la BD
    await db.from('archivos_adjuntos').delete().eq('id', req.params.id);

    res.json({ message: 'Archivo eliminado' });
  }
);

module.exports = router;
