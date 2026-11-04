BEGIN;

CREATE TABLE IF NOT EXISTS hospital.paciente (
    id_paciente BIGSERIAL PRIMARY KEY,
    id_institucion BIGINT NOT NULL REFERENCES hospital.institucion (id_institucion),
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dpi_cui VARCHAR(20) UNIQUE,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(20),
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    correo_electronico VARCHAR(150),
    contacto_emergencia_nombre VARCHAR(150),
    contacto_emergencia_telefono VARCHAR(20),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'inactivo', 'baja')),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital.historial_clinico (
    id_historial BIGSERIAL PRIMARY KEY,
    id_paciente BIGINT NOT NULL UNIQUE REFERENCES hospital.paciente (id_paciente),
    fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones_generales TEXT
);

COMMIT;
