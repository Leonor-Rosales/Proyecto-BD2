-- =====================================================================
-- Centro Médico Pediátrico - Datos Iniciales y de Prueba (MySQL 8)
-- =====================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

USE centro_pediatrico;

-- 1. Institución
INSERT INTO institucion (id_institucion, nombre, direccion, telefono, horario_atencion)
VALUES (1, 'Centro Médico Pediátrico Integral', '12 Calle 5-43 Zona 3, Quetzaltenango', '7765-4321', 'Lunes a Viernes 08:00 - 18:00, Sábados 08:00 - 13:00')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- 2. Especialidades
INSERT INTO especialidad (id_especialidad, nombre_especialidad, descripcion)
VALUES 
  (1, 'Pediatría General', 'Atención integral del crecimiento y desarrollo del niño y adolescente'),
  (2, 'Neonatología', 'Cuidado y seguimiento del recién nacido y prematuro')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- 3. Personal Pediátrico (Pediatra y Secretaría)
INSERT INTO personal_pediatrico (id_personal, id_institucion, id_especialidad, nombres, apellidos, dpi_cui, num_colegiado, telefono, correo_electronico, rol, fecha_contratacion, estado)
VALUES 
  (1, 1, 1, 'Josué André', 'Menéndez Juárez', '2589631470101', 'COL-PED-1511', '5551-2345', 'josue.pediatria@redclinica.local', 'pediatra', '2024-01-15', 'activo'),
  (2, 1, NULL, 'Sofía Lorena', 'Morales Paz', '1478523690101', NULL, '5559-8765', 'secretaria.pediatria@redclinica.local', 'secretaria', '2024-03-01', 'activo')
ON DUPLICATE KEY UPDATE nombres = VALUES(nombres);

-- 4. Paciente Menor de Edad
INSERT INTO paciente (id_paciente, id_institucion, nombres, apellidos, dpi_cui, fecha_nacimiento, genero, direccion, telefono, correo_electronico, contacto_emergencia_nombre, contacto_emergencia_telefono, estado)
VALUES (
  1, 1, 'Mateo Alexander', 'Gómez Morales', NULL, '2025-05-10', 'Masculino',
  '7ma Avenida 3-21 Zona 1, Quetzaltenango', '5554-1122', 'contacto.padres@ejemplo.com',
  'Carlos Gómez (Padre)', '5554-1122', 'activo'
)
ON DUPLICATE KEY UPDATE nombres = VALUES(nombres);

-- 5. Historial Clínico
INSERT INTO historial_clinico (id_historial, id_paciente, fecha_apertura, observaciones_generales)
VALUES (1, 1, '2025-05-15', 'Paciente recién nacido ingresado a control de niño sano y esquema vacunal completo.')
ON DUPLICATE KEY UPDATE observaciones_generales = VALUES(observaciones_generales);

-- 6. Antecedente / Alergia
INSERT INTO antecedente_alergia (id_antecedente, id_historial, tipo, descripcion, gravedad, fecha_registro)
VALUES (1, 1, 'alergico', 'Reacción alérgica cutánea a amoxicilina con ácido clavulánico', 'moderada', '2025-08-20')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- 7. Citas Médicas (Una atendida y una programada futura)
INSERT INTO cita_medica (id_cita, id_paciente, id_personal, id_institucion, fecha_hora, motivo, estado_cita)
VALUES 
  (1, 1, 1, 1, '2026-02-10 09:30:00', 'Control de crecimiento y desarrollo - 9 meses', 'atendida'),
  (2, 1, 1, 1, '2027-05-10 10:00:00', 'Control de niño sano al año de edad', 'programada')
ON DUPLICATE KEY UPDATE motivo = VALUES(motivo);

-- 8. Consulta Pediátrica vinculada a la cita 1
INSERT INTO consulta_pediatrica (id_consulta, id_cita, id_historial, id_personal, fecha, tipo_consulta, motivo_consulta, notas_evolucion)
VALUES (
  1, 1, 1, 1, '2026-02-10 09:45:00', 'control_nino_sano',
  'Control de crecimiento y desarrollo - 9 meses',
  'Lactante activo y reactivo. Adecuada ganancia ponderal. Se indica inicio de alimentación complementaria etapa 2.'
)
ON DUPLICATE KEY UPDATE motivo_consulta = VALUES(motivo_consulta);

-- 9. Control de Crecimiento
INSERT INTO control_crecimiento (id_control, id_historial, id_consulta, fecha_control, peso_kg, talla_cm, perimetro_cefalico_cm, percentil_observado)
VALUES (1, 1, 1, '2026-02-10', 8.95, 71.50, 44.80, 'P50 (OMS)')
ON DUPLICATE KEY UPDATE peso_kg = VALUES(peso_kg);

-- 10. Esquema de Vacunación (Una aplicada y una pendiente)
INSERT INTO esquema_vacunacion (id_vacuna, id_historial, nombre_vacuna, numero_dosis, lote, fecha_programada, fecha_aplicacion, estado)
VALUES 
  (1, 1, 'Pentavalente (DTP-HB-Hib)', '3ra dosis', 'LOTE-VAC-8841', '2026-01-10', '2026-01-12', 'aplicada'),
  (2, 1, 'Triple Viral (SPR)', '1ra dosis', NULL, '2026-05-10', NULL, 'pendiente')
ON DUPLICATE KEY UPDATE nombre_vacuna = VALUES(nombre_vacuna);

-- 11. Diagnóstico
INSERT INTO diagnostico_pediatrico (id_diagnostico, id_consulta, codigo_cie, descripcion, tipo, observaciones)
VALUES (1, 1, 'Z00.1', 'Control de salud de rutina del niño sano', 'definitivo', 'Crecimiento y desarrollo acorde a la edad cronológica.')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- 12. Tratamiento / Procedimiento
INSERT INTO tratamiento_pediatrico (id_tratamiento, id_consulta, nombre_procedimiento, descripcion, fecha_realizacion, resultado)
VALUES (1, 1, 'Evaluación de Neurodesarrollo', 'Test estandarizado de hitos motores y de lenguaje para 9 meses', '2026-02-10', 'Hitos motores adecuados: sedestación firme y gateo inicial.')
ON DUPLICATE KEY UPDATE nombre_procedimiento = VALUES(nombre_procedimiento);

-- 13. Receta Médica y Detalle
INSERT INTO receta_prescripcion (id_receta, id_consulta, fecha_emision, indicaciones_generales)
VALUES (1, 1, '2026-02-10', 'Administrar suplementos con los alimentos de la mañana.')
ON DUPLICATE KEY UPDATE indicaciones_generales = VALUES(indicaciones_generales);

INSERT INTO receta_detalle (id_detalle, id_receta, medicamento, dosis, frecuencia, duracion)
VALUES 
  (1, 1, 'Vitamina D3 gotas 400 UI/gota', '1 gota (400 UI)', 'Cada 24 horas', '3 meses'),
  (2, 1, 'Hierro polimaltosado gotas', '8 gotas', 'Cada 24 horas', '2 meses')
ON DUPLICATE KEY UPDATE medicamento = VALUES(medicamento);

