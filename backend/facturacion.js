import express from 'express';
import { postgres } from './repositorios.js';

const subtotal='round(cantidad * precio_unitario, 2)';
export async function emitirFactura(db, ingreso) {
  await db.query(`INSERT INTO hospital.factura(id_hospitalizacion,monto_total,estado_pago)
    SELECT $1,total,CASE WHEN total=0 THEN 'pagada' ELSE 'pendiente' END
    FROM (SELECT coalesce(sum(${subtotal}),0) total FROM hospital.cargo_hospitalizacion WHERE id_hospitalizacion=$1) s
    ON CONFLICT (id_hospitalizacion) DO NOTHING`,[ingreso]);
}

function rechazar(status,mensaje) { throw Object.assign(new Error(mensaje),{status}); }
function positivo(valor) {
  return /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(String(valor)) && Number(valor)>0;
}
const resumen=`SELECT f.id_factura AS id,f.fecha_emision AS fecha,f.estado_pago AS estado,
  f.monto_total AS total, f.monto_total-coalesce((SELECT sum(monto) FROM hospital.pago WHERE id_factura=f.id_factura),0) AS saldo
  FROM hospital.factura f WHERE f.id_hospitalizacion=$1`;

export const facturacion=express.Router({mergeParams:true});
facturacion.get('/catalogo',async(req,res)=>{
  const medicamentos=await postgres.query('SELECT id_medicamento AS id,nombre_generico,presentacion FROM hospital.medicamento ORDER BY nombre_generico');
  res.json({medicamentos:medicamentos.rows});
});
facturacion.get('/:ingreso/cuenta',async(req,res)=>{
  const {rows}=await postgres.query(`SELECT h.id_hospitalizacion AS id,
    (SELECT coalesce(sum(${subtotal}),0)::text FROM hospital.cargo_hospitalizacion WHERE id_hospitalizacion=h.id_hospitalizacion) AS acumulado,
    ARRAY(SELECT jsonb_build_object('id',c.id_cargo::text,'tipo',t.nombre_cargo,'descripcion',c.descripcion,'cantidad',cantidad,
      'medicamento',m.nombre_generico,'profesional',p.nombres||' '||p.apellidos,
      'precio_unitario',precio_unitario,'subtotal',${subtotal}) FROM hospital.cargo_hospitalizacion c JOIN hospital.tipo_cargo t USING(id_tipo_cargo)
      LEFT JOIN hospital.medicamento m USING(id_medicamento) LEFT JOIN hospital.personal_medico p USING(id_personal)
      WHERE c.id_hospitalizacion=h.id_hospitalizacion ORDER BY c.id_cargo) AS cargos,
    (SELECT to_jsonb(f) FROM (${resumen.replace('=$1','=h.id_hospitalizacion')}) f) AS factura,
    ARRAY(SELECT jsonb_build_object('id',p.id_pago::text,'monto',p.monto,'metodo',p.metodo_pago,'referencia',p.referencia,'fecha',p.fecha_pago)
      FROM hospital.pago p JOIN hospital.factura f USING(id_factura) WHERE f.id_hospitalizacion=h.id_hospitalizacion ORDER BY p.id_pago) AS pagos
    FROM hospital.hospitalizacion h JOIN hospital.historial_clinico e USING(id_historial)
    WHERE h.id_hospitalizacion::text=$1 AND e.id_paciente::text=$2`,[req.params.ingreso,req.params.id]);
  if (!rows.length) rechazar(404,'Ingreso no encontrado.');
  res.json(rows[0]);
});

