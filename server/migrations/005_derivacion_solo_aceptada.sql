-- ============================================================
-- El profesional destino de una derivación NO debe ver/acceder al
-- paciente mientras la derivación esté "pendiente" — recién cuando la
-- acepta explícitamente. Antes la función daba acceso también en estado
-- pendiente, exponiendo el paciente antes de que el destino confirmara.
-- ============================================================

CREATE OR REPLACE FUNCTION tiene_acceso_por_derivacion(p_paciente_id UUID, p_profesional_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM derivaciones
    WHERE paciente_id = p_paciente_id
      AND activa = true
      AND estado = 'aceptada'
      AND (profesional_origen_id = p_profesional_id OR profesional_destino_id = p_profesional_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
