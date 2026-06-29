-- ============================================================
-- SCHEMA COMPLETO - Sistema de Gestión Clínica Interdisciplinaria
-- Cumplimiento Ley 25.326 Argentina (Protección de Datos Personales)
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'profesional');
CREATE TYPE especialidad AS ENUM ('psicopedagogia', 'psicologia', 'fonoaudiologia', 'otro');
CREATE TYPE estado_paciente AS ENUM ('activo', 'derivado', 'alta', 'inactivo');
CREATE TYPE tipo_sesion AS ENUM ('evaluacion', 'tratamiento', 'seguimiento', 'devolucion', 'reunion_interdisciplinaria');
CREATE TYPE estado_derivacion AS ENUM ('pendiente', 'aceptada', 'rechazada', 'completada');
CREATE TYPE tipo_archivo AS ENUM ('informe', 'estudio', 'consentimiento', 'otro');

-- ============================================================
-- TABLA: profesionales
-- Extiende auth.users de Supabase
-- ============================================================

CREATE TABLE profesionales (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  matricula VARCHAR(50),
  especialidad especialidad NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  rol user_role NOT NULL DEFAULT 'profesional',
  activo BOOLEAN NOT NULL DEFAULT true,
  porcentaje_honorarios DECIMAL(5,2) DEFAULT 70.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: obras_sociales
-- ============================================================

CREATE TABLE obras_sociales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(150) NOT NULL,
  codigo VARCHAR(30),
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Obras sociales comunes en Argentina
INSERT INTO obras_sociales (nombre, codigo) VALUES
  ('OSDE', 'OSDE'),
  ('Swiss Medical', 'SWISS'),
  ('Galeno', 'GALENO'),
  ('Medicus', 'MEDICUS'),
  ('IOMA', 'IOMA'),
  ('PAMI', 'PAMI'),
  ('Particular', 'PARTICULAR'),
  ('Sin obra social', 'NINGUNA');

-- ============================================================
-- TABLA: pacientes
-- Datos sensibles según Ley 25.326
-- ============================================================

CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Datos personales
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(15) NOT NULL UNIQUE,
  fecha_nacimiento DATE NOT NULL,
  genero VARCHAR(30),
  telefono VARCHAR(20),
  telefono_alternativo VARCHAR(20),
  email VARCHAR(255),
  direccion TEXT,
  localidad VARCHAR(100),
  provincia VARCHAR(100) DEFAULT 'Buenos Aires',
  -- Contacto de emergencia / responsable
  responsable_nombre VARCHAR(200),
  responsable_telefono VARCHAR(20),
  responsable_vinculo VARCHAR(50),
  -- Obra social
  obra_social_id UUID REFERENCES obras_sociales(id),
  numero_afiliado VARCHAR(50),
  -- Clínico
  profesional_principal_id UUID NOT NULL REFERENCES profesionales(id),
  estado estado_paciente NOT NULL DEFAULT 'activo',
  motivo_consulta TEXT,
  -- Metadata
  created_by UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft delete (NUNCA eliminar historias clínicas)
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pacientes_dni ON pacientes(dni);
CREATE INDEX idx_pacientes_profesional ON pacientes(profesional_principal_id);
CREATE INDEX idx_pacientes_estado ON pacientes(estado);
CREATE INDEX idx_pacientes_apellido ON pacientes(apellido);

-- ============================================================
-- TABLA: sesiones
-- ============================================================

CREATE TABLE sesiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  fecha TIMESTAMPTZ NOT NULL,
  duracion_minutos INTEGER DEFAULT 50,
  tipo tipo_sesion NOT NULL DEFAULT 'tratamiento',
  -- Notas clínicas
  notas_libres TEXT,
  notas_estructuradas JSONB DEFAULT '{}',
  -- IA
  resumen_ia TEXT,
  notas_ia_sugeridas TEXT,
  ia_utilizada BOOLEAN DEFAULT false,
  -- Facturación
  monto DECIMAL(10,2),
  pagado BOOLEAN DEFAULT false,
  fecha_pago TIMESTAMPTZ,
  metodo_pago VARCHAR(50),
  numero_factura VARCHAR(50),
  -- Metadata
  created_by UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sesiones_paciente ON sesiones(paciente_id);
CREATE INDEX idx_sesiones_profesional ON sesiones(profesional_id);
CREATE INDEX idx_sesiones_fecha ON sesiones(fecha);

-- ============================================================
-- TABLA: versiones_notas
-- Control de versiones para cumplimiento Ley 25.326
-- ============================================================

CREATE TABLE versiones_notas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id UUID NOT NULL REFERENCES sesiones(id),
  notas_libres_anterior TEXT,
  notas_libres_nueva TEXT,
  notas_estructuradas_anterior JSONB,
  notas_estructuradas_nueva JSONB,
  modificado_por UUID NOT NULL REFERENCES profesionales(id),
  modificado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  motivo_modificacion TEXT
);

-- ============================================================
-- TABLA: derivaciones
-- ============================================================

CREATE TABLE derivaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  profesional_origen_id UUID NOT NULL REFERENCES profesionales(id),
  profesional_destino_id UUID NOT NULL REFERENCES profesionales(id),
  estado estado_derivacion NOT NULL DEFAULT 'pendiente',
  motivo TEXT NOT NULL,
  observaciones TEXT,
  fecha_derivacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_respuesta TIMESTAMPTZ,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT derivacion_distinta CHECK (profesional_origen_id != profesional_destino_id)
);

