BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS hospitalizacion_activa_por_historial
ON hospital.hospitalizacion (id_historial) WHERE estado='internado';
CREATE UNIQUE INDEX IF NOT EXISTS estancia_abierta_por_ingreso
ON hospital.estancia (id_hospitalizacion) WHERE fecha_fin IS NULL;

INSERT INTO hospital.habitacion (id_institucion, numero, tipo_unidad, piso, capacidad)
SELECT i.id_institucion, s.numero, s.unidad, s.piso, s.camas
FROM hospital.institucion i
CROSS JOIN (VALUES ('N-101','normal','1',2), ('UCI-201','UCI','2',1),
                  ('URG-01','urgencias','1',2), ('PED-301','pediatria','3',2))
AS s(numero,unidad,piso,camas)
WHERE i.nombre='Hospital General de Prueba' AND NOT EXISTS (
    SELECT 1 FROM hospital.habitacion h WHERE h.id_institucion=i.id_institucion AND h.numero=s.numero
);
COMMIT;
