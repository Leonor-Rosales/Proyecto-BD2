import pg from 'pg';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { Firestore } from '@google-cloud/firestore';

export const postgres = new pg.Pool({
  host: '127.0.0.1', port: 55432, database: 'hospital_general',
  user: 'postgres', password: process.env.HOSPITAL_PASSWORD,
  connectionTimeoutMillis: 5000
});
export const mongo = new MongoClient('mongodb://127.0.0.1:57017', {
  auth: { username: 'maria_admin', password: process.env.LAB_PASSWORD },
  authSource: 'admin', serverSelectionTimeoutMS: 5000
});

export const mysqlPediatria = mysql.createPool({
  host: '127.0.0.1', port: 33060, database: 'centro_pediatrico',
  user: process.env.PEDIATRIA_USER || 'josue_pediatra',
  password: process.env.PEDIATRIA_PASSWORD || '',
  waitForConnections: true, connectionLimit: 10, queueLimit: 0,
  charset: 'utf8mb4'
});

export const firestoreOdontologia = new Firestore({
  projectId: process.env.FIREBASE_PROJECT_ID || 'clinica-odontologica',
  ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : {
    host: '127.0.0.1:8080',
    ssl: false
  })
});

export async function altaHospital(datos) {
  const campos=Object.keys(datos);
  const { rows } = await postgres.query(`
    WITH paciente AS (
      INSERT INTO hospital.paciente (id_institucion, ${campos.join(',')})
      VALUES ((SELECT id_institucion FROM hospital.institucion WHERE nombre = $1), ${campos.map((_,i)=>'$'+(i+2)).join(',')})
      RETURNING id_paciente
    )
    INSERT INTO hospital.historial_clinico (id_paciente)
    SELECT id_paciente FROM paciente RETURNING id_paciente::text AS id`,
    ['Hospital General de Prueba', ...Object.values(datos)]);
  return rows[0].id;
}

export async function altaLaboratorio(datos) {
  const id = 'PAC-' + randomUUID();
  await mongo.db('laboratorio_clinico').collection('pacientes').insertOne({
    _id: id, ...datos, estado:'activo', fecha_apertura: new Date()
  });
  return id;
}

export async function historialHospital(id) {
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) return null;
  const { rows } = await postgres.query(`
    SELECT p.id_paciente::text AS id, p.nombres, p.apellidos,
           ARRAY(SELECT jsonb_build_object(
             'id', c.id_consulta::text, 'id_cita', c.id_cita::text, 'fecha', c.fecha, 'motivo', c.motivo_consulta,
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
             ORDER BY c.fecha DESC, c.id_consulta DESC) AS consultas,
           ARRAY(SELECT to_jsonb(a) FROM hospital.antecedente_alergia a WHERE a.id_historial=h.id_historial ORDER BY a.id_antecedente DESC) AS antecedentes,
           ARRAY(SELECT jsonb_build_object('id',c.id_cita::text,'medico',m.nombres||' '||m.apellidos,'id_personal',m.id_personal::text,
             'fecha',c.fecha_hora,'estado',c.estado_cita,'motivo',c.motivo) FROM hospital.cita_medica c JOIN hospital.personal_medico m USING(id_personal)
             WHERE c.id_paciente=p.id_paciente ORDER BY c.fecha_hora DESC) AS citas
    FROM hospital.paciente p JOIN hospital.historial_clinico h USING (id_paciente)
    WHERE p.id_paciente = $1`, [id]);
  if (!rows.length) return null;
  const { consultas, antecedentes, citas, ...paciente } = rows[0];
  return { paciente, consultas, antecedentes, citas, examenes: [] };
}

