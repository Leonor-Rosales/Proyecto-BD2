BEGIN;

CREATE TABLE IF NOT EXISTS hospital.especialidad (
    id_especialidad SERIAL PRIMARY KEY,
    nombre_especialidad VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS hospital.personal_medico (
    id_personal BIGSERIAL PRIMARY KEY,
    id_institucion BIGINT NOT NULL REFERENCES hospital.institucion (id_institucion),
    id_especialidad INT REFERENCES hospital.especialidad (id_especialidad),
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dpi_cui VARCHAR(20) NOT NULL UNIQUE,
    num_colegiado VARCHAR(30) UNIQUE,
    telefono VARCHAR(20),
    correo_electronico VARCHAR(150) UNIQUE,
    rol VARCHAR(30) NOT NULL CHECK (rol IN ('medico', 'especialista', 'laboratorista', 'secretaria')),
    fecha_contratacion DATE,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    CHECK (id_especialidad IS NULL OR rol IN ('medico', 'especialista'))
);

INSERT INTO hospital.especialidad (nombre_especialidad)
VALUES ('Medicina general')
ON CONFLICT (nombre_especialidad) DO NOTHING;

INSERT INTO hospital.personal_medico
    (id_institucion, id_especialidad, nombres, apellidos, dpi_cui, rol)
VALUES (
    (SELECT id_institucion FROM hospital.institucion WHERE nombre = 'Hospital General de Prueba'),
    (SELECT id_especialidad FROM hospital.especialidad WHERE nombre_especialidad = 'Medicina general'),
    'Elena', 'Médica de Prueba', 'DEMO-MED-001', 'medico'
)
ON CONFLICT (dpi_cui) DO NOTHING;

COMMIT;
