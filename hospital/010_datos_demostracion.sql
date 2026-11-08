DO $$
DECLARE
    paciente_demo bigint;
    historial_demo bigint;
    consulta_demo bigint;
    receta_demo bigint;
    medico_demo bigint;
BEGIN
    SELECT id_personal INTO STRICT medico_demo FROM hospital.personal_medico
    WHERE dpi_cui = 'DEMO-MED-001';

    INSERT INTO hospital.paciente (id_institucion, nombres, apellidos, dpi_cui, fecha_nacimiento)
    SELECT id_institucion, 'Paciente', 'Demostración Hospital', 'BD2-DEMO-ENTREGA', DATE '2000-05-12'
    FROM hospital.personal_medico WHERE id_personal = medico_demo
    ON CONFLICT (dpi_cui) DO NOTHING RETURNING id_paciente INTO paciente_demo;
    IF paciente_demo IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO hospital.historial_clinico (id_paciente) VALUES (paciente_demo)
    RETURNING id_historial INTO historial_demo;
    INSERT INTO hospital.consulta_medica (id_historial, id_personal, motivo_consulta, notas_evolucion)
    VALUES (historial_demo, medico_demo, 'Consulta de demostración', 'Caso ficticio para la entrega.')
    RETURNING id_consulta INTO consulta_demo;
    INSERT INTO hospital.diagnostico (id_consulta, codigo_cie, descripcion, tipo)
    VALUES (consulta_demo, 'R51', 'Cefalea de ejemplo', 'presuntivo');
    INSERT INTO hospital.tratamiento_procedimiento (id_consulta, nombre_procedimiento, fecha_realizacion)
    VALUES (consulta_demo, 'Observación de ejemplo', CURRENT_DATE);
    INSERT INTO hospital.receta_prescripcion (id_consulta) VALUES (consulta_demo)
    RETURNING id_receta INTO receta_demo;
    INSERT INTO hospital.receta_detalle (id_receta, medicamento, dosis, frecuencia, duracion)
    VALUES (receta_demo, 'Medicamento ficticio A', '1 unidad', 'Cada 24 horas', '3 días');
END;
$$;
