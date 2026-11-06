import express from 'express';
import { postgres } from './repositorios.js';

export const ambulatorio = express.Router();
ambulatorio.use((req,res,next) => res.locals.entidad === 'hospital' ? next() : res.status(403).json({error:'Disponible en Hospital.'}));
ambulatorio.use(express.json({limit:'16kb'}));
const invalido = (res, error) => res.status(422).json({error});
function cadena(valor, limite) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.length <= limite && !valor.includes('\u0000');
}
function fechaValida(dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(dia)) return false;
  const fecha = new Date(dia + 'T00:00:00Z');
  return !isNaN(fecha) && fecha.toISOString().slice(0,10) === dia;
}
ambulatorio.get('/agenda', async (req,res) => {
  const {medico,desde,hasta} = req.query;
  if (!cadena(medico,19) || !fechaValida(desde) || !fechaValida(hasta) || hasta < desde) return invalido(res,'Revisa el médico y el rango de fechas.');
  const {rows} = await postgres.query(`SELECT c.id_cita AS id, c.fecha_hora AS fecha, p.id_paciente AS paciente_id,
    p.nombres||' '||p.apellidos AS paciente FROM hospital.cita_medica c JOIN hospital.paciente p USING(id_paciente)
    WHERE c.id_personal::text=$1 AND c.estado_cita='programada'
    AND (c.fecha_hora AT TIME ZONE 'America/Guatemala')::date BETWEEN $2 AND $3 ORDER BY c.fecha_hora`,[medico,desde,hasta]);
  res.json(rows);
});
async function guardarCita(req,res) {
  const {id_personal,fecha,motivo} = req.body || {};
  if (!cadena(String(id_personal ?? ''),19) || !cadena(motivo,255) || typeof fecha !== 'string' ||
      !/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):(?:00|30)$/.test(fecha) || !fechaValida(fecha.slice(0,10))) {
    return invalido(res,'Elige médico, motivo y una hora en punto o media hora.');
  }
  const instante = new Date(fecha + ':00-06:00');
  if (instante <= new Date()) return invalido(res,'La cita debe ser futura.');
  const origen = ` FROM hospital.paciente p JOIN hospital.personal_medico m USING(id_institucion)
    WHERE p.id_paciente::text=$1 AND m.id_personal::text=$2 AND p.estado='activo' AND m.estado='activo'
    AND m.rol IN ('medico','especialista')`;
  const args = [req.params.id,String(id_personal),instante,motivo.trim()];
  const nueva = req.method === 'POST';
  let sql = `INSERT INTO hospital.cita_medica (id_paciente,id_personal,id_institucion,fecha_hora,motivo)
    SELECT p.id_paciente,m.id_personal,p.id_institucion,$3,$4 ${origen} RETURNING id_cita AS id`;
  if (!nueva) {
    args.push(req.params.cita);
    sql = `UPDATE hospital.cita_medica c SET id_personal=m.id_personal,fecha_hora=$3,motivo=$4 ${origen}
      AND c.id_cita::text=$5 AND c.id_paciente=p.id_paciente AND c.estado_cita='programada' RETURNING c.id_cita AS id`;
  }
  try {
    const {rows} = await postgres.query(sql,args);
    if (!rows.length) return invalido(res,'Comprueba el paciente, médico y estado de la cita.');
    res.status(nueva ? 201 : 200).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({error:'El paciente o el médico ya tiene cita en ese horario.'});
    throw error;
  }
}
ambulatorio.post('/pacientes/:id/citas',guardarCita);
ambulatorio.patch('/pacientes/:id/citas/:cita',guardarCita);
ambulatorio.post('/pacientes/:id/citas/:cita/cancelacion',async(req,res) => {
  const {rowCount} = await postgres.query(`UPDATE hospital.cita_medica SET estado_cita='cancelada'
    WHERE id_paciente::text=$1 AND id_cita::text=$2 AND estado_cita='programada'`,[req.params.id,req.params.cita]);
  if (!rowCount) return res.status(409).json({error:'Solo puedes cancelar una cita programada del paciente.'});
  res.json({estado:'cancelada'});
});
ambulatorio.post('/pacientes/:id/antecedentes',async(req,res) => {
  const {tipo,descripcion,gravedad} = req.body || {};
  if (!['alergico','patologico','quirurgico','familiar'].includes(tipo) || !cadena(descripcion,4000) ||
      (gravedad && (tipo !== 'alergico' || !cadena(gravedad,30)))) return invalido(res,'Revisa el tipo, la descripción y la gravedad del antecedente.');
  const {rows} = await postgres.query(`INSERT INTO hospital.antecedente_alergia(id_historial,tipo,descripcion,gravedad)
    SELECT id_historial,$2,$3,$4 FROM hospital.historial_clinico WHERE id_paciente::text=$1 RETURNING id_antecedente AS id`,
    [req.params.id,tipo,descripcion.trim(),gravedad || null]);
  if (!rows.length) return res.status(404).json({error:'Expediente no encontrado.'});
  res.status(201).json(rows[0]);
});
