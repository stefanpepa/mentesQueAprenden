-- ============================================================
-- TABLA: evaluaciones
-- Informe psicopedagógico/psicológico/fonoaudiológico completo de un
-- paciente. Agrupa el motivo de consulta, antecedentes, observación de
-- conducta, conclusiones y sugerencias, más N pruebas aplicadas (tabla
-- pruebas_aplicadas) con sus resultados.
-- ============================================================

CREATE TYPE estado_evaluacion AS ENUM ('borrador', 'finalizado');

CREATE TABLE evaluaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  fecha_evaluacion DATE NOT NULL,
  -- Contenido del informe (mismo orden que un informe psicopedagógico estándar)
  motivo_consulta TEXT,
  antecedentes TEXT,
  observacion_conducta TEXT,
  conclusiones TEXT,
  sugerencias TEXT,
  -- Texto final generado por IA a partir de todo lo anterior + las pruebas
  informe_generado TEXT,
  estado estado_evaluacion NOT NULL DEFAULT 'borrador',
  created_by UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evaluaciones_paciente ON evaluaciones(paciente_id);
CREATE INDEX idx_evaluaciones_profesional ON evaluaciones(profesional_id);

CREATE TRIGGER trg_evaluaciones_updated_at
  BEFORE UPDATE ON evaluaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TABLA: pruebas_aplicadas
-- Cada test/instrumento psicométrico administrado dentro de una evaluación
-- (WISC-V, D2, BRIEF-2, PROLEC-SE, etc). Los resultados van en JSONB porque
-- cada test tiene una estructura de puntajes/índices completamente distinta
-- — forzar columnas fijas obligaría a una tabla por cada test existente.
-- ============================================================

CREATE TABLE pruebas_aplicadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluacion_id UUID NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
  nombre_prueba VARCHAR(150) NOT NULL, -- ej: "WISC-V", "D2. Test de atención"
  resultados JSONB NOT NULL DEFAULT '{}', -- puntajes/índices libres, ej: {"ICV": 98, "percentil": 45}
  observaciones TEXT, -- interpretación libre de esta prueba puntual
  orden INTEGER NOT NULL DEFAULT 0, -- para mantener el orden de carga/presentación
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pruebas_evaluacion ON pruebas_aplicadas(evaluacion_id);

-- ============================================================
-- RLS: mismo patrón que sesiones (dueño, derivación activa, o admin)
-- ============================================================

ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruebas_aplicadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY evaluaciones_select ON evaluaciones
  FOR SELECT USING (
    es_admin()
    OR profesional_id = auth.uid()
    OR tiene_acceso_por_derivacion(paciente_id, auth.uid())
  );

CREATE POLICY evaluaciones_insert ON evaluaciones
  FOR INSERT WITH CHECK (
    es_admin()
    OR profesional_id = auth.uid()
  );

CREATE POLICY evaluaciones_update ON evaluaciones
  FOR UPDATE USING (
    es_admin()
    OR profesional_id = auth.uid()
  );

CREATE POLICY pruebas_select ON pruebas_aplicadas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM evaluaciones e
      WHERE e.id = evaluacion_id
        AND (es_admin() OR e.profesional_id = auth.uid() OR tiene_acceso_por_derivacion(e.paciente_id, auth.uid()))
    )
  );

CREATE POLICY pruebas_insert ON pruebas_aplicadas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM evaluaciones e
      WHERE e.id = evaluacion_id
        AND (es_admin() OR e.profesional_id = auth.uid())
    )
  );

CREATE POLICY pruebas_update ON pruebas_aplicadas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM evaluaciones e
      WHERE e.id = evaluacion_id
        AND (es_admin() OR e.profesional_id = auth.uid())
    )
  );

CREATE POLICY pruebas_delete ON pruebas_aplicadas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM evaluaciones e
      WHERE e.id = evaluacion_id
        AND (es_admin() OR e.profesional_id = auth.uid())
    )
  );
