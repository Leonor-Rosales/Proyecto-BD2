import express from 'express';
import { postgres } from './repositorios.js';

export const catalogos=express.Router();
catalogos.use((req,res,next)=>res.locals.entidad==='hospital'?next():res.status(403).json({error:'Disponible en Hospital.'}));
catalogos.use(express.json({limit:'16kb'}));
const texto=(v,max)=>typeof v==='string' && v.trim() && v.trim().length<=max && !v.includes('\u0000');
const precio=v=>/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(String(v)) && Number(v)>0;
catalogos.get('/especialidades',async(req,res)=>{
  res.json((await postgres.query('SELECT id_especialidad AS id,nombre_especialidad AS nombre,descripcion FROM hospital.especialidad ORDER BY nombre_especialidad')).rows);
});
catalogos.post('/especialidades',async(req,res)=>{
  if (!texto(req.body?.nombre,100) || (req.body.descripcion && !texto(req.body.descripcion,2000))) return res.status(422).json({error:'Revisa el nombre y la descripción de la especialidad.'});
  const {rows}=await postgres.query('INSERT INTO hospital.especialidad(nombre_especialidad,descripcion) VALUES($1,$2) RETURNING id_especialidad AS id',[req.body.nombre.trim(),req.body.descripcion?.trim()||null]);
  res.status(201).json(rows[0]);
});
catalogos.post('/medicos',async(req,res)=>{
  const d=req.body||{};
  if (!texto(d.nombres,100)||!texto(d.apellidos,100)||!texto(d.dpi_cui,20)||!texto(d.num_colegiado,30)||
      !['medico','especialista'].includes(d.rol)|| !/^\d+$/.test(String(d.id_especialidad))) return res.status(422).json({error:'Completa los datos del profesional y su especialidad.'});
  if ((d.telefono && !texto(d.telefono,20))||(d.correo_electronico && (!texto(d.correo_electronico,150)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo_electronico)))) return res.status(422).json({error:'Revisa teléfono y correo.'});
  const {rows}=await postgres.query(`INSERT INTO hospital.personal_medico
    (id_institucion,id_especialidad,nombres,apellidos,dpi_cui,num_colegiado,rol,telefono,correo_electronico)
    VALUES((SELECT id_institucion FROM hospital.institucion WHERE nombre='Hospital General de Prueba'),$1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id_personal AS id`,[d.id_especialidad,d.nombres.trim(),d.apellidos.trim(),d.dpi_cui.trim(),d.num_colegiado.trim(),d.rol,d.telefono||null,d.correo_electronico||null]);
  res.status(201).json(rows[0]);
});
export async function listarMedicamentos() {
  return (await postgres.query('SELECT id_medicamento AS id,nombre_generico,presentacion,unidad_medida,precio_unitario FROM hospital.medicamento ORDER BY nombre_generico,id_medicamento')).rows;
}
catalogos.patch('/medicos/:id/tarifa',async(req,res)=>{
  if (res.locals.usuario.rol!=='administrador') return res.status(403).json({error:'Se requiere la cuenta administradora.'});
  const valor=req.body?.tarifa_visita;
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(String(valor))) return res.status(422).json({error:'Ingresa un honorario válido con hasta dos decimales.'});
  const {rows}=await postgres.query(`UPDATE hospital.personal_medico SET tarifa_visita=$1
    WHERE id_personal::text=$2 AND rol IN ('medico','especialista') RETURNING tarifa_visita`,[valor,req.params.id]);
  if (!rows.length) return res.status(404).json({error:'Médico no encontrado.'});
  res.json(rows[0]);
});
catalogos.get('/medicamentos',async(req,res)=>res.json(await listarMedicamentos()));
catalogos.post('/medicamentos',async(req,res)=>{
  const {nombre_generico,presentacion,unidad_medida,precio_unitario}=req.body||{};
  if (!texto(nombre_generico,150)||!texto(presentacion,50)||!texto(unidad_medida,30)||!precio(precio_unitario)) return res.status(422).json({error:'Completa el medicamento, presentación, unidad de cobro y precio positivo.'});
  const {rows}=await postgres.query('INSERT INTO hospital.medicamento(nombre_generico,presentacion,unidad_medida,precio_unitario) VALUES($1,$2,$3,$4) RETURNING id_medicamento AS id',
    [nombre_generico.trim(),presentacion.trim(),unidad_medida.trim(),precio_unitario]);
  res.status(201).json(rows[0]);
});
catalogos.patch('/medicamentos/:id',async(req,res)=>{
  if (!precio(req.body?.precio_unitario)) return res.status(422).json({error:'Ingresa un precio positivo con hasta dos decimales.'});
  const {rows}=await postgres.query('UPDATE hospital.medicamento SET precio_unitario=$1 WHERE id_medicamento::text=$2 RETURNING id_medicamento AS id',[req.body.precio_unitario,req.params.id]);
  if (!rows.length) return res.status(404).json({error:'Medicamento no encontrado.'});
  res.json(rows[0]);
});
catalogos.get('/habitaciones',async(req,res)=>{
  const {rows}=await postgres.query(`SELECT h.id_habitacion AS id,numero,tipo_unidad,piso,capacidad,estado FROM hospital.habitacion h
    JOIN hospital.institucion USING(id_institucion) WHERE nombre='Hospital General de Prueba' ORDER BY numero`);
  res.json(rows);
});
catalogos.get('/tarifas-estancia',async(req,res)=>{
  res.json((await postgres.query('SELECT tipo_unidad,tarifa_diaria FROM hospital.tarifa_estancia ORDER BY tipo_unidad')).rows);
});
catalogos.get('/procedimientos',async(req,res)=>{
  const {rows}=await postgres.query('SELECT id_procedimiento AS id,nombre,precio FROM hospital.procedimiento_catalogo ORDER BY nombre');
  res.json(rows);
});
catalogos.post('/procedimientos',async(req,res)=>{
  if (res.locals.usuario.rol!=='administrador') return res.status(403).json({error:'Se requiere la cuenta administradora.'});
  const {nombre,precio:importe}=req.body||{};
  if (!texto(nombre,150)||!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(String(importe))) return res.status(422).json({error:'Ingresa un nombre y un precio válido.'});
  const {rows}=await postgres.query(`INSERT INTO hospital.procedimiento_catalogo(nombre,precio) VALUES ($1,$2)
    ON CONFLICT (lower(nombre)) DO UPDATE SET precio=excluded.precio RETURNING id_procedimiento AS id,nombre,precio`,[nombre.trim(),importe]);
  res.json(rows[0]);
});
catalogos.patch('/tarifas-estancia/:unidad',async(req,res)=>{
  if (res.locals.usuario.rol!=='administrador') return res.status(403).json({error:'Se requiere la cuenta administradora.'});
  if (!precio(req.body?.tarifa_diaria)) return res.status(422).json({error:'Ingresa una tarifa diaria positiva con hasta dos decimales.'});
  const {rows}=await postgres.query('UPDATE hospital.tarifa_estancia SET tarifa_diaria=$1 WHERE tipo_unidad=$2 RETURNING tipo_unidad,tarifa_diaria',[req.body.tarifa_diaria,req.params.unidad]);
  if (!rows.length) return res.status(404).json({error:'Unidad desconocida.'});
  res.json(rows[0]);
});
catalogos.post('/habitaciones',async(req,res)=>{
  const {numero,tipo_unidad,piso,capacidad}=req.body||{};
  if (!texto(numero,20)||!['normal','UCI','urgencias','pediatria'].includes(tipo_unidad)||
      (piso && !texto(piso,10))||!/^\d{1,5}$/.test(String(capacidad))||Number(capacidad)<1||Number(capacidad)>32767) return res.status(422).json({error:'Revisa el número, la unidad, el piso y la cantidad de camas.'});
  const {rows}=await postgres.query(`INSERT INTO hospital.habitacion(id_institucion,numero,tipo_unidad,piso,capacidad)
    VALUES((SELECT id_institucion FROM hospital.institucion WHERE nombre='Hospital General de Prueba'),$1,$2,$3,$4)
    ON CONFLICT DO NOTHING RETURNING id_habitacion AS id`,[numero.trim(),tipo_unidad,piso?.trim()||null,capacidad]);
  if (!rows.length) return res.status(409).json({error:'Ya existe una habitación con ese número.'});
  res.status(201).json(rows[0]);
});