export async function historialLaboratorio(id) {
  const db = mongo.db('laboratorio_clinico');
  const paciente = await db.collection('pacientes').findOne({ _id: id });
  if (!paciente) return null;
  const examenes = await db.collection('examenes').find({ paciente_id: id }).sort({ _id: 1 }).toArray();
  return {
    paciente: { id, nombres: paciente.nombres, apellidos: paciente.apellidos, estado:paciente.estado||'activo' },
    consultas: (paciente.consultas || []).slice().reverse(), examenes:[...examenes,...(paciente.examenes || [])]
  };
}

export async function medicosHospital() {
  const { rows } = await postgres.query(`
    SELECT id_personal::text AS id, nombres, apellidos, nombre_especialidad AS especialidad FROM hospital.personal_medico
    LEFT JOIN hospital.especialidad USING(id_especialidad)
    WHERE estado = 'activo' AND rol IN ('medico','especialista') ORDER BY apellidos, nombres`);
  return rows;
}

export async function buscarHospital(termino) {
  const { rows } = await postgres.query(`
    SELECT id_paciente::text AS id, nombres, apellidos FROM hospital.paciente
    WHERE strpos(lower(nombres || ' ' || apellidos), lower($1)) > 0 OR id_paciente::text = $1
    ORDER BY apellidos, nombres, id_paciente LIMIT 25`, [termino]);
  return rows;
}

export async function buscarLaboratorio(termino) {
  const pacientes = mongo.db('laboratorio_clinico').collection('pacientes');
  return pacientes.aggregate([
    { $match: { $or: [{ _id: termino }, { $expr: { $gte: [
      { $indexOfCP: [{ $toLower: { $concat: ['$nombres', ' ', '$apellidos'] } }, { $literal: termino.toLowerCase() }] }, 0
    ] } }] } },
    { $sort: { apellidos: 1, nombres: 1, _id: 1 } }, { $limit: 25 },
    { $project: { id: '$_id', nombres: 1, apellidos: 1, _id: 0 } }
  ]).toArray();
}

export async function consultaHospital(id, atencion) {
  const cliente = await postgres.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SELECT id_paciente FROM hospital.paciente WHERE id_paciente::text=$1 FOR UPDATE',[id]);
    if (atencion.id_cita) {
      const cita = await cliente.query(`UPDATE hospital.cita_medica SET estado_cita='atendida'
        WHERE id_cita::text=$1 AND id_paciente::text=$2 AND id_personal::text=$3 AND estado_cita='programada'`,
        [atencion.id_cita,id,atencion.id_personal]);
      if (!cita.rowCount) throw Object.assign(new Error('La cita ya no está disponible para este paciente y médico.'), { status: 409 });
    }
    const { rows } = await cliente.query(`
      INSERT INTO hospital.consulta_medica (id_historial,id_personal,motivo_consulta,notas_evolucion,signos_vitales,id_cita)
      SELECT h.id_historial,m.id_personal,$3,$4,$5,$6 FROM hospital.historial_clinico h
      JOIN hospital.paciente p USING (id_paciente)
      JOIN hospital.personal_medico m ON m.id_institucion=p.id_institucion
      WHERE p.id_paciente::text=$1 AND p.estado='activo' AND m.id_personal::text=$2
        AND m.estado='activo' AND m.rol IN ('medico','especialista')
      RETURNING id_consulta AS id`, [id, atencion.id_personal, atencion.motivo, atencion.notas, atencion.signos_vitales, atencion.id_cita]);
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
    .updateOne({ _id: id,estado:{$nin:['baja','inactivo']} }, { $push: { consultas: consulta } });
  if (!result.matchedCount && await mongo.db('laboratorio_clinico').collection('pacientes').findOne({_id:id})) {
    throw Object.assign(new Error('El expediente está archivado o inactivo.'),{status:409});
  }
  return result.matchedCount ? consulta.id : null;
}

