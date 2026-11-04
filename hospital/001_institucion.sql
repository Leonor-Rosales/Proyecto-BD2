CREATE SCHEMA hospital;
CREATE TABLE hospital.institucion (
    id_institucion BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo_institucion VARCHAR(50) NOT NULL,
    direccion VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    horario_atencion VARCHAR(100)
);
INSERT INTO hospital.institucion (nombre, tipo_institucion, direccion)
VALUES ('Hospital General de Prueba', 'Hospital', 'Dirección ficticia');
