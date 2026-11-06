BEGIN;
ALTER TABLE hospital.medicamento ADD COLUMN IF NOT EXISTS precio_unitario numeric(10,2) CHECK (precio_unitario>0);
CREATE UNIQUE INDEX IF NOT EXISTS habitacion_numero_sede ON hospital.habitacion(id_institucion,lower(trim(numero)));
ALTER TABLE hospital.cargo_hospitalizacion ADD COLUMN IF NOT EXISTS administrado boolean NOT NULL DEFAULT false;
COMMIT;
