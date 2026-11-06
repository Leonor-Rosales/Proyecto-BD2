BEGIN;
ALTER TABLE hospital.paciente ADD COLUMN IF NOT EXISTS motivo_baja text;
ALTER TABLE hospital.paciente ADD COLUMN IF NOT EXISTS fecha_baja timestamptz;
COMMIT;
