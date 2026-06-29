const { supabase, supabaseAdmin } = require('../config/supabase');

// Verifica el JWT de Supabase y adjunta el profesional al request
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const token = authHeader.split(' ')[1];

  // Dev bypass: solo activo si NODE_ENV es explícitamente 'development'
  if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
    const { data: profesional } = await supabaseAdmin
      .from('profesionales')
      .select('id, nombre, apellido, rol, especialidad, activo')
      .eq('rol', 'admin')
      .eq('activo', true)
      .limit(1)
      .single();

    if (!profesional) return res.status(401).json({ error: 'No hay admin en la DB' });

    req.user = { id: profesional.id };
    req.profesional = profesional;
    req.token = null;
    return next();
  }

  // Bloquear dev-token en cualquier otro entorno
  if (token === 'dev-token') {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Obtener datos del profesional
  const { data: profesional, error: profError } = await supabaseAdmin
    .from('profesionales')
    .select('id, nombre, apellido, rol, especialidad, activo')
    .eq('id', user.id)
    .single();

  if (profError || !profesional) {
    return res.status(401).json({ error: 'Profesional no encontrado' });
  }

  if (!profesional.activo) {
    return res.status(403).json({ error: 'Cuenta desactivada' });
  }

  req.user = user;
  req.profesional = profesional;
  req.token = token;
  next();
}

// Crea un cliente Supabase autenticado como el usuario actual (respeta RLS)
// En dev sin token real, usa supabaseAdmin (bypass RLS)
function getAuthenticatedClient(req) {
  if (!req.token) return supabaseAdmin;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${req.token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    }
  );
}

function requireAdmin(req, res, next) {
  if (req.profesional?.rol !== 'admin') {
    return res.status(403).json({ error: 'Se requiere rol admin' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, getAuthenticatedClient };