export async function examenLaboratorio(paciente_id, examen) {
  const db = mongo.db('laboratorio_clinico');
  const _id = 'EX-' + randomUUID();
  const resultado=await db.collection('pacientes').updateOne(
    {_id:paciente_id,estado:{$nin:['baja','inactivo']}},
    {$push:{examenes:{_id,paciente_id,...examen,fecha:new Date()}}});
  if (!resultado.matchedCount) {
    if (await db.collection('pacientes').findOne({_id:paciente_id},{projection:{_id:1}})) throw Object.assign(new Error('El expediente está archivado o inactivo.'),{status:409});
    return null;
  }
  return _id;
}

export async function altaPediatria(datos) {
  const conn = await mysqlPediatria.getConnection();
  try {
    await conn.beginTransaction();
    const [inst] = await conn.execute('SELECT id_institucion FROM institucion LIMIT 1');
    const idInstitucion = inst[0]?.id_institucion || 1;

    const campos = ['id_institucion', 'nombres', 'apellidos', 'fecha_nacimiento'];
    const valores = [idInstitucion, datos.nombres, datos.apellidos, datos.fecha_nacimiento];

    const opcionales = ['dpi_cui', 'genero', 'direccion', 'telefono', 'correo_electronico', 'contacto_emergencia_nombre', 'contacto_emergencia_telefono'];
    for (const campo of opcionales) {
      if (datos[campo] !== undefined) {
        campos.push(campo);
        valores.push(datos[campo]);
      }
    }

    const [resPaciente] = await conn.execute(
      `INSERT INTO paciente (${campos.join(',')}) VALUES (${campos.map(() => '?').join(',')})`,
      valores
    );
    const idPaciente = resPaciente.insertId;

    await conn.execute(
      'INSERT INTO historial_clinico (id_paciente, fecha_apertura) VALUES (?, CURRENT_DATE())',
      [idPaciente]
    );

    await conn.commit();
    return String(idPaciente);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function historialPediatria(id) {
  if (!/^[1-9]\d{0,18}$/.test(id)) return null;
  const [pacientes] = await mysqlPediatria.execute(
    'SELECT p.id_paciente, p.nombres, p.apellidos, DATE_FORMAT(p.fecha_nacimiento, "%Y-%m-%d") AS fecha_nacimiento, p.genero, p.telefono, p.contacto_emergencia_nombre, p.contacto_emergencia_telefono, h.id_historial FROM paciente p JOIN historial_clinico h ON p.id_paciente = h.id_paciente WHERE p.id_paciente = ?',
    [id]
  );
  if (!pacientes.length) return null;
  const p = pacientes[0];

  const [consultasRaw] = await mysqlPediatria.execute(
    'SELECT c.id_consulta, c.id_cita, c.fecha, c.tipo_consulta, c.motivo_consulta AS motivo, c.notas_evolucion AS notas, c.id_personal FROM consulta_pediatrica c WHERE c.id_historial = ? ORDER BY c.fecha DESC, c.id_consulta DESC',
    [p.id_historial]
  );

  const consultas = [];
  for (const c of consultasRaw) {
    const [diagnosticos] = await mysqlPediatria.execute(
      'SELECT id_diagnostico AS id, codigo_cie, descripcion, tipo, observaciones FROM diagnostico_pediatrico WHERE id_consulta = ? ORDER BY id_diagnostico',
      [c.id_consulta]
    );
    const [tratamientos] = await mysqlPediatria.execute(
      'SELECT id_tratamiento AS id, nombre_procedimiento, descripcion, DATE_FORMAT(fecha_realizacion, "%Y-%m-%d") AS fecha_realizacion, resultado FROM tratamiento_pediatrico WHERE id_consulta = ? ORDER BY id_tratamiento',
      [c.id_consulta]
    );
    const [recetasRaw] = await mysqlPediatria.execute(
      'SELECT id_receta AS id, DATE_FORMAT(fecha_emision, "%Y-%m-%d") AS fecha_emision, indicaciones_generales FROM receta_prescripcion WHERE id_consulta = ? ORDER BY id_receta',
      [c.id_consulta]
    );
    const recetas = [];
    for (const r of recetasRaw) {
      const [medicamentos] = await mysqlPediatria.execute(
        'SELECT id_detalle AS id, medicamento, dosis, frecuencia, duracion FROM receta_detalle WHERE id_receta = ? ORDER BY id_detalle',
        [r.id]
      );
      recetas.push({ ...r, id: String(r.id), medicamentos });
    }
    consultas.push({
      id: String(c.id_consulta),
      id_cita: c.id_cita ? String(c.id_cita) : null,
      id_personal: c.id_personal ? String(c.id_personal) : null,
      fecha: c.fecha,
      tipo_consulta: c.tipo_consulta,
      motivo: c.motivo,
      notas: c.notas,
      diagnosticos,
      tratamientos,
      recetas
    });
  }

  const [citasRaw] = await mysqlPediatria.execute(
    'SELECT c.id_cita, CONCAT(m.nombres, " ", m.apellidos) AS medico, c.id_personal, c.fecha_hora AS fecha, c.estado_cita AS estado, c.motivo FROM cita_medica c JOIN personal_pediatrico m ON c.id_personal = m.id_personal WHERE c.id_paciente = ? ORDER BY c.fecha_hora DESC',
    [p.id_paciente]
  );
  const citas = citasRaw.map(c => ({
    id: String(c.id_cita),
    id_personal: String(c.id_personal),
    medico: c.medico,
    fecha: c.fecha,
    estado: c.estado,
    motivo: c.motivo
  }));

  const [antecedentesRaw] = await mysqlPediatria.execute(
    'SELECT id_antecedente AS id, tipo, descripcion, gravedad, DATE_FORMAT(fecha_registro, "%Y-%m-%d") AS fecha_registro FROM antecedente_alergia WHERE id_historial = ? ORDER BY id_antecedente DESC',
    [p.id_historial]
  );
  const antecedentes = antecedentesRaw.map(a => ({ ...a, id: String(a.id) }));

  const [controlesRaw] = await mysqlPediatria.execute(
    'SELECT id_control AS id, DATE_FORMAT(fecha_control, "%Y-%m-%d") AS fecha, peso_kg, talla_cm, perimetro_cefalico_cm, percentil_observado FROM control_crecimiento WHERE id_historial = ? ORDER BY fecha_control DESC',
    [p.id_historial]
  );
  const controles_crecimiento = controlesRaw.map(c => ({
    ...c,
    id: String(c.id),
    peso_kg: Number(c.peso_kg),
    talla_cm: Number(c.talla_cm),
    perimetro_cefalico_cm: c.perimetro_cefalico_cm ? Number(c.perimetro_cefalico_cm) : null
  }));

  const [vacunasRaw] = await mysqlPediatria.execute(
    'SELECT id_vacuna AS id, nombre_vacuna, numero_dosis, lote, DATE_FORMAT(fecha_programada, "%Y-%m-%d") AS fecha_programada, DATE_FORMAT(fecha_aplicacion, "%Y-%m-%d") AS fecha_aplicacion, estado FROM esquema_vacunacion WHERE id_historial = ? ORDER BY fecha_programada ASC',
    [p.id_historial]
  );
  const vacunas = vacunasRaw.map(v => ({ ...v, id: String(v.id) }));

  return {
    paciente: {
      id: String(p.id_paciente),
      nombres: p.nombres,
      apellidos: p.apellidos,
      fecha_nacimiento: p.fecha_nacimiento,
      genero: p.genero,
      telefono: p.telefono,
      contacto_emergencia_nombre: p.contacto_emergencia_nombre,
      contacto_emergencia_telefono: p.contacto_emergencia_telefono
    },
    consultas,
    antecedentes,
    citas,
    controles_crecimiento,
    vacunas,
    examenes: []
  };
}

export async function buscarPediatria(termino) {
  const [rows] = await mysqlPediatria.execute(
    'SELECT CAST(id_paciente AS CHAR) AS id, nombres, apellidos FROM paciente WHERE CONCAT(LOWER(nombres), " ", LOWER(apellidos)) LIKE ? OR CAST(id_paciente AS CHAR) = ? ORDER BY apellidos, nombres, id_paciente LIMIT 25',
    [`%${termino.toLowerCase()}%`, termino]
  );
  return rows;
}

export async function medicosPediatria() {
  const [rows] = await mysqlPediatria.execute(
    'SELECT CAST(p.id_personal AS CHAR) AS id, p.nombres, p.apellidos, COALESCE(e.nombre_especialidad, "Pediatría") AS especialidad FROM personal_pediatrico p LEFT JOIN especialidad e ON p.id_especialidad = e.id_especialidad WHERE p.estado = "activo" AND p.rol IN ("pediatra", "especialista") ORDER BY p.apellidos, p.nombres'
  );
  return rows;
}

export async function consultaPediatria(id, atencion) {
  const conn = await mysqlPediatria.getConnection();
  try {
    await conn.beginTransaction();

    const [pacientes] = await conn.execute(
      'SELECT p.id_paciente, h.id_historial FROM paciente p JOIN historial_clinico h ON p.id_paciente = h.id_paciente WHERE p.id_paciente = ? AND p.estado = "activo" FOR UPDATE',
      [id]
    );
    if (!pacientes.length) {
      throw Object.assign(new Error('Verifica el paciente y su historial activo.'), { status: 422 });
    }
    const { id_historial } = pacientes[0];

    const [medicos] = await conn.execute(
      'SELECT id_personal FROM personal_pediatrico WHERE id_personal = ? AND estado = "activo" AND rol IN ("pediatra", "especialista")',
      [atencion.id_personal]
    );
    if (!medicos.length) {
      throw Object.assign(new Error('Verifica el pediatra activo.'), { status: 422 });
    }

    let idCita = atencion.id_cita;
    if (idCita) {
      const [resCita] = await conn.execute(
        'UPDATE cita_medica SET estado_cita = "atendida" WHERE id_cita = ? AND id_paciente = ? AND id_personal = ? AND estado_cita = "programada"',
        [idCita, id, atencion.id_personal]
      );
      if (resCita.affectedRows === 0) {
        throw Object.assign(new Error('La cita ya no está disponible para este paciente y pediatra.'), { status: 409 });
      }
    } else {
      const [citaEspontanea] = await conn.execute(
        'INSERT INTO cita_medica (id_paciente, id_personal, id_institucion, fecha_hora, motivo, estado_cita) SELECT ?, ?, p.id_institucion, NOW(), ?, "atendida" FROM paciente p WHERE p.id_paciente = ?',
        [id, atencion.id_personal, atencion.motivo, id]
      );
      idCita = citaEspontanea.insertId;
    }

    const [resConsulta] = await conn.execute(
      'INSERT INTO consulta_pediatrica (id_cita, id_historial, id_personal, tipo_consulta, motivo_consulta, notas_evolucion) VALUES (?, ?, ?, ?, ?, ?)',
      [idCita, id_historial, atencion.id_personal, atencion.tipo_consulta || 'control_nino_sano', atencion.motivo, atencion.notas || null]
    );
    const consultaId = resConsulta.insertId;

    for (const d of (atencion.diagnosticos || [])) {
      await conn.execute(
        'INSERT INTO diagnostico_pediatrico (id_consulta, codigo_cie, descripcion, tipo, observaciones) VALUES (?, ?, ?, ?, ?)',
        [consultaId, d.codigo_cie, d.descripcion, d.tipo || 'presuntivo', d.observaciones || null]
      );
    }

    for (const t of (atencion.tratamientos || [])) {
      await conn.execute(
        'INSERT INTO tratamiento_pediatrico (id_consulta, nombre_procedimiento, descripcion, fecha_realizacion, resultado) VALUES (?, ?, ?, CURRENT_DATE(), ?)',
        [consultaId, t.nombre_procedimiento, t.descripcion || null, t.resultado || null]
      );
    }

    for (const r of (atencion.recetas || [])) {
      const [resReceta] = await conn.execute(
        'INSERT INTO receta_prescripcion (id_consulta, fecha_emision, indicaciones_generales) VALUES (?, CURRENT_DATE(), ?)',
        [consultaId, r.indicaciones_generales || null]
      );
      const recetaId = resReceta.insertId;
      for (const m of (r.medicamentos || [])) {
        await conn.execute(
          'INSERT INTO receta_detalle (id_receta, medicamento, dosis, frecuencia, duracion) VALUES (?, ?, ?, ?, ?)',
          [recetaId, m.medicamento, m.dosis, m.frecuencia, m.duracion]
        );
      }
    }

    if (atencion.control_crecimiento) {
      const c = atencion.control_crecimiento;
      await conn.execute(
        'INSERT INTO control_crecimiento (id_historial, id_consulta, fecha_control, peso_kg, talla_cm, perimetro_cefalico_cm, percentil_observado) VALUES (?, ?, CURRENT_DATE(), ?, ?, ?, ?)',
        [id_historial, consultaId, c.peso_kg, c.talla_cm, c.perimetro_cefalico_cm || null, c.percentil_observado || null]
      );
    }

    await conn.commit();
    return String(consultaId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function archivarHospital(id, motivo) {
  const db = await postgres.connect();
  try {
    await db.query('BEGIN');
    const { rows: [p] } = await db.query('SELECT estado FROM hospital.paciente WHERE id_paciente::text=$1 FOR UPDATE', [id]);
    if (!p) { await db.query('ROLLBACK'); return null; }
    const ingreso = await db.query(`SELECT 1 FROM hospital.hospitalizacion JOIN hospital.historial_clinico USING(id_historial)
      WHERE id_paciente::text=$1 AND estado='internado'`, [id]);
    if (ingreso.rowCount) {
      await db.query('ROLLBACK');
      throw Object.assign(new Error('Da el alta hospitalaria antes de archivar el expediente.'), { status: 409 });
    }
    if (p.estado !== 'baja') {
      await db.query("UPDATE hospital.paciente SET estado='baja',motivo_baja=$2,fecha_baja=clock_timestamp() WHERE id_paciente::text=$1", [id, motivo.trim()]);
      await db.query("UPDATE hospital.cita_medica SET estado_cita='cancelada' WHERE id_paciente::text=$1 AND estado_cita='programada'", [id]);
    }
    await db.query('COMMIT');
    return { estado: 'baja' };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

export async function archivarPediatria(id, motivo) {
  const conn = await mysqlPediatria.getConnection();
  try {
    await conn.beginTransaction();
    const [pacientes] = await conn.execute(
      'SELECT estado FROM paciente WHERE id_paciente = ? FOR UPDATE',
      [id]
    );
    if (!pacientes.length) {
      await conn.rollback();
      return null;
    }
    const p = pacientes[0];
    if (p.estado !== 'baja') {
      await conn.execute(
        'UPDATE paciente SET estado = "baja", motivo_baja = ?, fecha_baja = NOW() WHERE id_paciente = ?',
        [motivo.trim(), id]
      );
      await conn.execute(
        'UPDATE cita_medica SET estado_cita = "cancelada" WHERE id_paciente = ? AND estado_cita = "programada"',
        [id]
      );
    }
    await conn.commit();
    return { estado: 'baja' };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function archivarLaboratorio(id, motivo) {
  const db = mongo.db('laboratorio_clinico');
  const res = await db.collection('pacientes').updateOne(
    { _id: id },
    { $set: { estado: 'baja', motivo_baja: motivo.trim(), fecha_baja: new Date() } }
  );
  if (!res.matchedCount) return null;
  return { estado: 'baja' };
}

// =====================================================================
// Adaptador NoSQL Firestore: Clínica Odontológica
// =====================================================================

export function generarOdontogramaInicial() {
  const piezas = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
    38, 37, 36, 35, 34, 33, 32, 31,
    41, 42, 43, 44, 45, 46, 47, 48
  ];
  return piezas.map(numero => ({
    numero,
    estado: 'sano',
    observaciones: ''
  }));
}

export async function altaOdontologia(datos) {
  const id = 'ODO-' + randomUUID().slice(0, 8);
  const paciente = {
    ...datos,
    id,
    estado: 'activo',
    odontograma: generarOdontogramaInicial(),
    fecha_registro: new Date()
  };
  await firestoreOdontologia.collection('pacientes').doc(id).set(paciente);
  return id;
}

export async function historialOdontologia(id) {
  const docRef = firestoreOdontologia.collection('pacientes').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  const p = snap.data();

  const snapConsultas = await docRef.collection('consultas').orderBy('fecha', 'desc').get();
  const consultas = snapConsultas.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString() : data.fecha
    };
  });

  const snapCitas = await docRef.collection('citas').orderBy('fecha', 'desc').get();
  const citas = snapCitas.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString() : data.fecha
    };
  });

  const snapCobros = await docRef.collection('cobros').orderBy('fecha', 'desc').get();
  const cobros = snapCobros.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString() : data.fecha
    };
  });

  return {
    paciente: {
      id,
      nombres: p.nombres,
      apellidos: p.apellidos,
      fecha_nacimiento: p.fecha_nacimiento,
      telefono: p.telefono,
      correo_electronico: p.correo_electronico,
      estado: p.estado || 'activo',
      motivo_baja: p.motivo_baja,
      fecha_baja: p.fecha_baja?.toDate ? p.fecha_baja.toDate().toISOString() : p.fecha_baja
    },
    odontograma: p.odontograma || [],
    consultas,
    citas,
    cobros,
    antecedentes: [],
    examenes: []
  };
}