function registrar(operacion) {
  return async(req,res)=>{
    const datos=req.body || {};
    const clave=req.get('Idempotency-Key');
    if (clave && !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(clave)) rechazar(422,'La clave de la operación debe ser UUID.');
    const db=await postgres.connect();
    try {
      await db.query('BEGIN');
      const {rows:[h]}=await db.query(`SELECT h.id_hospitalizacion AS id,h.estado,p.id_institucion FROM hospital.hospitalizacion h
        JOIN hospital.historial_clinico e USING(id_historial) JOIN hospital.paciente p USING(id_paciente)
        WHERE h.id_hospitalizacion::text=$1 AND p.id_paciente::text=$2 FOR UPDATE OF h`,[req.params.ingreso,req.params.id]);
      if (!h) rechazar(404,'Ingreso no encontrado.');
      let salida;
      if (operacion==='cargo') salida=await cobrar(db,h,datos,clave);
      if (operacion==='pago') salida=await pagar(db,h,datos,clave);
      if (operacion==='factura') {
        if (h.estado!=='alta') rechazar(409,'La factura se emite al alta.');
        await emitirFactura(db,h.id);
        salida=(await db.query(resumen,[h.id])).rows[0];
      }
      await db.query('COMMIT');
      res.status(operacion==='factura'?200:201).json(salida);
    } catch(error) {
      await db.query('ROLLBACK');
      if (error.code==='22003') rechazar(422,'El total excede el límite de la factura.');
      throw error;
    } finally {db.release();}
  };
}
async function cobrar(db,h,d,clave) {
  if (clave) {
    const previo=await db.query('SELECT id_cargo AS id FROM hospital.cargo_hospitalizacion WHERE id_hospitalizacion=$1 AND solicitud=$2',[h.id,clave]);
    if (previo.rowCount) return previo.rows[0];
  }
  if (h.estado!=='internado') rechazar(409,'El ingreso ya está cerrado.');
  if (!positivo(d.cantidad) || !positivo(d.precio_unitario) || typeof d.descripcion!=='string' || !d.descripcion.trim() ||
      d.descripcion.length>255 || d.descripcion.includes('\u0000')) rechazar(422,'Revisa la descripción, la cantidad y el precio.');
  const total=await db.query(`SELECT round($2::numeric*$3::numeric,2) AS importe,
    coalesce(sum(${subtotal}),0)+round($2::numeric*$3::numeric,2)<=99999999.99 AS cabe
    FROM hospital.cargo_hospitalizacion WHERE id_hospitalizacion=$1`,[h.id,d.cantidad,d.precio_unitario]);
  if (!total.rows[0].cabe || Number(total.rows[0].importe)===0) rechazar(422,'El importe está fuera del rango permitido.');
  const {rows}=await db.query(`INSERT INTO hospital.cargo_hospitalizacion
    (id_hospitalizacion,id_tipo_cargo,id_medicamento,id_personal,descripcion,cantidad,precio_unitario,solicitud)
    SELECT $1,t.id_tipo_cargo,m.id_medicamento,p.id_personal,$5,$6,$7,$8 FROM hospital.tipo_cargo t
    LEFT JOIN hospital.medicamento m ON t.nombre_cargo='medicamento' AND m.id_medicamento::text=$3
    LEFT JOIN hospital.personal_medico p ON t.nombre_cargo='honorario_medico' AND p.id_personal::text=$4
      AND p.id_institucion=$9 AND p.estado='activo' AND p.rol IN ('medico','especialista')
    WHERE t.nombre_cargo=$2 AND t.nombre_cargo IN ('servicio','material','medicamento','honorario_medico')
      AND (t.nombre_cargo<>'medicamento' OR m.id_medicamento IS NOT NULL)
      AND (t.nombre_cargo<>'honorario_medico' OR p.id_personal IS NOT NULL) RETURNING id_cargo AS id`,
    [h.id,d.tipo,d.id_medicamento,d.id_personal,d.descripcion.trim(),d.cantidad,d.precio_unitario,clave,h.id_institucion]);
  if (!rows.length) rechazar(422,'Revisa el tipo de cargo y el medicamento o profesional seleccionado.');
  return rows[0];
}
async function pagar(db,h,d,clave) {
  const {rows:[f]}=await db.query(resumen,[h.id]);
  if (!f) rechazar(409,'Primero debe emitirse la factura.');
  if (clave) {
    const previo=await db.query('SELECT id_pago AS id FROM hospital.pago WHERE id_factura=$1 AND solicitud=$2',[f.id,clave]);
    if (previo.rowCount) return previo.rows[0];
  }
  if (!positivo(d.monto) || !['efectivo','tarjeta','seguro'].includes(d.metodo) ||
      (d.referencia!=null && (typeof d.referencia!=='string'||d.referencia.length>100||d.referencia.includes('\u0000')))) rechazar(422,'Revisa monto, método y referencia.');
  const {rows}=await db.query(`INSERT INTO hospital.pago(id_factura,monto,metodo_pago,referencia,solicitud)
    SELECT $1,$2,$3,$4,$5 WHERE $2::numeric<=$6::numeric RETURNING id_pago AS id`,[f.id,d.monto,d.metodo,d.referencia||null,clave,f.saldo]);
  if (!rows.length) rechazar(409,'El pago supera el saldo pendiente.');
  await db.query(`UPDATE hospital.factura SET estado_pago=CASE WHEN $2::numeric=$3::numeric THEN 'pagada' ELSE 'parcial' END WHERE id_factura=$1`,[f.id,d.monto,f.saldo]);
  return rows[0];
}
facturacion.post('/:ingreso/cargos',registrar('cargo'));
facturacion.post('/:ingreso/factura',registrar('factura'));
facturacion.post('/:ingreso/pagos',registrar('pago'));
