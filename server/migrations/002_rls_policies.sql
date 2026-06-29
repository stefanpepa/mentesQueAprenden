-- ============================================================
-- ROW LEVEL SECURITY (RLS) - KAN-7
-- Cada profesional solo ve sus pacientes, salvo derivación activa
-- ============================================================

-- Habilitar RLS en todas las tablas sensibles
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE derivaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivos_adjuntos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE versiones_notas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIÓN HELPER: verifica si existe derivación activa entre dos profesionales
-- para un paciente dado
-- ============================================================

CREATE OR REPLACE FUNCTION tiene_acceso_por_derivacion(p_paciente_id UUID, p_profesional_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM derivaciones
    WHERE paciente_id = p_paciente_id
      AND activa = true
      AND estado IN ('pendiente', 'aceptada')
      AND (profesional_origen_id = p_profesional_id OR profesional_destino_id = p_profesional_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- FUNCIÓN HELPER: verifica si el usuario actual es admin
-- ============================================================

CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profesionales
    WHERE id = auth.uid() AND rol = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- POLÍTICAS: profesionales
-- ============================================================

CREATE POLICY profesionales_select ON profesionales
  FOR SELECT USING (true); -- Todos pueden ver la lista de colegas

CREATE POLICY profesionales_update_own ON profesionales
  FOR UPDATE USING (id = auth.uid() OR es_admin());

CREATE POLICY profesionales_insert ON profesionales
  FOR INSERT WITH CHECK (es_admin());

-- ============================================================
-- POLÍTICAS: pacientes
-- Regla: profesional principal OR derivación activa OR admin
-- ============================================================

CREATE POLICY pacientes_select ON pacientes
  FOR SELECT USING (
    deleted_at IS NULL AND (
      es_admin()
      OR profesional_principal_id = auth.uid()
      OR tiene_acceso_por_derivacion(id, auth.uid())
    )
  );

CREATE POLICY pacientes_insert ON pacientes
  FOR INSERT WITH CHECK (
    es_admin() OR profesional_principal_id = auth.uid()
  );

CREATE POLICY pacientes_update ON pacientes
  FOR UPDATE USING (
    es_admin()
    OR profesional_principal_id = auth.uid()
    OR tiene_acceso_por_derivacion(id, auth.uid())
  );

-- Nunca DELETE en historias clínicas (solo soft delete via UPDATE)
-- No CREATE POLICY para DELETE = nadie puede borrar

-- ============================================================
-- POLÍTICAS: sesiones
-- ============================================================

CREATE POLICY sesiones_select ON sesiones
  FOR SELECT USING (
    es_admin()
    OR profesional_id = auth.uid()
    OR tiene_acceso_por_derivacion(paciente_id, auth.uid())
  );

CREATE POLICY sesiones_insert ON sesiones
  FOR INSERT WITH CHECK (
    es_admin()
    OR profesional_id = auth.uid()
  );

CREATE POLICY sesiones_update ON sesiones
  FOR UPDATE USING (
    es_admin()
    OR profesional_id = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: derivaciones
-- ============================================================

CREATE POLICY derivaciones_select ON derivaciones
  FOR SELECT USING (
    es_admin()
    OR profesional_origen_id = auth.uid()
    OR profesional_destino_id = auth.uid()
  );

CREATE POLICY derivaciones_insert ON derivaciones
  FOR INSERT WITH CHECK (
    es_admin()
    OR profesional_origen_id = auth.uid()
  );

CREATE POLICY derivaciones_update ON derivaciones
  FOR UPDATE USING (
    es_admin()
    OR profesional_origen_id = auth.uid()
    OR profesional_destino_id = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: archivos_adjuntos
-- ============================================================

CREATE POLICY archivos_select ON archivos_adjuntos
  FOR SELECT USING (
    es_admin()
    OR subido_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = paciente_id
        AND (p.profesional_principal_id = auth.uid()
             OR tiene_acceso_por_derivacion(p.id, auth.uid()))
    )
  );

CREATE POLICY archivos_insert ON archivos_adjuntos
  FOR INSERT WITH CHECK (
    es_admin()
    OR subido_por = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: turnos
-- ============================================================

CREATE POLICY turnos_select ON turnos
  FOR SELECT USING (
    es_admin()
    OR profesional_id = auth.uid()
    OR (paciente_id IS NOT NULL AND tiene_acceso_por_derivacion(paciente_id, auth.uid()))
  );

CREATE POLICY turnos_insert ON turnos
  FOR INSERT WITH CHECK (
    es_admin()
    OR profesional_id = auth.uid()
  );

CREATE POLICY turnos_update ON turnos
  FOR UPDATE USING (
    es_admin()
    OR profesional_id = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: pagos
-- ============================================================

CREATE POLICY pagos_select ON pagos
  FOR SELECT USING (
    es_admin()
    OR profesional_id = auth.uid()
  );

CREATE POLICY pagos_insert ON pagos
  FOR INSERT WITH CHECK (
    es_admin()
    OR registrado_por = auth.uid()
  );

-- ============================================================
-- POLÍTICAS: versiones_notas (solo lectura para el profesional dueño)
-- ============================================================

CREATE POLICY versiones_select ON versiones_notas
  FOR SELECT USING (
    es_admin()
    OR modificado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sesiones s
      WHERE s.id = sesion_id AND s.profesional_id = auth.uid()
    )
  );
