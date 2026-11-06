import assert from 'node:assert/strict';

// Prueba de integración local. Crea un paciente ficticio y lo deja archivado.
const cuentas = {
  secretaria: ['secretaria.laboratorio', process.env.API_SECRETARIA_LAB_PASSWORD],
  laboratorista: ['laboratorista.laboratorio', process.env.API_LABORATORISTA_PASSWORD],
  maria: ['maria.laboratorio', process.env.API_LAB_PASSWORD],
  hospital: ['maria.hospital', process.env.API_HOSPITAL_PASSWORD]
};
async function solicitar(rol, ruta, estado, metodo='GET', datos) {
  const [usuario, clave]=cuentas[rol];
  assert.ok(clave, 'Configura la contraseña de '+usuario+' en .env');
  const respuesta=await fetch('http://127.0.0.1:3100/api'+ruta, {
    method:metodo,
    signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Basic '+Buffer.from(usuario+':'+clave).toString('base64'),'Content-Type':'application/json'},
    body:datos===undefined?undefined:JSON.stringify(datos)
  });
  assert.equal(respuesta.status,estado,metodo+' '+ruta+' ('+rol+')');
  const contenido=await respuesta.json();
  if (ruta==='/pacientes' && metodo==='POST' && estado===201 && rol==='secretaria') {
    assert.equal(respuesta.headers.get('location'),'/api/pacientes/'+contenido.id+'/datos');
  }
  return contenido;
}
assert.equal((await fetch('http://127.0.0.1:3100/api/pacientes')).status,401);
assert.equal((await solicitar('secretaria','/sesion',200)).rol,'secretaria');
assert.equal((await solicitar('laboratorista','/sesion',200)).rol,'laboratorista');
assert.equal((await solicitar('maria','/sesion',200)).rol,'laboratorista');
const {id}=await solicitar('secretaria','/pacientes',201,'POST',{
  nombres:'Demo Roles',apellidos:'Laboratorio',fecha_nacimiento:'2000-01-01'
});
assert.ok((await solicitar('secretaria','/pacientes?buscar='+id,200)).some(p=>p.id===id));
await solicitar('secretaria','/pacientes',422,'POST',{nombres:'Inválido'});
await solicitar('laboratorista','/pacientes/inexistente/historial',404);
await solicitar('secretaria','/pacientes/'+id,200,'PATCH',{telefono:'55550000'});
await solicitar('laboratorista','/tipos-examen',200);
await solicitar('laboratorista','/pacientes/'+id+'/examenes',201,'POST',{
  tipo_id:'orina',resultados:{color:'amarillo',aspecto:'claro',ph:6}
});
const datos=await solicitar('secretaria','/pacientes/'+id+'/datos',200);
assert.equal(datos.telefono,'55550000');
assert.ok(!('examenes' in datos) && !('consultas' in datos));
for (const ruta of ['/tipos-examen','/medicos','/agenda','/catalogos/medicamentos',
  '/pacientes/'+id+'/historial','/pacientes/'+id+'/HISTORIAL/',
  '/pacientes/'+id+'/citas','/pacientes/'+id+'/hospitalizaciones']) {
  await solicitar('secretaria',ruta,403);
}
for (const ruta of ['examenes','consultas']) await solicitar('secretaria','/pacientes/'+id+'/'+ruta,403,'POST',{});
const base='/pacientes/'+id;
const consulta={motivo:'Atención ficticia de integración',notas:'Prueba académica',
  diagnosticos:[{codigo_cie:'DEMO',descripcion:'Diagnóstico ficticio',tipo:'presuntivo'}],
  tratamientos:[{nombre_procedimiento:'Procedimiento ficticio'}],
  recetas:[{medicamentos:[{medicamento:'Medicamento ficticio',dosis:'Demo',frecuencia:'Demo',duracion:'Demo'}]}]};
await solicitar('laboratorista',base+'/consultas',201,'POST',consulta);
for (const examen of [
  {tipo_id:'hematologia',resultados:{hemoglobina:13,hematocrito:40,leucocitos:6000,plaquetas:250000}},
  {tipo_id:'cultivo',resultados:{muestra:'Ficticia',resultado:'Prueba',observaciones:'Sin uso clínico'}},
  {tipo:'Personalizado de prueba',resultados:{parametro:{valor:7,unidad:'demo'},nota:'Ficticio'}}
]) await solicitar('laboratorista',base+'/examenes',201,'POST',examen);
for (const examen of [
  {tipo_id:'desconocido',resultados:{valor:1}},
  {tipo_id:'orina',resultados:{color:'amarillo',aspecto:'claro'}},
  {tipo_id:'orina',resultados:{color:'amarillo',aspecto:'claro',ph:'texto'}},
  {tipo_id:'orina',resultados:{color:'amarillo',aspecto:'claro',ph:6,extra:1}},
  {tipo:'Inválido',resultados:{'$campo':1}}
]) await solicitar('laboratorista',base+'/examenes',422,'POST',examen);
const antes=await solicitar('laboratorista',base+'/historial',200);
assert.equal(antes.examenes.length,4);
assert.equal(antes.consultas.length,1);
for (const campo of ['diagnosticos','tratamientos','recetas']) assert.deepEqual(antes.consultas[0][campo],consulta[campo]);
await solicitar('secretaria',base+'/archivo',422,'POST',{motivo:''});
await solicitar('secretaria','/pacientes/'+id+'/archivo',200,'POST',{motivo:'Fin de prueba de permisos'});
const archivado=await solicitar('secretaria',base+'/datos',200);
await solicitar('secretaria',base+'/archivo',200,'POST',{motivo:'Reintento'});
assert.deepEqual(await solicitar('secretaria',base+'/datos',200),archivado);
await solicitar('laboratorista',base+'/consultas',409,'POST',consulta);
await solicitar('laboratorista','/pacientes/'+id+'/examenes',409,'POST',{
  tipo_id:'orina',resultados:{color:'amarillo',aspecto:'claro',ph:6}
});
const despues=await solicitar('laboratorista',base+'/historial',200);
assert.equal(despues.paciente.estado,'baja');
assert.deepEqual(despues.examenes,antes.examenes);
assert.deepEqual(despues.consultas,antes.consultas);
await solicitar('hospital',base+'/historial',404);
await solicitar('hospital','/pacientes',200);
console.log('Flujo completo correcto: alta, búsqueda, edición, atención, cuatro estudios, validaciones, roles, aislamiento y archivo. Paciente ficticio archivado: '+id);
