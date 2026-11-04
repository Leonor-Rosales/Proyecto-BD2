import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

const postgres = new pg.Pool({
  host: '127.0.0.1', port: 55432, database: 'hospital_general',
  user: 'postgres', password: process.env.HOSPITAL_PASSWORD,
  connectionTimeoutMillis: 5000
});
const mongo = new MongoClient('mongodb://127.0.0.1:57017', {
  auth: { username: 'maria_admin', password: process.env.LAB_PASSWORD },
  authSource: 'admin', serverSelectionTimeoutMS: 5000
});

export async function altaHospital({ nombres, apellidos, fecha_nacimiento }) {
  const { rows } = await postgres.query(`
    WITH paciente AS (
      INSERT INTO hospital.paciente (id_institucion, nombres, apellidos, fecha_nacimiento)
      VALUES ((SELECT id_institucion FROM hospital.institucion WHERE nombre = $1), $2, $3, $4)
      RETURNING id_paciente
    )
    INSERT INTO hospital.historial_clinico (id_paciente)
    SELECT id_paciente FROM paciente RETURNING id_paciente::text AS id`,
    ['Hospital General de Prueba', nombres, apellidos, fecha_nacimiento]);
  return rows[0].id;
}

export async function altaLaboratorio(datos) {
  const id = 'PAC-' + randomUUID();
  await mongo.db('laboratorio_clinico').collection('pacientes').insertOne({
    _id: id, ...datos, fecha_apertura: new Date()
  });
  return id;
}

export async function historialHospital(id) {
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) return null;
  const { rows } = await postgres.query(`
    SELECT p.id_paciente::text AS id, p.nombres, p.apellidos,
           ARRAY(SELECT jsonb_build_object(
             'id', c.id_consulta::text, 'fecha', c.fecha, 'motivo', c.motivo_consulta,
             'notas', c.notas_evolucion, 'signos_vitales', c.signos_vitales,
             'diagnosticos', ARRAY(SELECT to_jsonb(d) FROM hospital.diagnostico d
               WHERE d.id_consulta = c.id_consulta ORDER BY d.id_diagnostico),
             'tratamientos', ARRAY(SELECT to_jsonb(t) FROM hospital.tratamiento_procedimiento t
               WHERE t.id_consulta = c.id_consulta ORDER BY t.id_tratamiento),
             'recetas', ARRAY(SELECT to_jsonb(r) || jsonb_build_object('medicamentos',
               ARRAY(SELECT to_jsonb(m) FROM hospital.receta_detalle m
                 WHERE m.id_receta = r.id_receta ORDER BY m.id_detalle))
               FROM hospital.receta_prescripcion r WHERE r.id_consulta = c.id_consulta
               ORDER BY r.id_receta))
             FROM hospital.consulta_medica c WHERE c.id_historial = h.id_historial
             ORDER BY c.fecha DESC, c.id_consulta DESC) AS consultas
    FROM hospital.paciente p JOIN hospital.historial_clinico h USING (id_paciente)
    WHERE p.id_paciente = $1`, [id]);
  if (!rows.length) return null;
  const { consultas, ...paciente } = rows[0];
  return { paciente, consultas, examenes: [] };
}

export async function historialLaboratorio(id) {
  const db = mongo.db('laboratorio_clinico');
  const paciente = await db.collection('pacientes').findOne({ _id: id });
  if (!paciente) return null;
  const examenes = await db.collection('examenes').find({ paciente_id: id }).sort({ _id: 1 }).toArray();
  return {
    paciente: { id, nombres: paciente.nombres, apellidos: paciente.apellidos },
    consultas: [], examenes
  };
}
