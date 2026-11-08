BEGIN;
CREATE TABLE IF NOT EXISTS hospital.tarifa_estancia (
    tipo_unidad varchar(30) PRIMARY KEY,
    tarifa_diaria numeric(10,2) NOT NULL CHECK (tarifa_diaria > 0)
);
-- Importes ficticios de demostración, editables en el catálogo.
INSERT INTO hospital.tarifa_estancia VALUES
    ('normal',240), ('UCI',960), ('urgencias',480), ('pediatria',360)
ON CONFLICT DO NOTHING;

ALTER TABLE hospital.estancia ADD COLUMN IF NOT EXISTS tarifa_diaria numeric(10,2)
    CHECK (tarifa_diaria > 0);

CREATE OR REPLACE VIEW hospital.cobro_estancia AS
SELECT e.id_estancia, e.id_hospitalizacion, h.numero, e.fecha_inicio, e.fecha_fin,
       e.tarifa_diaria, round(e.tarifa_diaria * greatest(0,extract(epoch FROM
       (coalesce(e.fecha_fin,statement_timestamp())-e.fecha_inicio))) / 86400,2) AS importe
FROM hospital.estancia e JOIN hospital.habitacion h USING (id_habitacion)
WHERE e.tarifa_diaria IS NOT NULL;

CREATE OR REPLACE VIEW hospital.importes_ingreso AS
SELECT id_hospitalizacion,round(cantidad*precio_unitario,2) AS importe
FROM hospital.cargo_hospitalizacion
UNION ALL SELECT id_hospitalizacion,importe FROM hospital.cobro_estancia;

-- Tarifa ficticia inicial por visita de un médico durante una hospitalización.
ALTER TABLE hospital.personal_medico ADD COLUMN IF NOT EXISTS tarifa_visita numeric(10,2)
    NOT NULL DEFAULT 100 CHECK (tarifa_visita >= 0);
ALTER TABLE hospital.cargo_hospitalizacion ADD COLUMN IF NOT EXISTS id_consulta bigint
    UNIQUE REFERENCES hospital.consulta_medica(id_consulta);
ALTER TABLE hospital.consulta_medica ADD COLUMN IF NOT EXISTS solicitud uuid;
CREATE UNIQUE INDEX IF NOT EXISTS consulta_por_solicitud ON hospital.consulta_medica(id_historial,solicitud);
CREATE TABLE IF NOT EXISTS hospital.procedimiento_catalogo (
    id_procedimiento bigserial PRIMARY KEY,
    nombre varchar(150) NOT NULL,
    precio numeric(10,2) NOT NULL CHECK (precio >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS procedimiento_nombre_unico ON hospital.procedimiento_catalogo(lower(nombre));
INSERT INTO hospital.procedimiento_catalogo(nombre,precio) VALUES ('Curación simple',50),('Retiro de puntos',75)
ON CONFLICT DO NOTHING;
ALTER TABLE hospital.cargo_hospitalizacion ADD COLUMN IF NOT EXISTS id_tratamiento bigint
    UNIQUE REFERENCES hospital.tratamiento_procedimiento(id_tratamiento);
COMMIT;
