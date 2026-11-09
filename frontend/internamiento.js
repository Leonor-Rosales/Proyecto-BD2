import { mostrarCuenta } from './facturacion.js';
import { selectorPanel } from './panel-acciones.js';
export async function mostrarInternamiento({secciones,paciente,api,atender,actualizar,rol}) {
  const cuerpo=secciones.internamiento;
  const [ingresos,habitaciones]=await Promise.all([api.internamientos(paciente.id),api.habitaciones(paciente.id)]);
  const activo=ingresos.find(h=>h.estado==='internado');
  const actual=activo?.estancias.find(e=>!e.fin);
  let refrescarCuenta;
  const indicador=document.createElement('h3');
  indicador.textContent=activo?'Paciente internado · Habitación '+(actual?.habitacion || 'sin asignar'):'Ingreso hospitalario';
  cuerpo.append(indicador);
  cuerpo.insertAdjacentHTML('beforeend',`<form class="asignacion">
    <label>Unidad<select name="unidad"><option value="">Todas las unidades</option><option>normal</option><option>UCI</option><option>urgencias</option><option>pediatria</option></select></label>
    <label>Habitación disponible<select name="id_habitacion" required></select></label>
    ${activo?'':'<label>Motivo de ingreso<input name="motivo" required maxlength="4000"></label>'}
    <button>${activo?'Trasladar paciente':'Ingresar paciente'}</button><p class="mensaje" role="status"></p></form>`);
  const form=cuerpo.querySelector('form');
  function filtrar() {
    const disponibles=habitaciones.filter(h=>h.id!==actual?.id_habitacion && (!form.elements.unidad.value || h.tipo_unidad===form.elements.unidad.value));
    form.elements.id_habitacion.replaceChildren(new Option(disponibles.length?'Selecciona una habitación':'Sin camas disponibles',''));
    for (const h of disponibles) form.elements.id_habitacion.add(new Option(h.numero+' · '+h.tipo_unidad+' · Camas libres: '+h.libres+' de '+h.capacidad,h.id));
    form.querySelector('button').disabled=!disponibles.length;
  }
  filtrar();
  form.elements.unidad.onchange=filtrar;
  atender(form,async ({id_habitacion,motivo})=>{
    await api.movimiento(paciente.id,activo?'/'+activo.id+'/traslados':'',{id_habitacion,motivo});
    actualizar();
  });
  if (activo) {
    const {medicamentos}=await api.catalogoHospital(paciente.id);
    cuerpo.insertAdjacentHTML('beforeend',`<form class="administrar"><h3>Administrar medicamento</h3>
      <label>Medicamento<select name="id_medicamento" required></select></label>
      <label>Cantidad de unidades administradas<input name="cantidad" type="number" min="0.01" step="0.01" required value="1"></label>
      <output></output><button>Registrar administración y cobrar</button><p class="mensaje" role="status"></p></form>`);
    const admin=cuerpo.querySelector('.administrar');
    const conPrecio=medicamentos.filter(m=>m.precio_unitario);
    for (const m of conPrecio) admin.elements.id_medicamento.add(new Option(m.nombre_generico+' · '+m.presentacion+' · Q'+m.precio_unitario+' / '+m.unidad_medida,m.id));
    let clave=crypto.randomUUID();
    function estimar() {
      const m=conPrecio.find(m=>m.id===admin.elements.id_medicamento.value);
      admin.querySelector('output').textContent=m?'Importe estimado: Q'+(Number(m.precio_unitario)*Number(admin.elements.cantidad.value)).toFixed(2):'Agrega un medicamento con precio en Catálogos del Hospital.';
      admin.querySelector('button').disabled=!m;
    }
    estimar(); admin.oninput=()=>{clave=crypto.randomUUID();estimar();};
    atender(admin,async datos=>{
      const cargo=await api.registrarImporte(paciente.id,activo.id,'administraciones',datos,clave);
      clave=crypto.randomUUID();
      admin.querySelector('.mensaje').textContent='Administración registrada. Cargo '+cargo.id+' agregado a la cuenta.';
      if (refrescarCuenta) await refrescarCuenta();
    });
    cuerpo.insertAdjacentHTML('beforeend','<form class="alta-hospitalaria"><button>Dar alta hospitalaria</button><p class="mensaje" role="status"></p></form>');
    atender(cuerpo.querySelector('.alta-hospitalaria'),async ()=>{
      if (!confirm('¿Cerrar la hospitalización de '+paciente.nombres+', liberar la cama y emitir la factura con los cargos registrados?')) return;
      await api.movimiento(paciente.id,'/'+activo.id+'/alta',{});
      actualizar();
    });
  }
  const horario=valor=>new Date(valor).toLocaleString('es-GT',{timeZone:'America/Guatemala'});
  if (!ingresos.length) {
    const aviso=document.createElement('p'); aviso.textContent='El paciente aún no tiene hospitalizaciones con una cuenta asociada.'; secciones.cuenta.append(aviso);
  }
  const historial=document.createElement('section');
  cuerpo.append(historial);
  for (const h of ingresos) {
    const titulo=document.createElement('h4');
    titulo.textContent='Ingreso del '+horario(h.fecha_ingreso)+' · '+h.estado;
    const motivo=document.createElement('p');
    motivo.textContent=h.motivo_ingreso;
    const lista=document.createElement('ul');
    for (const e of h.estancias) {
      const item=document.createElement('li');
      item.textContent=e.habitacion+' · '+e.unidad+' · '+horario(e.inicio)+' → '+(e.fin?horario(e.fin):'Estancia actual');
      lista.append(item);
    }
    historial.append(titulo,motivo,lista);
  }
  const acciones=[[form,activo?'Trasladar paciente':'Ingresar paciente']];
  if (activo) acciones.unshift([cuerpo.querySelector('.administrar'),'Administrar medicamento']);
  if (ingresos.length) acciones.push([historial,'Ver estancias']);
  if (activo) acciones.push([cuerpo.querySelector('.alta-hospitalaria'),'Dar alta hospitalaria']);
  if (acciones.length>1) {
    indicador.after(selectorPanel('Acción de hospitalización',acciones.map(([el,nombre])=>[nombre,nombre]),elegida=>{
      for (const [el,nombre] of acciones) el.hidden=nombre!==elegida;
    }));
  }
  if (ingresos.length) {
    const cuenta=document.createElement('div');
    secciones.cuenta.append(cuenta);
    cuenta.before(selectorPanel('Cuenta del ingreso',ingresos.map(h=>[String(h.id),horario(h.fecha_ingreso)+' · '+h.estado]),id=>{
      const ingreso=ingresos.find(h=>String(h.id)===id);
      refrescarCuenta=()=>mostrarCuenta(cuenta,paciente,ingreso,api,atender,rol==='administrador');
      refrescarCuenta();
    },activo && String(activo.id)));
  }
}
