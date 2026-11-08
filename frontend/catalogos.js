import { selectorPanel } from './panel-acciones.js';
export async function mostrarCatalogos(panel,api,atender) {
  panel.innerHTML='<h2>Catálogos del Hospital</h2><p role="status">Cargando…</p>';
  try {
    const [habitaciones,medicamentos]=await Promise.all([api.catalogos('habitaciones'),api.catalogos('medicamentos')]);
    panel.innerHTML=`<h2>Catálogos del Hospital</h2>
      <section class="catalogo-vista"><h3>Habitaciones y camas</h3><ul class="habitaciones"></ul>
      <form class="nueva"><label>Número o código<input required maxlength="20" name="numero"></label>
      <label>Unidad<select name="tipo_unidad"><option>normal</option><option>UCI</option><option>urgencias</option><option>pediatria</option></select></label>
      <label>Piso (opcional)<input name="piso" maxlength="10"></label><label>Camas<input type="number" min="1" max="32767" step="1" name="capacidad" required></label>
      <button>Crear habitación</button><p class="mensaje" role="status"></p></form></section>
      <section class="catalogo-vista"><h3>Medicamentos y precios</h3><ul class="medicamentos"></ul>
      <form class="nuevo"><h3>Nuevo medicamento</h3><label>Nombre genérico<input required maxlength="150" name="nombre_generico"></label>
      <label>Presentación<input required maxlength="50" name="presentacion" placeholder="Ej. Tableta de 500 mg"></label>
      <label>Unidad de cobro<input required maxlength="30" name="unidad_medida" placeholder="Ej. tableta"></label>
      <label>Precio por unidad (Q)<input required type="number" min=".01" step=".01" name="precio_unitario"></label>
      <button>Crear medicamento</button><p class="mensaje" role="status"></p></form>
      <form class="precio"><h3>Actualizar precio</h3><label>Medicamento<select name="id" required></select></label>
      <label>Nuevo precio (Q)<input required type="number" min=".01" step=".01" name="precio_unitario"></label>
      <button>Guardar precio</button><p class="mensaje" role="status"></p></form></section>`;
    function fila(selector,texto) {
      const li=document.createElement('li'); li.textContent=texto; panel.querySelector(selector).append(li);
    }
    for (const h of habitaciones) fila('.habitaciones',h.numero+' · '+h.tipo_unidad+' · '+h.capacidad+' cama(s)');
    const tarifas=await api.catalogos('tarifas-estancia');
    panel.querySelector('.nueva').insertAdjacentHTML('afterend',`<form class="tarifa"><h3>Tarifa de estancia</h3>
      <label>Tipo de habitación<select name="unidad"></select></label>
      <label>Precio por 24 horas (Q)<input name="tarifa_diaria" type="number" min="0.01" step="0.01" required></label>
      <button>Guardar tarifa para nuevos ingresos y traslados</button><p class="mensaje" role="status"></p></form>`);
    const tarifa=panel.querySelector('.tarifa');
    for (const t of tarifas) tarifa.elements.unidad.add(new Option(t.tipo_unidad,t.tipo_unidad));
    function mostrarTarifa() {
      tarifa.elements.tarifa_diaria.value=tarifas.find(t=>t.tipo_unidad===tarifa.elements.unidad.value)?.tarifa_diaria ?? '';
    }
    mostrarTarifa();
    tarifa.elements.unidad.onchange=mostrarTarifa;
    atender(tarifa,async d=>{
      const guardada=await api.catalogos('tarifas-estancia/'+encodeURIComponent(d.unidad),'PATCH',{tarifa_diaria:d.tarifa_diaria});
      tarifas.find(t=>t.tipo_unidad===d.unidad).tarifa_diaria=guardada.tarifa_diaria;
      tarifa.querySelector('.mensaje').textContent='Tarifa guardada.';
    });
    for (const m of medicamentos) {
      const nombre=m.nombre_generico+' · '+m.presentacion;
      fila('.medicamentos',nombre+' · '+(m.precio_unitario?'Q'+m.precio_unitario+' / '+m.unidad_medida:'Precio pendiente'));
      panel.querySelector('.precio select').add(new Option(nombre,m.id));
    }
    const refrescar=()=>mostrarCatalogos(panel,api,atender);
    atender(panel.querySelector('.nueva'),async d=>{await api.catalogos('habitaciones','POST',d); await refrescar();});
    atender(panel.querySelector('.nuevo'),async d=>{await api.catalogos('medicamentos','POST',d); await refrescar();});
    atender(panel.querySelector('.precio'),async d=>{await api.catalogos('medicamentos/'+encodeURIComponent(d.id),'PATCH',{precio_unitario:d.precio_unitario}); await refrescar();});
    const [especialidades,medicos]=await Promise.all([api.catalogos('especialidades'),api.medicos()]);
    panel.insertAdjacentHTML('beforeend',`<section class="catalogo-vista"><h3>Médicos y especialidades</h3><ul class="profesionales"></ul>
      <form class="especialidad"><h3>Crear especialidad</h3><label>Nombre<input name="nombre" required maxlength="100"></label>
      <label>Descripción<input name="descripcion" maxlength="2000"></label><button>Guardar especialidad</button><p class="mensaje" role="status"></p></form>
      <form class="medico"><h3>Registrar profesional</h3><label>Nombres<input name="nombres" required maxlength="100"></label>
      <label>Apellidos<input name="apellidos" required maxlength="100"></label><label>DPI o CUI<input name="dpi_cui" required maxlength="20"></label>
      <label>Número de colegiado<input name="num_colegiado" required maxlength="30"></label>
      <label>Rol<select name="rol"><option value="medico">Médico</option><option value="especialista">Especialista</option></select></label>
      <label>Especialidad<select name="id_especialidad" required></select></label>
      <label>Teléfono<input name="telefono" maxlength="20"></label><label>Correo electrónico<input name="correo_electronico" type="email" maxlength="150"></label>
      <button>Guardar profesional</button><p class="mensaje" role="status"></p></form></section>`);
    const medico=panel.querySelector('.medico');
    const procedimientos=await api.catalogos('procedimientos');
    panel.insertAdjacentHTML('beforeend',`<section class="catalogo-vista"><h3>Procedimientos y precios</h3>
      <ul class="procedimientos"></ul><form class="precio-procedimiento"><label>Nombre del procedimiento
      <input name="nombre" required maxlength="150" list="nombres-procedimientos"></label><datalist id="nombres-procedimientos"></datalist>
      <label>Precio por realización (Q)<input name="precio" type="number" min="0" step=".01" required></label>
      <button>Guardar precio</button><p class="mensaje" role="status"></p></form></section>`);
    for (const p of procedimientos) {
      fila('.procedimientos',p.nombre+' · Q'+p.precio);
      panel.querySelector('#nombres-procedimientos').append(new Option(p.nombre,p.nombre));
    }
    atender(panel.querySelector('.precio-procedimiento'),async d=>{
      await api.catalogos('procedimientos','POST',d);
      await mostrarCatalogos(panel,api,atender);
    });
    medico.insertAdjacentHTML('beforebegin',`<form class="honorario"><h3>Honorario por visita hospitalaria</h3>
      <label>Médico<select name="profesional" required></select></label>
      <label>Precio por visita (Q)<input name="tarifa_visita" required type="number" min="0" step=".01"></label>
      <button>Guardar honorario</button><p class="mensaje" role="status"></p></form>`);
    const honorario=panel.querySelector('.honorario');
    for (const m of medicos) honorario.elements.profesional.add(new Option(m.nombres+' '+m.apellidos,m.id));
    const seleccionado=()=>medicos.find(m=>m.id===honorario.elements.profesional.value);
    function mostrarHonorario() { honorario.elements.tarifa_visita.value=seleccionado()?.tarifa_visita??''; }
    mostrarHonorario();
    honorario.elements.profesional.onchange=mostrarHonorario;
    atender(honorario,async d=>{
      const guardado=await api.catalogos('medicos/'+encodeURIComponent(d.profesional)+'/tarifa','PATCH',{tarifa_visita:d.tarifa_visita});
      medicos.find(m=>m.id===d.profesional).tarifa_visita=guardado.tarifa_visita;
      honorario.querySelector('.mensaje').textContent='Honorario guardado para próximas visitas.';
    });
    for (const e of especialidades) medico.elements.id_especialidad.add(new Option(e.nombre,e.id));
    for (const m of medicos) fila('.profesionales',m.nombres+' '+m.apellidos+' · '+(m.especialidad||'Sin especialidad'));

    atender(panel.querySelector('.especialidad'),async d=>{await api.catalogos('especialidades','POST',d); await refrescar();});
    atender(medico,async d=>{await api.catalogos('medicos','POST',d); await refrescar();});
    const vistas=[...panel.querySelectorAll('.catalogo-vista')];
    const acciones=[
      ['Ver habitaciones','Crear habitación','Tarifa de estancia'],
      ['Ver medicamentos','Crear medicamento','Actualizar precio'],
      ['Ver profesionales','Crear especialidad','Honorario por visita','Registrar profesional'],
      ['Ver procedimientos','Configurar precio']
    ];
    const menu=document.createElement('nav');
    menu.className='menu-catalogos'; menu.setAttribute('aria-label','Catálogos del Hospital');
    panel.querySelector('h2').after(menu);
    const botones=[];
    function abrir(indice) {
      panel.dataset.catalogo=String(indice);
      vistas.forEach((vista,i)=>{
        vista.hidden=i!==indice;
        botones[i].setAttribute('aria-pressed',String(i===indice));
      });
    }
    vistas.forEach((vista,i)=>{
      const titulo=vista.querySelector('h3');
      const boton=document.createElement('button');
      boton.type='button'; boton.textContent=titulo.textContent; boton.onclick=()=>abrir(i);
      menu.append(boton); botones.push(boton);
      const elementos=[...vista.children].filter(el=>el.matches('ul,form'));
      const opciones=elementos.map((el,j)=>[String(j),acciones[i][j]]);
      const clave='accion'+i;
      titulo.after(selectorPanel('Acción',opciones,valor=>{
        panel.dataset[clave]=valor;
        elementos.forEach((el,j)=>{el.hidden=String(j)!==valor;});
      },panel.dataset[clave]));
    });
    abrir(Number(panel.dataset.catalogo)||0);
  } catch(error) {panel.textContent=error.message;}
}
