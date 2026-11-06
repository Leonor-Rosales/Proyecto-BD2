BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS cita_medico_hora_programada
ON hospital.cita_medica (id_personal, fecha_hora) WHERE estado_cita = 'programada';
CREATE UNIQUE INDEX IF NOT EXISTS cita_paciente_hora_programada
ON hospital.cita_medica (id_paciente, fecha_hora) WHERE estado_cita = 'programada';
COMMIT;
