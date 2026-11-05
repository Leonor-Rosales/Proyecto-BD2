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
    consultas: (paciente.consultas || []).slice().reverse(), examenes
  };
}

export async function medicosHospital() {
  const { rows } = await postgres.query(`
    SELECT id_personal::text AS id, nombres, apellidos FROM hospital.personal_medico
    WHERE estado = 'activo' AND rol IN ('medico','especialista') ORDER BY apellidos, nombres`);
  return rows;
}

export async function consultaHospital(id, atencion) {
  const cliente = await postgres.connect();
  try {
    await cliente.query('BEGIN');
    const { rows } = await cliente.query(`
      INSERT INTO hospital.consulta_medica (id_historial,id_personal,motivo_consulta,notas_evolucion,signos_vitales)
      SELECT h.id_historial,m.id_personal,$3,$4,$5 FROM hospital.historial_clinico h
      JOIN hospital.paciente p USING (id_paciente)
      JOIN hospital.personal_medico m ON m.id_institucion=p.id_institucion
      WHERE p.id_paciente::text=$1 AND p.estado='activo' AND m.id_personal::text=$2
        AND m.estado='activo' AND m.rol IN ('medico','especialista')
      RETURNING id_consulta AS id`, [id, atencion.id_personal, atencion.motivo, atencion.notas, atencion.signos_vitales]);
    if (!rows.length) throw Object.assign(new Error('Verifica el paciente y el médico activo.'), { status: 422 });
    const consulta = rows[0].id;
    for (const d of atencion.diagnosticos) {
      await cliente.query('INSERT INTO hospital.diagnostico (id_consulta,codigo_cie,descripcion,tipo) VALUES ($1,$2,$3,$4)',
        [consulta, d.codigo_cie, d.descripcion, d.tipo]);
    }
    for (const t of atencion.tratamientos) {
      await cliente.query('INSERT INTO hospital.tratamiento_procedimiento (id_consulta,nombre_procedimiento,fecha_realizacion) VALUES ($1,$2,CURRENT_DATE)',
        [consulta, t.nombre_procedimiento]);
    }
    for (const r of atencion.recetas) {
      const receta = await cliente.query('INSERT INTO hospital.receta_prescripcion (id_consulta) VALUES ($1) RETURNING id_receta', [consulta]);
      for (const m of r.medicamentos) {
        await cliente.query('INSERT INTO hospital.receta_detalle (id_receta,medicamento,dosis,frecuencia,duracion) VALUES ($1,$2,$3,$4,$5)',
          [receta.rows[0].id_receta, m.medicamento, m.dosis, m.frecuencia, m.duracion]);
      }
    }
    await cliente.query('COMMIT');
    return consulta;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export async function consultaLaboratorio(id, atencion) {
  const consulta = { ...atencion, id: randomUUID(), fecha: new Date() };
  const result = await mongo.db('laboratorio_clinico').collection('pacientes')
    .updateOne({ _id: id }, { $push: { consultas: consulta } });
  return result.matchedCount ? consulta.id : null;
}

export async function examenLaboratorio(paciente_id, examen) {
  const db = mongo.db('laboratorio_clinico');
  if (!await db.collection('pacientes').findOne({ _id: paciente_id }, { projection: { _id: 1 } })) return null;
  const _id = 'EX-' + randomUUID();
  await db.collection('examenes').insertOne({ _id, paciente_id, ...examen, fecha: new Date() });
  return _id;
}
