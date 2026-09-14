const { supabase, supabaseAdmin } = require('../config/supabase');

class AuthService {
  async _crearUsuarioYProfesional({ email, password, nombre, apellido, especialidad, rol, matricula, telefono, porcentaje_honorarios }) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      const err = new Error(authError.message);
      err.status = 400;
      throw err;
    }

    const { data: profesional, error: profError } = await supabaseAdmin
      .from('profesionales')
      .insert({
        id: authData.user.id,
        email,
        nombre,
        apellido,
        especialidad,
        rol,
        matricula,
        telefono,
        porcentaje_honorarios
      })
      .select()
      .single();

    if (profError) {
      // Rollback: eliminar usuario de auth si falla el insert
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      if (profError.code === '23505') {
        const err = new Error('Ya existe una cuenta con ese email');
        err.status = 409;
        throw err;
      }
      const err = new Error('Error al crear el profesional');
      err.status = 500;
      throw err;
    }

    return profesional;
  }

  // Solo admin puede registrar profesionales, con rol elegible
  async registrar(body) {
    const { email, password, nombre, apellido, especialidad, rol, matricula, porcentaje_honorarios, telefono } = body;
    const profesional = await this._crearUsuarioYProfesional({
      email, password, nombre, apellido, especialidad,
      rol: rol || 'profesional',
      matricula,
      telefono,
      porcentaje_honorarios: porcentaje_honorarios || 70.00
    });
    return { profesional };
  }

  // Registro público — siempre rol 'profesional', nunca admin desde acá
  async signup(body) {
    const { email, password, nombre, apellido, especialidad, matricula, telefono } = body;
    const profesional = await this._crearUsuarioYProfesional({
      email, password, nombre, apellido, especialidad,
      rol: 'profesional',
      matricula,
      telefono,
      porcentaje_honorarios: 70.00
    });

    // Login automático tras el registro
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
    if (sessionError) return { profesional, session: null };

    return {
      profesional,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at
      }
    };
  }

  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const err = new Error('Credenciales inválidas');
      err.status = 401;
      throw err;
    }

    const { data: profesional } = await supabaseAdmin
      .from('profesionales')
      .select('id, nombre, apellido, email, rol, especialidad, matricula, activo')
      .eq('id', data.user.id)
      .single();

    return {
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      profesional
    };
  }

  // Revoca el JWT del servidor usando el token del usuario, no la sesión anon del cliente
  async logout(token) {
    if (token) {
      await supabaseAdmin.auth.admin.signOut(token);
    }
  }

  async forgotPassword(email) {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
    });
    // Respuesta siempre genérica, no revela si el email existe — lo decide la ruta
  }

  async refresh(refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      const err = new Error('Token inválido');
      err.status = 401;
      throw err;
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    };
  }

  async changePassword(userId, password) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
  }
}

module.exports = new AuthService();
