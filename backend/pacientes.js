import express from 'express';
import { postgres, mongo, mysqlPediatria, firestoreOdontologia } from './repositorios.js';

const limites = {
  nombres:100, apellidos:100, dpi_cui:20, genero:20, direccion:255, telefono:20,
  correo_electronico:150, contacto_emergencia_nombre:150, contacto_emergencia_telefono:20
};
export function validarPaciente(datos, parcial=false) {
  const salida={};
  if (!datos || typeof datos!=='object' || Array.isArray(datos)) throw Object.assign(new Error('Datos de paciente inválidos.'),{status:422});
  for (const [campo,maximo] of Object.entries(limites)) {
    if (parcial && datos[campo]===undefined) continue;
    const valor=datos[campo];
    if (valor!=null && typeof valor!=='string') throw Object.assign(new Error('Revisa '+campo+'.'),{status:422});
    const texto=valor?.trim() || null;
    if ((['nombres','apellidos'].includes(campo) && !texto) || (texto && (texto.length>maximo || texto.includes('\u0000')))) {
      throw Object.assign(new Error('Revisa '+campo+'.'),{status:422});
    }
    salida[campo]=texto;
  }
  if (!parcial || datos.fecha_nacimiento!==undefined) {
    const valor=datos.fecha_nacimiento;
    const fecha=typeof valor==='string' && /^\d{4}-\d\d-\d\d$/.test(valor)?new Date(valor+'T00:00:00Z'):new Date(NaN);
    if (!Number.isFinite(fecha.getTime()) || fecha.getUTCFullYear()<1 || fecha.toISOString().slice(0,10)!==valor || fecha>new Date()) {
      throw Object.assign(new Error('Fecha de nacimiento inválida.'),{status:422});
    }
    salida.fecha_nacimiento=valor;
  }
  if (salida.correo_electronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salida.correo_electronico)) throw Object.assign(new Error('Correo electrónico inválido.'),{status:422});
  return salida;
}
export async function datosPaciente(id) {
  const {rows}=await postgres.query(`SELECT id_paciente::text AS id, nombres,apellidos,dpi_cui,fecha_nacimiento::text,
    genero,direccion,telefono,correo_electronico,contacto_emergencia_nombre,contacto_emergencia_telefono,
    estado,motivo_baja,fecha_baja FROM hospital.paciente WHERE id_paciente::text=$1`,[id]);
  return rows[0];
}
export const pacientes=express.Router();
pacientes.use(express.json({limit:'16kb'}));
pacientes.get('/:id/datos',async(req,res)=>{
  let datos;
  if (res.locals.entidad==='laboratorio') {
    const proyeccion=Object.fromEntries([...Object.keys(limites),'fecha_nacimiento','estado','motivo_baja','fecha_baja'].map(k=>[k,1]));
    const documento=await mongo.db('laboratorio_clinico').collection('pacientes').findOne({_id:req.params.id},{projection:proyeccion});
    if (documento) {const {_id,...resto}=documento;datos={...resto,id:_id,estado:documento.estado||'activo'};}
  } else if (res.locals.entidad==='pediatria') {
    if (/^[1-9]\d{0,18}$/.test(req.params.id)) {
      const [rows]=await mysqlPediatria.execute(
        `SELECT CAST(id_paciente AS CHAR) AS id, nombres, apellidos, dpi_cui,
          DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
          genero, direccion, telefono, correo_electronico,
          contacto_emergencia_nombre, contacto_emergencia_telefono,
          estado, motivo_baja, fecha_baja
        FROM paciente WHERE id_paciente = ?`,
        [req.params.id]
      );
      if (rows[0]) {
        datos={
          ...rows[0],
          id:String(rows[0].id),
          estado:rows[0].estado||'activo',
          fecha_baja:rows[0].fecha_baja instanceof Date ? rows[0].fecha_baja.toISOString() : (rows[0].fecha_baja || null)
        };
      }
    }
  } else if (res.locals.entidad==='odontologia') {
    const docRef=firestoreOdontologia.collection('pacientes').doc(req.params.id);
    const snap=await docRef.get();
    if (snap.exists) {
      const p=snap.data();
      datos={
        id:snap.id,
        nombres:p.nombres||null,
        apellidos:p.apellidos||null,
        dpi_cui:p.dpi_cui||null,
        fecha_nacimiento:p.fecha_nacimiento||null,
        genero:p.genero||null,
        direccion:p.direccion||null,
        telefono:p.telefono||null,
        correo_electronico:p.correo_electronico||null,
        contacto_emergencia_nombre:p.contacto_emergencia_nombre||null,
        contacto_emergencia_telefono:p.contacto_emergencia_telefono||null,
        estado:p.estado||'activo',
        motivo_baja:p.motivo_baja||null,
        fecha_baja:p.fecha_baja?.toDate ? p.fecha_baja.toDate().toISOString() : (p.fecha_baja || null)
      };
    }
  } else datos=await datosPaciente(req.params.id);
  if (!datos) return res.status(404).json({error:'Paciente no encontrado.'});
  res.json(datos);
});
pacientes.get('/:id/citas',async(req,res)=>{
  if (res.locals.entidad!=='hospital') return res.status(403).json({error:'Disponible en Hospital.'});
  const {rows}=await postgres.query(`SELECT c.id_cita::text AS id,c.fecha_hora AS fecha,c.estado_cita AS estado,
    p.nombres||' '||p.apellidos AS medico FROM hospital.cita_medica c JOIN hospital.personal_medico p USING(id_personal)
    WHERE c.id_paciente::text=$1 ORDER BY c.fecha_hora DESC`,[req.params.id]);
  res.json(rows);
});
pacientes.patch('/:id',async(req,res)=>{
  const datos=validarPaciente(req.body,true);
  const campos=Object.keys(datos);
  if (!campos.length) return res.status(422).json({error:'Incluye los datos que deseas actualizar.'});
  if (res.locals.entidad==='laboratorio') {
    const cambio=await mongo.db('laboratorio_clinico').collection('pacientes').updateOne({_id:req.params.id},{$set:datos});
    if (!cambio.matchedCount) return res.status(404).json({error:'Paciente no encontrado.'});
    return res.json({id:req.params.id});
  }
  if (res.locals.entidad==='pediatria') {
    if (!/^[1-9]\d{0,18}$/.test(req.params.id)) return res.status(404).json({error:'Paciente no encontrado.'});
    const [pacientes]=await mysqlPediatria.execute('SELECT id_paciente FROM paciente WHERE id_paciente = ?',[req.params.id]);
    if (!pacientes.length) return res.status(404).json({error:'Paciente no encontrado.'});
    await mysqlPediatria.execute(
      `UPDATE paciente SET ${campos.map(c=>c+' = ?').join(', ')} WHERE id_paciente = ?`,
      [...Object.values(datos),req.params.id]
    );
    return res.json({id:String(pacientes[0].id_paciente)});
  }
  if (res.locals.entidad==='odontologia') {
    const docRef=firestoreOdontologia.collection('pacientes').doc(req.params.id);
    const snap=await docRef.get();
    if (!snap.exists) return res.status(404).json({error:'Paciente no encontrado.'});
    await docRef.update(datos);
    return res.json({id:req.params.id});
  }
  const {rows}=await postgres.query(`UPDATE hospital.paciente SET ${campos.map((c,i)=>c+'=$'+(i+2)).join(',')}
    WHERE id_paciente::text=$1 RETURNING id_paciente::text AS id`,[req.params.id,...Object.values(datos)]);
  if (!rows.length) return res.status(404).json({error:'Paciente no encontrado.'});
  res.json(rows[0]);
});
pacientes.post('/:id/archivo',async(req,res)=>{
  const motivo=req.body?.motivo;
  if (typeof motivo!=='string' || !motivo.trim() || motivo.length>2000 || motivo.includes('\u0000')) return res.status(422).json({error:'Escribe la causa del archivo.'});
  if (res.locals.entidad==='laboratorio') {
    const coleccion=mongo.db('laboratorio_clinico').collection('pacientes');
    const cambio=await coleccion.updateOne({_id:req.params.id,estado:{$ne:'baja'}},{$set:{estado:'baja',motivo_baja:motivo.trim(),fecha_baja:new Date()}});
    if (!cambio.matchedCount && !await coleccion.findOne({_id:req.params.id},{projection:{_id:1}})) return res.status(404).json({error:'Paciente no encontrado.'});
    return res.json({estado:'baja'});
  }
  const db=await postgres.connect();
  try {
    await db.query('BEGIN');
    const {rows:[p]}=await db.query('SELECT estado FROM hospital.paciente WHERE id_paciente::text=$1 FOR UPDATE',[req.params.id]);
    if (!p) {await db.query('ROLLBACK'); return res.status(404).json({error:'Paciente no encontrado.'});}
    const ingreso=await db.query(`SELECT 1 FROM hospital.hospitalizacion JOIN hospital.historial_clinico USING(id_historial)
      WHERE id_paciente::text=$1 AND estado='internado'`,[req.params.id]);
    if (ingreso.rowCount) {await db.query('ROLLBACK');return res.status(409).json({error:'Da el alta hospitalaria antes de archivar el expediente.'});}
    if (p.estado!=='baja') {
      await db.query("UPDATE hospital.paciente SET estado='baja',motivo_baja=$2,fecha_baja=clock_timestamp() WHERE id_paciente::text=$1",[req.params.id,motivo.trim()]);
      await db.query("UPDATE hospital.cita_medica SET estado_cita='cancelada' WHERE id_paciente::text=$1 AND estado_cita='programada'",[req.params.id]);
    }
    await db.query('COMMIT');
    res.json({estado:'baja'});
  } catch(error) {await db.query('ROLLBACK');throw error;} finally {db.release();}
});
