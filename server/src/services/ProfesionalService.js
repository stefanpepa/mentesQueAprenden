const { supabaseAdmin } = require('../config/supabase');

const CAMPOS_EDITABLES = ['nombre', 'apellido', 'matricula', 'especialidad', 'telefono', 'porcentaje_honorarios'];

class ProfesionalService {
  async listar() {
    const { data, error } = await supabaseAdmin
      .from('profesionales')
      .select('id, nombre, apellido, especialidad, rol, matricula, activo, porcentaje_honorarios')
      .eq('activo', true)
      .order('apellido');

    if (error) throw new Error(error.message);
    return data;
  }

  async actualizar(id, solicitante, body) {
    if (id !== solicitante.id && solicitante.rol !== 'admin') {
      const err = new Error('Sin permiso');
      err.status = 403;
      throw err;
    }

    const updateData = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    );

    // Solo admin puede cambiar el porcentaje de honorarios
    if (updateData.porcentaje_honorarios !== undefined && solicitante.rol !== 'admin') {
      delete updateData.porcentaje_honorarios;
    }

    const { data, error } = await supabaseAdmin
      .from('profesionales')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async desactivar(id) {
    const { error } = await supabaseAdmin
      .from('profesionales')
      .update({ activo: false })
      .eq('id', id);

    if (error) throw new Error(error.message);
  }
}

module.exports = new ProfesionalService();
