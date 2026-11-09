import express from 'express';
import { postgres } from './repositorios.js';
import { facturacion, emitirFactura } from './facturacion.js';

export const internamiento = express.Router({mergeParams:true});
internamiento.use((req,res,next) => res.locals.entidad === 'hospital' ? next() : res.status(403).json({error:'Disponible en Hospital.'}));
internamiento.use(express.json({limit:'16kb'}));
internamiento.use(facturacion);

const camasOcupadas = `(SELECT count(*)::int FROM hospital.estancia e
  WHERE e.id_habitacion=h.id_habitacion AND e.fecha_fin IS NULL)`;
function fallo(status, mensaje) { throw Object.assign(new Error(mensaje), {status}); }

internamiento.get('/habitaciones', async (req,res) => {
  const unidad=req.query.unidad || null;
  if (unidad && !['normal','UCI','urgencias','pediatria'].includes(unidad)) fallo(422,'Unidad desconocida.');
  const {rows}=await postgres.query(`SELECT h.id_habitacion AS id,h.numero,h.tipo_unidad,h.piso,h.capacidad,
    h.capacidad-${camasOcupadas} AS libres FROM hospital.habitacion h
    JOIN hospital.paciente p USING(id_institucion) WHERE p.id_paciente::text=$1 AND h.estado='disponible'
    AND ($2::text IS NULL OR h.tipo_unidad=$2) AND h.capacidad>${camasOcupadas}
    ORDER BY h.tipo_unidad,h.numero`,[req.params.id,unidad]);
  res.json(rows);
});

internamiento.get('/', async (req,res) => {
  const {rows}=await postgres.query(`SELECT h.id_hospitalizacion AS id,h.estado,h.motivo_ingreso,h.fecha_ingreso,h.fecha_alta,
    ARRAY(SELECT jsonb_build_object('id',e.id_estancia::text,'habitacion',r.numero,'id_habitacion',r.id_habitacion::text,
    'unidad',r.tipo_unidad,'inicio',e.fecha_inicio,'fin',e.fecha_fin) FROM hospital.estancia e
    JOIN hospital.habitacion r USING(id_habitacion) WHERE e.id_hospitalizacion=h.id_hospitalizacion
    ORDER BY e.fecha_inicio,e.id_estancia) AS estancias
    FROM hospital.hospitalizacion h JOIN hospital.historial_clinico c USING(id_historial)
    WHERE c.id_paciente::text=$1 ORDER BY h.fecha_ingreso DESC,h.id_hospitalizacion DESC`,[req.params.id]);
  res.json(rows);
});

function movimiento(tipo) {
  return async (req,res) => {
    const destino=String(req.body?.id_habitacion ?? '');
    const motivo=req.body?.motivo;
    if (tipo!=='alta' && !/^[1-9]\d{0,18}$/.test(destino)) fallo(422,'Selecciona una habitación.');
    if (tipo==='ingreso' && (typeof motivo!=='string' || !motivo.trim() || motivo.length>4000 || motivo.includes('\u0000'))) fallo(422,'Ingresa el motivo de hospitalización.');
    const db=await postgres.connect();
    try {
      await db.query('BEGIN');
      const {rows:[paciente]}=await db.query(`SELECT p.estado,p.id_institucion,c.id_historial FROM hospital.paciente p
        JOIN hospital.historial_clinico c USING(id_paciente) WHERE p.id_paciente::text=$1 FOR UPDATE OF p`,[req.params.id]);
      if (!paciente) fallo(404,'Expediente no encontrado.');
      const {rows:[activo]}=await db.query(`SELECT h.id_hospitalizacion AS id,e.id_estancia,e.id_habitacion
        FROM hospital.hospitalizacion h LEFT JOIN hospital.estancia e ON e.id_hospitalizacion=h.id_hospitalizacion AND e.fecha_fin IS NULL
        WHERE h.id_historial=$1 AND h.estado='internado'`,[paciente.id_historial]);
      if (tipo==='ingreso' && (activo || paciente.estado!=='activo')) fallo(409,'El ingreso requiere un paciente activo sin hospitalización abierta.');
      if (tipo!=='ingreso' && (!activo?.id_estancia || activo.id!==req.params.ingreso)) fallo(409,'La hospitalización ya no está activa.');
      if (tipo==='traslado' && activo.id_habitacion===destino) fallo(409,'Elige una habitación distinta.');
      const habitaciones=[activo?.id_habitacion,tipo==='alta'?null:destino].filter(Boolean);
      await db.query(`SELECT id_habitacion FROM hospital.habitacion WHERE id_habitacion::text=ANY($1::text[])
        ORDER BY id_habitacion FOR UPDATE`,[habitaciones]);
      if (tipo!=='alta') {
        const libre=await db.query(`SELECT 1 FROM hospital.habitacion h WHERE h.id_habitacion::text=$1
          AND h.id_institucion=$2 AND h.estado='disponible' AND h.capacidad>${camasOcupadas}`,[destino,paciente.id_institucion]);
        if (!libre.rowCount) fallo(409,'La habitación seleccionada ya no tiene camas disponibles.');
      }
      const {rows:[{fecha}]}=await db.query('SELECT clock_timestamp()::text AS fecha');
      let id=activo?.id;
      if (tipo==='ingreso') {
        const nuevo=await db.query(`INSERT INTO hospital.hospitalizacion(id_historial,motivo_ingreso,fecha_ingreso)
          VALUES ($1,$2,$3) RETURNING id_hospitalizacion AS id`,[paciente.id_historial,motivo.trim(),fecha]);
        id=nuevo.rows[0].id;
      } else {
        await db.query('UPDATE hospital.estancia SET fecha_fin=$1 WHERE id_estancia=$2',[fecha,activo.id_estancia]);
      }
      if (tipo==='alta') {
        await db.query("UPDATE hospital.hospitalizacion SET fecha_alta=$1,estado='alta' WHERE id_hospitalizacion=$2",[fecha,id]);
        await emitirFactura(db,id);
      } else {
        const estancia=await db.query(`INSERT INTO hospital.estancia
          (id_hospitalizacion,id_habitacion,fecha_inicio,tarifa_diaria)
          SELECT $1,h.id_habitacion,$3,t.tarifa_diaria FROM hospital.habitacion h
          JOIN hospital.tarifa_estancia t USING(tipo_unidad) WHERE h.id_habitacion=$2`,[id,destino,fecha]);
        if (!estancia.rowCount) fallo(409,'Configura la tarifa de la unidad antes de iniciar la estancia.');
      }
      await db.query(`UPDATE hospital.habitacion h SET estado=CASE WHEN h.capacidad<=${camasOcupadas}
        THEN 'ocupada' ELSE 'disponible' END WHERE h.id_habitacion::text=ANY($1::text[]) AND estado<>'mantenimiento'`,[habitaciones]);
      await db.query('COMMIT');
      res.status(tipo==='ingreso'?201:200).json({id,estado:tipo==='alta'?'alta':'internado'});
    } catch(error) {
      await db.query('ROLLBACK');
      throw error;
    } finally { db.release(); }
  };
}
internamiento.post('/',movimiento('ingreso'));
internamiento.post('/:ingreso/traslados',movimiento('traslado'));
internamiento.post('/:ingreso/alta',movimiento('alta'));
