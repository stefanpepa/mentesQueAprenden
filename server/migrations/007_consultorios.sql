-- ============================================================
-- Consultorios compartidos: cada turno reserva un consultorio físico
-- (1, 2 o 3). Un profesional debe poder ver si un consultorio está
-- ocupado en un horario aunque el turno sea de otro profesional —
-- pero sin ver el paciente ni ningún dato clínico de ese turno ajeno.
-- ============================================================

ALTER TABLE turnos ADD COLUMN consultorio SMALLINT NOT NULL DEFAULT 1 CHECK (consultorio IN (1, 2, 3));

CREATE INDEX idx_turnos_consultorio_fecha ON turnos(consultorio, fecha_inicio, fecha_fin) WHERE estado != 'cancelado';

-- Cualquier profesional autenticado puede ver fecha/hora/consultorio/estado
-- de TODOS los turnos activos (para detectar choques y ver el calendario
-- compartido), pero paciente_id y notas solo se exponen para los propios
-- o los de derivación — eso se filtra a nivel de aplicación, no acá.
DROP POLICY turnos_select ON turnos;

CREATE POLICY turnos_select ON turnos
  FOR SELECT USING (true);

-- Evita el choque de horario en el mismo consultorio a nivel de base,
-- como última línea de defensa además de la validación en el backend.
CREATE OR REPLACE FUNCTION turno_sin_choque_consultorio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'cancelado' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM turnos
    WHERE consultorio = NEW.consultorio
      AND estado != 'cancelado'
      AND id != NEW.id
      AND fecha_inicio < NEW.fecha_fin
      AND fecha_fin > NEW.fecha_inicio
  ) THEN
    RAISE EXCEPTION 'Consultorio % ocupado en ese horario', NEW.consultorio
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_turno_sin_choque
  BEFORE INSERT OR UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION turno_sin_choque_consultorio();