export async function buscarOdontologia(termino) {
  const col = firestoreOdontologia.collection('pacientes');
  const snap = await col.limit(25).get();
  const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!termino) return todos.map(p => ({ id: p.id, nombres: p.nombres, apellidos: p.apellidos }));
  const t = termino.toLowerCase();
  return todos
    .filter(p => p.id.toLowerCase() === t || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(t))
    .map(p => ({ id: p.id, nombres: p.nombres, apellidos: p.apellidos }));
}

export async function medicosOdontologia() {
  return [
    { id: '1', nombres: 'Josué André', apellidos: 'Menéndez Juárez', especialidad: 'Odontología General' },
    { id: '2', nombres: 'Rebeca Sofía', apellidos: 'Estrada López', especialidad: 'Ortodoncia y Endodoncia' }
  ];
}

export async function consultaOdontologia(id, atencion) {
  const docRef = firestoreOdontologia.collection('pacientes').doc(id);

  const consulta = {
    motivo: atencion.motivo,
    notas: atencion.notas || null,
    id_personal: atencion.id_personal || '1',
    fecha: new Date(),
    odontologo: atencion.id_personal === '2' ? 'Dra. Rebeca Estrada López' : 'Dr. Josué Menéndez',
    diagnosticos: atencion.diagnosticos || [],
    tratamientos: atencion.tratamientos || [],
    recetas: atencion.recetas || []
  };

  return await firestoreOdontologia.runTransaction(async t => {
    const freshSnap = await t.get(docRef);
    if (!freshSnap.exists) return null;
    const freshData = freshSnap.data();
    if (freshData.estado !== 'activo') {
      throw Object.assign(new Error('El paciente no está activo.'), { status: 422 });
    }

    let nuevoOdontograma = freshData.odontograma || generarOdontogramaInicial();
    if (atencion.tratamientos?.length) {
      for (const trat of atencion.tratamientos) {
        if (trat.pieza) {
          const num = Number(trat.pieza);
          nuevoOdontograma = nuevoOdontograma.map(pieza => {
            if (pieza.numero === num) {
              return {
                ...pieza,
                estado: trat.nuevo_estado || 'obturado',
                observaciones: trat.nombre_procedimiento || pieza.observaciones
              };
            }
            return pieza;
          });
        }
      }
      t.update(docRef, { odontograma: nuevoOdontograma });
    }

    const consultaDocRef = docRef.collection('consultas').doc();
    t.set(consultaDocRef, consulta);
    return consultaDocRef.id;
  });
}

