BEGIN;

CREATE TABLE IF NOT EXISTS hospital.cita_medica (
    id_cita bigserial PRIMARY KEY,
    id_paciente bigint NOT NULL REFERENCES hospital.paciente (id_paciente),
    id_personal bigint NOT NULL REFERENCES hospital.personal_medico (id_personal),
    id_institucion bigint NOT NULL REFERENCES hospital.institucion (id_institucion),
    fecha_hora timestamptz NOT NULL,
    motivo varchar(255),
    estado_cita varchar(20) NOT NULL DEFAULT 'programada' CHECK (estado_cita IN ('programada','atendida','cancelada','no_asistio'))
);

CREATE TABLE IF NOT EXISTS hospital.antecedente_alergia (
    id_antecedente bigserial PRIMARY KEY,
    id_historial bigint NOT NULL REFERENCES hospital.historial_clinico (id_historial),
    tipo varchar(20) NOT NULL CHECK (tipo IN ('patologico','alergico','quirurgico','familiar')),
    descripcion text NOT NULL,
    gravedad varchar(30),
    fecha_registro date NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS hospital.consulta_medica (
    id_consulta bigserial PRIMARY KEY,
    id_cita bigint REFERENCES hospital.cita_medica (id_cita),
    id_historial bigint NOT NULL REFERENCES hospital.historial_clinico (id_historial),
    id_personal bigint NOT NULL REFERENCES hospital.personal_medico (id_personal),
    fecha timestamptz NOT NULL DEFAULT now(),
    motivo_consulta text NOT NULL,
    signos_vitales jsonb,
    notas_evolucion text
);

CREATE TABLE IF NOT EXISTS hospital.diagnostico (
    id_diagnostico bigserial PRIMARY KEY,
    id_consulta bigint NOT NULL REFERENCES hospital.consulta_medica (id_consulta),
    codigo_cie varchar(10) NOT NULL,
    descripcion varchar(255) NOT NULL,
    tipo varchar(20) NOT NULL CHECK (tipo IN ('presuntivo','definitivo')),
    observaciones text
);

CREATE TABLE IF NOT EXISTS hospital.tratamiento_procedimiento (
    id_tratamiento bigserial PRIMARY KEY,
    id_consulta bigint NOT NULL REFERENCES hospital.consulta_medica (id_consulta),
    nombre_procedimiento varchar(150) NOT NULL,
    descripcion text,
    fecha_realizacion date NOT NULL,
    resultado text
);

CREATE TABLE IF NOT EXISTS hospital.receta_prescripcion (
    id_receta bigserial PRIMARY KEY,
    id_consulta bigint NOT NULL REFERENCES hospital.consulta_medica (id_consulta),
    fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
    indicaciones_generales text
);

CREATE TABLE IF NOT EXISTS hospital.receta_detalle (
    id_detalle bigserial PRIMARY KEY,
    id_receta bigint NOT NULL REFERENCES hospital.receta_prescripcion (id_receta),
    medicamento varchar(150) NOT NULL,
    dosis varchar(50) NOT NULL,
    frecuencia varchar(50) NOT NULL,
    duracion varchar(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS hospital.tipo_cargo (
    id_tipo_cargo serial PRIMARY KEY,
    nombre_cargo varchar(100) NOT NULL UNIQUE,
    descripcion text
);

CREATE TABLE IF NOT EXISTS hospital.medicamento (
    id_medicamento bigserial PRIMARY KEY,
    nombre_generico varchar(150) NOT NULL,
    presentacion varchar(50) NOT NULL,
    unidad_medida varchar(30) NOT NULL
);

CREATE TABLE IF NOT EXISTS hospital.habitacion (
    id_habitacion bigserial PRIMARY KEY,
    id_institucion bigint NOT NULL REFERENCES hospital.institucion (id_institucion),
    numero varchar(20) NOT NULL,
    tipo_unidad varchar(30) NOT NULL CHECK (tipo_unidad IN ('UCI','normal','urgencias','pediatria')),
    piso varchar(10),
    capacidad smallint NOT NULL CHECK (capacidad > 0),
    estado varchar(20) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible','ocupada','mantenimiento'))
);

CREATE TABLE IF NOT EXISTS hospital.hospitalizacion (
    id_hospitalizacion bigserial PRIMARY KEY,
    id_historial bigint NOT NULL REFERENCES hospital.historial_clinico (id_historial),
    id_consulta bigint REFERENCES hospital.consulta_medica (id_consulta),
    fecha_ingreso timestamptz NOT NULL DEFAULT now(),
    fecha_alta timestamptz,
    motivo_ingreso text NOT NULL,
    estado varchar(20) NOT NULL DEFAULT 'internado' CHECK (estado IN ('internado','alta','trasladado'))
);

CREATE TABLE IF NOT EXISTS hospital.estancia (
    id_estancia bigserial PRIMARY KEY,
    id_hospitalizacion bigint NOT NULL REFERENCES hospital.hospitalizacion (id_hospitalizacion),
    id_habitacion bigint NOT NULL REFERENCES hospital.habitacion (id_habitacion),
    fecha_inicio timestamptz NOT NULL,
    fecha_fin timestamptz
);

CREATE TABLE IF NOT EXISTS hospital.cargo_hospitalizacion (
    id_cargo bigserial PRIMARY KEY,
    id_hospitalizacion bigint NOT NULL REFERENCES hospital.hospitalizacion (id_hospitalizacion),
    id_tipo_cargo integer NOT NULL REFERENCES hospital.tipo_cargo (id_tipo_cargo),
    id_medicamento bigint REFERENCES hospital.medicamento (id_medicamento),
    id_personal bigint REFERENCES hospital.personal_medico (id_personal),
    descripcion varchar(255),
    cantidad numeric(10,2) NOT NULL,
    precio_unitario numeric(10,2) NOT NULL,
    fecha_cargo timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital.factura (
    id_factura bigserial PRIMARY KEY,
    id_hospitalizacion bigint NOT NULL REFERENCES hospital.hospitalizacion (id_hospitalizacion),
    fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
    monto_total numeric(10,2) NOT NULL,
    estado_pago varchar(20) NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','pagada','parcial'))
);

CREATE TABLE IF NOT EXISTS hospital.pago (
    id_pago bigserial PRIMARY KEY,
    id_factura bigint NOT NULL REFERENCES hospital.factura (id_factura),
    fecha_pago timestamptz NOT NULL DEFAULT now(),
    monto numeric(10,2) NOT NULL,
    metodo_pago varchar(30) NOT NULL CHECK (metodo_pago IN ('efectivo','tarjeta','seguro')),
    referencia varchar(100)
);

COMMIT;
