BEGIN;
ALTER TABLE hospital.pago ADD COLUMN IF NOT EXISTS id_hospitalizacion bigint REFERENCES hospital.hospitalizacion;
UPDATE hospital.pago p SET id_hospitalizacion=f.id_hospitalizacion
FROM hospital.factura f WHERE f.id_factura=p.id_factura AND p.id_hospitalizacion IS NULL;
ALTER TABLE hospital.pago ALTER COLUMN id_hospitalizacion SET NOT NULL;
ALTER TABLE hospital.pago ALTER COLUMN id_factura DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pago_solicitud_ingreso ON hospital.pago(id_hospitalizacion,solicitud);
COMMIT;
