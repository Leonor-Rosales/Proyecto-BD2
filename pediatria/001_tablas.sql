-- =====================================================================
-- Centro Médico Pediátrico - Esquema de Base de Datos (MySQL 8)
-- Basado en la Entrega I (Diccionario de Datos y Modelo Relacional)
-- =====================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS centro_pediatrico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE centro_pediatrico;

-- 1. Institución
CREATE TABLE IF NOT EXISTS institucion (
    id_institucion INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    horario_atencion VARCHAR(100)
) ENGINE=InnoDB;

-- 2. Especialidad médica
CREATE TABLE IF NOT EXISTS especialidad (
    id_especialidad INT AUTO_INCREMENT PRIMARY KEY,
    nombre_especialidad VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255)
) ENGINE=InnoDB;

-- 3. Personal Pediátrico
CREATE TABLE IF NOT EXISTS personal_pediatrico (
    id_personal INT AUTO_INCREMENT PRIMARY KEY,
    id_institucion INT NOT NULL,
    id_especialidad INT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dpi_cui VARCHAR(20) NOT NULL UNIQUE,
    num_colegiado VARCHAR(30) UNIQUE,
    telefono VARCHAR(20),
    correo_electronico VARCHAR(150) UNIQUE,
    rol ENUM('pediatra', 'especialista', 'secretaria', 'enfermera') NOT NULL,
    fecha_contratacion DATE,
    estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    CONSTRAINT fk_personal_institucion
        FOREIGN KEY (id_institucion) REFERENCES institucion (id_institucion)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_personal_especialidad
        FOREIGN KEY (id_especialidad) REFERENCES especialidad (id_especialidad)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 4. Paciente (Menor de edad)
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente INT AUTO_INCREMENT PRIMARY KEY,
    id_institucion INT NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    dpi_cui VARCHAR(20) UNIQUE NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(20),
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    correo_electronico VARCHAR(150),
    contacto_emergencia_nombre VARCHAR(150),
    contacto_emergencia_telefono VARCHAR(20),
    estado ENUM('activo', 'inactivo', 'baja') NOT NULL DEFAULT 'activo',
    motivo_baja TEXT NULL,
    fecha_baja DATETIME NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_paciente_institucion
        FOREIGN KEY (id_institucion) REFERENCES institucion (id_institucion)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5. Historial Clínico (Expediente - Relación 1:1 con Paciente)
CREATE TABLE IF NOT EXISTS historial_clinico (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente INT NOT NULL UNIQUE,
    fecha_apertura DATE NOT NULL DEFAULT (CURRENT_DATE),
    observaciones_generales TEXT,
    CONSTRAINT fk_historial_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 6. Cita Médica
CREATE TABLE IF NOT EXISTS cita_medica (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_personal INT NOT NULL,
    id_institucion INT NOT NULL,
    fecha_hora DATETIME NOT NULL,
    motivo VARCHAR(255),
    estado_cita ENUM('programada', 'atendida', 'cancelada', 'no_asistio') NOT NULL DEFAULT 'programada',
    CONSTRAINT fk_cita_paciente
        FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cita_personal
        FOREIGN KEY (id_personal) REFERENCES personal_pediatrico (id_personal)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_cita_institucion
        FOREIGN KEY (id_institucion) REFERENCES institucion (id_institucion)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 7. Consulta Pediátrica
CREATE TABLE IF NOT EXISTS consulta_pediatrica (
    id_consulta INT AUTO_INCREMENT PRIMARY KEY,
    id_cita INT NOT NULL,
    id_historial INT NOT NULL,
    id_personal INT NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_consulta ENUM('control_nino_sano', 'enfermedad', 'urgencia') NOT NULL DEFAULT 'control_nino_sano',
    motivo_consulta VARCHAR(255) NOT NULL,
    notas_evolucion TEXT,
    CONSTRAINT fk_consulta_cita
        FOREIGN KEY (id_cita) REFERENCES cita_medica (id_cita)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_consulta_historial
        FOREIGN KEY (id_historial) REFERENCES historial_clinico (id_historial)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_consulta_personal
        FOREIGN KEY (id_personal) REFERENCES personal_pediatrico (id_personal)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Control de Crecimiento (Específico de Pediatría)
CREATE TABLE IF NOT EXISTS control_crecimiento (
    id_control INT AUTO_INCREMENT PRIMARY KEY,
    id_historial INT NOT NULL,
    id_consulta INT NULL,
    fecha_control DATE NOT NULL,
    peso_kg DECIMAL(5,2) NOT NULL,
    talla_cm DECIMAL(5,2) NOT NULL,
    perimetro_cefalico_cm DECIMAL(5,2),
    percentil_observado VARCHAR(50),
    CONSTRAINT fk_crecimiento_historial
        FOREIGN KEY (id_historial) REFERENCES historial_clinico (id_historial)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_crecimiento_consulta
        FOREIGN KEY (id_consulta) REFERENCES consulta_pediatrica (id_consulta)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- 9. Esquema de Vacunación (Específico de Pediatría)
CREATE TABLE IF NOT EXISTS esquema_vacunacion (
    id_vacuna INT AUTO_INCREMENT PRIMARY KEY,
    id_historial INT NOT NULL,
    nombre_vacuna VARCHAR(100) NOT NULL,
    numero_dosis VARCHAR(20) NOT NULL,
    lote VARCHAR(50),
    fecha_programada DATE NOT NULL,
    fecha_aplicacion DATE,
    estado ENUM('pendiente', 'aplicada', 'atrasada') NOT NULL DEFAULT 'pendiente',
    CONSTRAINT fk_vacunacion_historial
        FOREIGN KEY (id_historial) REFERENCES historial_clinico (id_historial)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Antecedentes y Alergias
CREATE TABLE IF NOT EXISTS antecedente_alergia (
    id_antecedente INT AUTO_INCREMENT PRIMARY KEY,
    id_historial INT NOT NULL,
    tipo ENUM('patologico', 'alergico', 'quirurgico', 'familiar') NOT NULL,
    descripcion TEXT NOT NULL,
    gravedad VARCHAR(30),
    fecha_registro DATE NOT NULL DEFAULT (CURRENT_DATE),
    CONSTRAINT fk_antecedente_historial
        FOREIGN KEY (id_historial) REFERENCES historial_clinico (id_historial)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Diagnósticos de la Consulta
CREATE TABLE IF NOT EXISTS diagnostico_pediatrico (
    id_diagnostico INT AUTO_INCREMENT PRIMARY KEY,
    id_consulta INT NOT NULL,
    codigo_cie VARCHAR(10) NOT NULL,
    descripcion VARCHAR(255) NOT NULL,
    tipo ENUM('presuntivo', 'definitivo') NOT NULL DEFAULT 'presuntivo',
    observaciones TEXT,
    CONSTRAINT fk_diag_consulta
        FOREIGN KEY (id_consulta) REFERENCES consulta_pediatrica (id_consulta)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. Tratamientos y Procedimientos
CREATE TABLE IF NOT EXISTS tratamiento_pediatrico (
    id_tratamiento INT AUTO_INCREMENT PRIMARY KEY,
    id_consulta INT NOT NULL,
    nombre_procedimiento VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_realizacion DATE NOT NULL,
    resultado TEXT,
    CONSTRAINT fk_trat_consulta
        FOREIGN KEY (id_consulta) REFERENCES consulta_pediatrica (id_consulta)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Prescripción y Receta
CREATE TABLE IF NOT EXISTS receta_prescripcion (
    id_receta INT AUTO_INCREMENT PRIMARY KEY,
    id_consulta INT NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT (CURRENT_DATE),
    indicaciones_generales TEXT,
    CONSTRAINT fk_receta_consulta
        FOREIGN KEY (id_consulta) REFERENCES consulta_pediatrica (id_consulta)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- 14. Detalle de Medicamentos
CREATE TABLE IF NOT EXISTS receta_detalle (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_receta INT NOT NULL,
    medicamento VARCHAR(150) NOT NULL,
    dosis VARCHAR(50) NOT NULL,
    frecuencia VARCHAR(50) NOT NULL,
    duracion VARCHAR(50) NOT NULL,
    CONSTRAINT fk_detalle_receta
        FOREIGN KEY (id_receta) REFERENCES receta_prescripcion (id_receta)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

