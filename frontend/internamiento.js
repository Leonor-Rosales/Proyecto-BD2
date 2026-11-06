import { mostrarCuenta } from './facturacion.js';
export async function mostrarInternamiento({secciones,paciente,api,atender,actualizar}) {
  const cuerpo=secciones.internamiento;
  const [ingresos,habitaciones]=await Promise.all([api.internamientos(paciente.id),api.habitaciones(paciente.id)]);
  const activo=ingresos.find(h=>h.estado==='internado');
  const actual=activo?.estancias.find(e=>!e.fin);
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
    cuerpo.append(titulo,motivo,lista);
    mostrarCuenta(secciones.cuenta,paciente,h,api,atender,horario(h.fecha_ingreso),ingresos.length===1);
  }
}
