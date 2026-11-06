const estado = '<p class="mensaje" role="status"></p>';
const fechaLocal = valor => new Intl.DateTimeFormat('es-GT',{dateStyle:'short',timeStyle:'short',timeZone:'America/Guatemala'}).format(new Date(valor));

export function cargarAmbulatorio({secciones,seleccionar,formulario, paciente, antecedentes, citas, medicos, api, atender, actualizar}) {
  const panel = document.createElement('section');
  panel.innerHTML = `<aside class="antecedentes-box"><h3>Antecedentes y alergias</h3><ul class="antecedentes"></ul>
    <details><summary>Agregar antecedente</summary><form class="antecedente">
    <label>Tipo<select name="tipo"><option value="alergico">Alergia</option><option value="patologico">Patológico</option><option value="quirurgico">Quirúrgico</option><option value="familiar">Familiar</option></select></label>
    <label>Descripción<input name="descripcion" required></label><label>Gravedad de la alergia (opcional)<input name="gravedad" maxlength="30"></label>
    <button>Guardar antecedente</button>${estado}</form></details></aside>
    <h2>Citas del paciente</h2><ul class="citas"></ul>
    <details class="editor"><summary>Agendar o reprogramar cita</summary><form class="cita">
    <label>Cita<select name="cita"><option value="">Nueva cita</option></select></label>
    <label>Médico<select name="id_personal" required></select></label>
    <label>Fecha y hora de Guatemala (turnos de 30 minutos)<input name="fecha" type="datetime-local" step="1800" required></label>
    <label>Motivo<input name="motivo" maxlength="255" required></label><button>Guardar cita</button>${estado}</form></details>
    <details><summary>Agenda del médico</summary><form class="agenda">
    <label>Médico<select name="medico" required></select></label><label>Desde<input type="date" name="desde" required></label>
    <label>Hasta<input type="date" name="hasta" required></label><button>Ver horarios ocupados</button>${estado}</form><ul class="ocupados"></ul></details>`;
  secciones.citas.append(panel);
  const antecedentesBox=panel.querySelector('.antecedentes-box');
  formulario.before(antecedentesBox);
  function linea(selector, texto) {
    const item = document.createElement('li');
    item.textContent = texto;
    (selector==='.antecedentes'?antecedentesBox:panel).querySelector(selector).append(item);
    return item;
  }
  for (const a of antecedentes) linea('.antecedentes',[a.tipo,a.descripcion,a.gravedad].filter(Boolean).join(' · '));
  if (!antecedentes.length) linea('.antecedentes','Sin antecedentes registrados.');
  const antecedente = antecedentesBox.querySelector('.antecedente');
  antecedente.elements.tipo.onchange = () => { antecedente.elements.gravedad.disabled = antecedente.elements.tipo.value !== 'alergico'; };
  atender(antecedente,async datos => { await api.antecedente(paciente.id,datos); actualizar(); });
  const cita = panel.querySelector('.cita');
  const agenda = panel.querySelector('.agenda');
  for (const m of medicos) {
    const nombre = [m.nombres + ' ' + m.apellidos,m.especialidad].filter(Boolean).join(' · ');
    for (const select of [formulario.elements.id_personal,cita.elements.id_personal,agenda.elements.medico]) select.add(new Option(nombre,m.id));
  }
  formulario.insertAdjacentHTML('afterbegin','<label>Cita de origen<select name="id_cita"><option value="">Atención sin cita</option></select></label>');
  const origen = formulario.elements.id_cita;
  for (const c of citas) {
    const detalle = fechaLocal(c.fecha) + ' · ' + c.medico + ' · ' + (c.motivo || '');
    const fila = linea('.citas',detalle + ' · ' + c.estado + ' ');
    if (c.estado !== 'programada') continue;
    origen.add(new Option(detalle,c.id));
    cita.elements.cita.add(new Option(detalle,c.id));
    const accion = document.createElement('button');
    accion.type = 'button';
    accion.textContent = 'Atender';
    accion.onclick = () => { seleccionar('atencion'); origen.value=c.id; origen.onchange(); formulario.elements.motivo.focus(); };
    fila.append(accion);
    const cancelar = document.createElement('button');
    cancelar.className='secundario';
    cancelar.textContent='Cancelar cita';
    cancelar.onclick=async () => {
      if (!window.confirm('¿Cancelar esta cita de ' + paciente.nombres + '?')) return;
      cancelar.disabled=true;
      try { await api.cancelar(paciente.id,c.id); actualizar(); }
      catch(error) { cancelar.disabled=false; fila.append(document.createTextNode(error.message)); }
    };
    fila.append(cancelar);
  }
  if (!citas.length) linea('.citas','Sin citas registradas.');
  origen.onchange = () => {
    const seleccion = citas.find(c => c.id === origen.value);
    formulario.elements.id_personal.disabled = Boolean(seleccion);
    if (seleccion) { formulario.elements.id_personal.value=seleccion.id_personal; formulario.elements.motivo.value=seleccion.motivo || ''; }
  };
  cita.elements.cita.onchange = () => {
    const elegida = citas.find(c => c.id === cita.elements.cita.value);
    if (!elegida) { cita.reset(); return; }
    cita.elements.id_personal.value=elegida.id_personal;
    cita.elements.motivo.value=elegida.motivo || '';
    // El control datetime-local representa la hora civil de Guatemala (UTC-06).
    cita.elements.fecha.value=new Date(new Date(elegida.fecha).getTime()-6*3600000).toISOString().slice(0,16);
  };
  atender(cita,async ({cita:seleccion,...datos}) => { await api.guardarCita(paciente.id,seleccion,datos); actualizar(); });
  atender(agenda,async datos => {
    panel.querySelector('.ocupados').replaceChildren();
    const turnos = await api.agenda(datos);
    for (const turno of turnos) linea('.ocupados',fechaLocal(turno.fecha)+' · '+turno.paciente);
    if (!turnos.length) linea('.ocupados','Sin citas pendientes en ese periodo.');
  });
}
