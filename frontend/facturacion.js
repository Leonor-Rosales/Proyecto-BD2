const moneda=valor=>new Intl.NumberFormat('es-GT',{style:'currency',currency:'GTQ'}).format(valor);
export function mostrarCuenta(cuerpo,paciente,h,api,atender,fecha,abrir) {
  const panel=document.createElement('details');
  panel.innerHTML='<summary></summary><section aria-live="polite"></section>';
  panel.querySelector('summary').textContent='Ingreso del '+fecha+' · '+h.estado;
  cuerpo.append(panel);
  const vista=panel.querySelector('section');
  async function cargar() {
    vista.textContent='Consultando cuenta…';
    try {
      const cuenta=await api.cuenta(paciente.id,h.id);
      vista.replaceChildren();
      function linea(texto) {
        const p=document.createElement('p'); p.textContent=texto; vista.append(p);
      }
      const resumen=document.createElement('dl');
      resumen.className='resumen-cuenta';
      const cifras=[['Cargos acumulados',moneda(cuenta.acumulado)]];
      if (cuenta.factura) cifras.push(['Saldo pendiente',moneda(cuenta.factura.saldo)],['Factura '+cuenta.factura.id,cuenta.factura.estado]);
      for (const [nombre,valor] of cifras) {
        const grupo=document.createElement('div');
        const dt=document.createElement('dt'),dd=document.createElement('dd');
        dt.textContent=nombre; dd.textContent=valor; grupo.append(dt,dd); resumen.append(grupo);
      }
      vista.append(resumen);
      if (cuenta.cargos.length) {
        const bloque=document.createElement('div'); bloque.className='tabla-cuenta';
        bloque.innerHTML='<table><caption>Detalle de cargos</caption><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio</th><th>Importe</th></tr></thead><tbody></tbody></table>';
        for (const c of cuenta.cargos) {
          const fila=bloque.querySelector('tbody').insertRow();
          for (const texto of [[c.descripcion,c.medicamento,c.profesional].filter(Boolean).join(' · '),c.cantidad,moneda(c.precio_unitario),moneda(c.subtotal)]) fila.insertCell().textContent=texto;
        }
        vista.append(bloque);
      }
      function guardar(form,accion) {
        let clave=crypto.randomUUID();
        form.oninput=()=>{clave=crypto.randomUUID();};
        atender(form,async datos=>{
          await api.registrarImporte(paciente.id,h.id,accion,datos,clave);
          await cargar();
        });
      }
      if (h.estado==='internado') {
        const [catalogo,medicos]=await Promise.all([api.catalogoHospital(paciente.id),api.medicos()]);
        vista.insertAdjacentHTML('beforeend',`<form class="cargo"><h4>Registrar cargo</h4>
          <label>Tipo de cargo<select name="tipo"><option value="servicio">Servicio</option><option value="material">Material</option>
          <option value="medicamento">Medicamento</option><option value="honorario_medico">Honorario médico</option></select></label>
          <label hidden>Medicamento<select name="id_medicamento"></select></label>
          <label hidden>Profesional<select name="id_personal"></select></label>
          <label>Concepto<input required name="descripcion" maxlength="255"></label><label>Cantidad<input name="cantidad" type="number" step="0.01" min="0.01" value="1" required></label>
          <label>Precio unitario (Q)<input name="precio_unitario" type="number" step="0.01" min="0.01" required></label>
          <button>Guardar cargo</button><p class="mensaje" role="status"></p></form>`);
        const form=vista.querySelector('.cargo');
        for (const m of catalogo.medicamentos) form.elements.id_medicamento.add(new Option(m.nombre_generico+' · '+m.presentacion,m.id));
        for (const m of medicos) form.elements.id_personal.add(new Option(m.nombres+' '+m.apellidos,m.id));
        function tipo() {
          for (const [campo,nombre] of [['id_medicamento','medicamento'],['id_personal','honorario_medico']]) {
            const select=form.elements[campo]; select.disabled=form.elements.tipo.value!==nombre;
            select.required=!select.disabled; select.parentElement.hidden=select.disabled;
          }
        }
        tipo(); form.elements.tipo.onchange=tipo; guardar(form,'cargos');
      }
      if (cuenta.factura) {
        const f=cuenta.factura;
        if (cuenta.pagos.length) {const titulo=document.createElement('h3'); titulo.textContent='Pagos registrados'; vista.append(titulo);}
        for (const pago of cuenta.pagos) linea('Pago '+pago.id+' · '+moneda(pago.monto)+' · '+pago.metodo+(pago.referencia?' · '+pago.referencia:''));
        if (Number(f.saldo)>0) {
          vista.insertAdjacentHTML('beforeend',`<form class="pago"><label>Abono (Q)<input name="monto" type="number" min="0.01" step="0.01" required></label>
            <label>Método<select name="metodo"><option>efectivo</option><option>tarjeta</option><option>seguro</option></select></label>
            <label>Referencia de pago (opcional)<input name="referencia" maxlength="100"></label><button>Registrar pago</button><p class="mensaje" role="status"></p></form>`);
          const form=vista.querySelector('.pago'); form.elements.monto.max=f.saldo; guardar(form,'pagos');
        }
      } else if (h.estado==='alta') {
        vista.insertAdjacentHTML('beforeend','<form><button>Emitir factura del ingreso anterior</button><p class="mensaje" role="status"></p></form>');
        guardar(vista.querySelector('form'),'factura');
      }
    } catch(error) {vista.textContent=error.message;}
  }
  panel.ontoggle=()=>{if (panel.open) cargar();};
  panel.open=abrir;
}