export async function archivarOdontologia(id, motivo) {
  const docRef = firestoreOdontologia.collection('pacientes').doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  await docRef.update({
    estado: 'baja',
    motivo_baja: motivo.trim(),
    fecha_baja: new Date()
  });

  const snapCitas = await docRef.collection('citas').where('estado', '==', 'programada').get();
  if (!snapCitas.empty) {
    const batch = firestoreOdontologia.batch();
    snapCitas.docs.forEach(doc => batch.update(doc.ref, { estado: 'cancelada' }));
    await batch.commit();
  }
  return { estado: 'baja' };
}

export async function inicializarOdontologia() {
  try {
    const col = firestoreOdontologia.collection('pacientes');
    const snap = await col.limit(1).get();
    if (snap.empty) {
      const demoId = 'ODO-001';
      const odontograma = generarOdontogramaInicial();
      // Marcamos un par de piezas dentales para mostrar variedad
      odontograma[0] = { numero: 18, estado: 'ausente', observaciones: 'Tercer molar extraído' };
      odontograma[3] = { numero: 15, estado: 'obturado', observaciones: 'Resina oclusal' };
      odontograma[12] = { numero: 25, estado: 'caries', observaciones: 'Caries interproximal leve' };

      const docRef = col.doc(demoId);
      await docRef.set({
        id: demoId,
        nombres: 'Camila Andrea',
        apellidos: 'Morales Fuentes',
        fecha_nacimiento: '2002-08-14',
        genero: 'Femenino',
        telefono: '5552-3344',
        correo_electronico: 'camila.morales@ejemplo.com',
        estado: 'activo',
        odontograma,
        fecha_registro: new Date()
      });

      await docRef.collection('consultas').add({
        motivo: 'Evaluación periódica y profilaxis dental',
        notas: 'Higiene adecuada. Se realiza limpieza ultrasónica y aplicación de flúor barniz.',
        id_personal: '1',
        odontologo: 'Dr. Josué Menéndez',
        fecha: new Date('2026-01-20T10:00:00Z'),
        diagnosticos: [{ codigo_cie: 'K02.1', descripcion: 'Caries de la dentina en pieza 25', tipo: 'definitivo' }],
        tratamientos: [{ nombre_procedimiento: 'Profilaxis dental profunda', pieza: 25, nuevo_estado: 'caries' }],
        recetas: [{ medicamentos: [{ medicamento: 'Enjuague bucal clorhexidina 0.12%', dosis: '15 ml', frecuencia: 'Cada 12 horas', duracion: '7 días' }] }]
      });

      await docRef.collection('citas').add({
        motivo: 'Obturación con resina estética pieza 25',
        odontologo: 'Dr. Josué Menéndez',
        fecha: new Date('2026-03-15T09:30:00Z'),
        estado: 'programada'
      });

      await docRef.collection('cobros').add({
        monto: 350.00,
        metodo_pago: 'efectivo',
        balance_pendiente: 0.00,
        estado_pago: 'pagado',
        fecha: new Date('2026-01-20T10:30:00Z')
      });
      console.log('Clínica Odontológica inicializada con paciente demo ODO-001 en Firestore.');
    }
  } catch (err) {
    // Si el emulador aún no está encendido al importar, se ignorará y reintentará al hacer la primera petición
  }
}
