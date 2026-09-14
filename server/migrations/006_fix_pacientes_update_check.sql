-- ============================================================
-- El UPDATE de pacientes (usado por soft-delete y edición) fallaba con
-- "new row violates row-level security policy" porque la policy
-- pacientes_update no tenía WITH CHECK explícito. Sin WITH CHECK, algunas
-- combinaciones de policies en Supabase/PostgREST no logran resolver
-- correctamente qué condición aplicar a la fila resultante del UPDATE.
-- ============================================================

DROP POLICY pacientes_update ON pacientes;

CREATE POLICY pacientes_update ON pacientes
  FOR UPDATE
  USING (
    es_admin()
    OR profesional_principal_id = auth.uid()
    OR tiene_acceso_por_derivacion(id, auth.uid())
  )
  WITH CHECK (
    es_admin()
    OR profesional_principal_id = auth.uid()
    OR tiene_acceso_por_derivacion(id, auth.uid())
  );
