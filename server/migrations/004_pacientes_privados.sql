-- ============================================================
-- Cada profesional (incluidos los admin) ve únicamente sus propios
-- pacientes, salvo derivación activa. Antes los admin veían TODOS los
-- pacientes del centro; se saca ese bypass solo en SELECT — un admin
-- sigue pudiendo crear/editar cualquier paciente si hace falta intervenir
-- administrativamente.
-- ============================================================

DROP POLICY pacientes_select ON pacientes;

CREATE POLICY pacientes_select ON pacientes
  FOR SELECT USING (
    deleted_at IS NULL AND (
      profesional_principal_id = auth.uid()
      OR tiene_acceso_por_derivacion(id, auth.uid())
    )
  );
