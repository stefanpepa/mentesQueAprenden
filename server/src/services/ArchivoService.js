const { supabaseAdmin } = require('../config/supabase');

const BUCKET = 'historias-clinicas';

const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

class ArchivoService {
  // db es el cliente de Supabase autenticado con el JWT del usuario (respeta RLS).
  // Cada método lo recibe como parámetro porque depende de la request.

  async generarUrlSubida(db, profesionalId, body) {
    const { paciente_id, nombre_original, mime_type, tamanio_bytes, tipo, sesion_id, descripcion } = body;

    // Verificar acceso al paciente
    const { data: paciente } = await db
      .from('pacientes')
      .select('id')
      .eq('id', paciente_id)
      .single();

    if (!paciente) {
      const err = new Error('Sin acceso a este paciente');
      err.status = 403;
      throw err;
    }

    // Derivar extensión desde mime_type (no del nombre enviado por el cliente)
    const ext = MIME_TO_EXT[mime_type] || 'bin';
    const nombre_storage = `${paciente_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // URL firmada para upload (5 minutos)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(nombre_storage);

    if (uploadError) throw new Error(uploadError.message);

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
        subido_por: profesionalId
      })
      .select()
      .single();

    if (dbError) throw new Error(dbError.message);

    return {
      archivo_id: archivo.id,
      upload_url: uploadData.signedUrl,
      token: uploadData.token
    };
  }

  async obtenerUrlDescarga(db, id, profesionalId, { ip, userAgent }) {
    const { data: archivo, error } = await db
      .from('archivos_adjuntos')
      .select('*, paciente:pacientes(id)')
      .eq('id', id)
      .single();

    if (error || !archivo) {
      const err = new Error('Archivo no encontrado');
      err.status = 404;
      throw err;
    }

    // Log descarga
    supabaseAdmin.from('logs_acceso').insert({
      profesional_id: profesionalId,
      paciente_id: archivo.paciente_id,
      accion: 'descargar_archivo',
      recurso: 'archivo:' + id,
      ip_address: ip,
      user_agent: userAgent,
      metadata: { nombre_original: archivo.nombre_original }
    });

    const { data: urlData, error: urlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(archivo.storage_path, 300); // 5 minutos

    if (urlError) throw new Error(urlError.message);
    return { url: urlData.signedUrl, nombre_original: archivo.nombre_original };
  }

  async eliminar(db, id, profesional) {
    const { data: archivo } = await db
      .from('archivos_adjuntos')
      .select('storage_path, subido_por')
      .eq('id', id)
      .single();

    if (!archivo) {
      const err = new Error('Archivo no encontrado');
      err.status = 404;
      throw err;
    }
    if (archivo.subido_por !== profesional.id && profesional.rol !== 'admin') {
      const err = new Error('Sin permiso para eliminar este archivo');
      err.status = 403;
      throw err;
    }

    // Eliminar del storage
    await supabaseAdmin.storage.from(BUCKET).remove([archivo.storage_path]);

    // Eliminar de la BD
    await db.from('archivos_adjuntos').delete().eq('id', id);
  }
}

module.exports = new ArchivoService();
