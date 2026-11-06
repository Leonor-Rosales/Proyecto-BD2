export async function mostrarCatalogos(panel,api,atender) {
  panel.innerHTML='<h2>Catálogos del Hospital</h2><p role="status">Cargando…</p>';
  try {
    const [habitaciones,medicamentos]=await Promise.all([api.catalogos('habitaciones'),api.catalogos('medicamentos')]);
    panel.innerHTML=`<h2>Catálogos del Hospital</h2>
      <details class="panel" open><summary>Habitaciones y camas</summary><ul class="habitaciones"></ul>
      <form class="nueva"><label>Número o código<input required maxlength="20" name="numero"></label>
      <label>Unidad<select name="tipo_unidad"><option>normal</option><option>UCI</option><option>urgencias</option><option>pediatria</option></select></label>
      <label>Piso (opcional)<input name="piso" maxlength="10"></label><label>Camas<input type="number" min="1" max="32767" step="1" name="capacidad" required></label>
      <button>Crear habitación</button><p class="mensaje" role="status"></p></form></details>
      <details class="panel"><summary>Medicamentos y precios</summary><ul class="medicamentos"></ul>
      <form class="nuevo"><h3>Nuevo medicamento</h3><label>Nombre genérico<input required maxlength="150" name="nombre_generico"></label>
      <label>Presentación<input required maxlength="50" name="presentacion" placeholder="Ej. Tableta de 500 mg"></label>
      <label>Unidad de cobro<input required maxlength="30" name="unidad_medida" placeholder="Ej. tableta"></label>
      <label>Precio por unidad (Q)<input required type="number" min=".01" step=".01" name="precio_unitario"></label>
      <button>Crear medicamento</button><p class="mensaje" role="status"></p></form>
      <form class="precio"><h3>Actualizar precio</h3><label>Medicamento<select name="id" required></select></label>
      <label>Nuevo precio (Q)<input required type="number" min=".01" step=".01" name="precio_unitario"></label>
      <button>Guardar precio</button><p class="mensaje" role="status"></p></form></details>`;
    function fila(selector,texto) {
      const li=document.createElement('li'); li.textContent=texto; panel.querySelector(selector).append(li);
    }
    for (const h of habitaciones) fila('.habitaciones',h.numero+' · '+h.tipo_unidad+' · '+h.capacidad+' cama(s)');
    for (const m of medicamentos) {
      const nombre=m.nombre_generico+' · '+m.presentacion;
      fila('.medicamentos',nombre+' · '+(m.precio_unitario?'Q'+m.precio_unitario+' / '+m.unidad_medida:'Precio pendiente'));
      panel.querySelector('.precio select').add(new Option(nombre,m.id));
    }
    async function refrescar(medicamento) {
      await mostrarCatalogos(panel,api,atender);
      const formulario=panel.querySelector('.nuevo');
      if (medicamento && formulario) formulario.closest('details').open=true;
    }
    atender(panel.querySelector('.nueva'),async d=>{await api.catalogos('habitaciones','POST',d); await refrescar(false);});
    atender(panel.querySelector('.nuevo'),async d=>{await api.catalogos('medicamentos','POST',d); await refrescar(true);});
    atender(panel.querySelector('.precio'),async d=>{await api.catalogos('medicamentos/'+encodeURIComponent(d.id),'PATCH',{precio_unitario:d.precio_unitario}); await refrescar(true);});
    const [especialidades,medicos]=await Promise.all([api.catalogos('especialidades'),api.medicos()]);
    panel.insertAdjacentHTML('beforeend',`<details class="panel"><summary>Médicos y especialidades</summary><ul class="profesionales"></ul>
      <form class="especialidad"><h3>Crear especialidad</h3><label>Nombre<input name="nombre" required maxlength="100"></label>
      <label>Descripción<input name="descripcion" maxlength="2000"></label><button>Guardar especialidad</button><p class="mensaje" role="status"></p></form>
      <form class="medico"><h3>Registrar profesional</h3><label>Nombres<input name="nombres" required maxlength="100"></label>
      <label>Apellidos<input name="apellidos" required maxlength="100"></label><label>DPI o CUI<input name="dpi_cui" required maxlength="20"></label>
      <label>Número de colegiado<input name="num_colegiado" required maxlength="30"></label>
      <label>Rol<select name="rol"><option value="medico">Médico</option><option value="especialista">Especialista</option></select></label>
      <label>Especialidad<select name="id_especialidad" required></select></label>
      <label>Teléfono<input name="telefono" maxlength="20"></label><label>Correo electrónico<input name="correo_electronico" type="email" maxlength="150"></label>
      <button>Guardar profesional</button><p class="mensaje" role="status"></p></form></details>`);
    const medico=panel.querySelector('.medico');
    for (const e of especialidades) medico.elements.id_especialidad.add(new Option(e.nombre,e.id));
    for (const m of medicos) fila('.profesionales',m.nombres+' '+m.apellidos+' · '+(m.especialidad||'Sin especialidad'));
    async function recargarProfesionales() {
      await mostrarCatalogos(panel,api,atender);
      panel.querySelector('.medico')?.closest('details').setAttribute('open','');
    }
    atender(panel.querySelector('.especialidad'),async d=>{await api.catalogos('especialidades','POST',d); await recargarProfesionales();});
    atender(medico,async d=>{await api.catalogos('medicos','POST',d); await recargarProfesionales();});
  } catch(error) {panel.textContent=error.message;}
}
