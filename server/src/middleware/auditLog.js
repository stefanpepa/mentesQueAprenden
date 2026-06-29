const { supabaseAdmin } = require('../config/supabase');

// Middleware para registrar accesos a historias clínicas (Ley 25.326)
function registrarAcceso(accion, recurso) {
  return async (req, res, next) => {
    const pacienteId = req.params.pacienteId || req.params.id || req.body?.paciente_id;

    if (!pacienteId || !req.profesional) {
      return next();
    }

    // Log asíncrono, no bloquea el request
    supabaseAdmin.from('logs_acceso').insert({
      profesional_id: req.profesional.id,
      paciente_id: pacienteId,
      accion,
      recurso,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      metadata: {
        method: req.method,
        path: req.path,
        params: req.params
      }
    }).then(({ error }) => {
      if (error) console.error('Error al registrar log de acceso:', error);
    });

    next();
  };
}

module.exports = { registrarAcceso };
