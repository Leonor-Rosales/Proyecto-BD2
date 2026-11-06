BEGIN;
INSERT INTO hospital.tipo_cargo(nombre_cargo)
VALUES ('material'), ('honorario_medico'), ('medicamento'), ('servicio')
ON CONFLICT (nombre_cargo) DO NOTHING;

INSERT INTO hospital.medicamento(nombre_generico,presentacion,unidad_medida)
SELECT 'Medicamento de prueba','Tableta','unidad'
WHERE NOT EXISTS (SELECT 1 FROM hospital.medicamento WHERE nombre_generico='Medicamento de prueba');

CREATE UNIQUE INDEX IF NOT EXISTS factura_por_ingreso ON hospital.factura(id_hospitalizacion);
ALTER TABLE hospital.cargo_hospitalizacion ADD COLUMN IF NOT EXISTS solicitud uuid;
ALTER TABLE hospital.pago ADD COLUMN IF NOT EXISTS solicitud uuid;
CREATE UNIQUE INDEX IF NOT EXISTS cargo_por_solicitud ON hospital.cargo_hospitalizacion(id_hospitalizacion, solicitud);
CREATE UNIQUE INDEX IF NOT EXISTS pago_por_solicitud ON hospital.pago(id_factura, solicitud);
COMMIT;