CREATE INDEX idx_derivaciones_paciente ON derivaciones(paciente_id);
CREATE INDEX idx_derivaciones_origen ON derivaciones(profesional_origen_id);
CREATE INDEX idx_derivaciones_destino ON derivaciones(profesional_destino_id);
CREATE INDEX idx_derivaciones_activa ON derivaciones(activa);

-- ============================================================
-- TABLA: turnos (agenda)
-- ============================================================

CREATE TABLE turnos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'programado'
    CHECK (estado IN ('programado', 'confirmado', 'cancelado', 'ausente', 'realizado')),
  tipo tipo_sesion DEFAULT 'tratamiento',
  notas VARCHAR(500),
  -- WhatsApp recordatorio
  recordatorio_enviado BOOLEAN DEFAULT false,
  recordatorio_enviado_at TIMESTAMPTZ,
  sesion_id UUID REFERENCES sesiones(id),
  created_by UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_turnos_profesional_fecha ON turnos(profesional_id, fecha_inicio);
CREATE INDEX idx_turnos_paciente ON turnos(paciente_id);

-- ============================================================
-- TABLA: archivos_adjuntos
-- ============================================================

CREATE TABLE archivos_adjuntos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  sesion_id UUID REFERENCES sesiones(id),
  nombre_original VARCHAR(255) NOT NULL,
  nombre_storage VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  tipo tipo_archivo NOT NULL DEFAULT 'otro',
  mime_type VARCHAR(100),
  tamanio_bytes INTEGER,
  descripcion TEXT,
  subido_por UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_archivos_paciente ON archivos_adjuntos(paciente_id);

-- ============================================================
-- TABLA: pagos
-- ============================================================

CREATE TABLE pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sesion_id UUID NOT NULL REFERENCES sesiones(id),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  monto_total DECIMAL(10,2) NOT NULL,
  monto_profesional DECIMAL(10,2) NOT NULL,
  monto_espacio DECIMAL(10,2) NOT NULL,
  porcentaje_profesional DECIMAL(5,2) NOT NULL,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metodo_pago VARCHAR(50) NOT NULL
    CHECK (metodo_pago IN ('efectivo', 'transferencia', 'debito', 'credito', 'obra_social')),
  numero_comprobante VARCHAR(100),
  registrado_por UUID NOT NULL REFERENCES profesionales(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagos_profesional ON pagos(profesional_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago);

-- ============================================================
-- TABLA: logs_acceso (Cumplimiento Ley 25.326)
-- INMUTABLE: nunca UPDATE ni DELETE
-- ============================================================

CREATE TABLE logs_acceso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id UUID NOT NULL REFERENCES profesionales(id),
  paciente_id UUID NOT NULL REFERENCES pacientes(id),
  accion VARCHAR(50) NOT NULL
    CHECK (accion IN ('ver', 'crear', 'editar', 'subir_archivo', 'descargar_archivo', 'ver_por_derivacion')),
  recurso VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_logs_profesional ON logs_acceso(profesional_id);
CREATE INDEX idx_logs_paciente ON logs_acceso(paciente_id);
CREATE INDEX idx_logs_fecha ON logs_acceso(created_at);

-- Prevenir modificaciones al log (RLS + policy)
ALTER TABLE logs_acceso ENABLE ROW LEVEL SECURITY;
CREATE POLICY logs_insert_only ON logs_acceso FOR INSERT WITH CHECK (true);
CREATE POLICY logs_select_own ON logs_acceso FOR SELECT
  USING (profesional_id = auth.uid());

-- ============================================================
-- TABLA: configuracion_espacio
-- ============================================================

CREATE TABLE configuracion_espacio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre_espacio VARCHAR(200) NOT NULL DEFAULT 'Centro de Salud',
  direccion TEXT,
  telefono VARCHAR(20),
  email VARCHAR(255),
  porcentaje_espacio_default DECIMAL(5,2) DEFAULT 30.00,
  moneda VARCHAR(10) DEFAULT 'ARS',
  timezone VARCHAR(50) DEFAULT 'America/Argentina/Buenos_Aires',
  whatsapp_api_token TEXT,
  whatsapp_phone_id VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion_espacio (nombre_espacio) VALUES ('Centro de Salud Interdisciplinario');

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profesionales_updated_at
  BEFORE UPDATE ON profesionales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON pacientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sesiones_updated_at
  BEFORE UPDATE ON sesiones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_derivaciones_updated_at
  BEFORE UPDATE ON derivaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_turnos_updated_at
  BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: versionado automático de notas clínicas
-- ============================================================

CREATE OR REPLACE FUNCTION versionar_notas()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.notas_libres IS DISTINCT FROM NEW.notas_libres
     OR OLD.notas_estructuradas IS DISTINCT FROM NEW.notas_estructuradas THEN
    INSERT INTO versiones_notas (
      sesion_id, notas_libres_anterior, notas_libres_nueva,
      notas_estructuradas_anterior, notas_estructuradas_nueva,
      modificado_por
    ) VALUES (
      OLD.id, OLD.notas_libres, NEW.notas_libres,
      OLD.notas_estructuradas, NEW.notas_estructuradas,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_versionar_notas
  BEFORE UPDATE ON sesiones
  FOR EACH ROW EXECUTE FUNCTION versionar_notas();
