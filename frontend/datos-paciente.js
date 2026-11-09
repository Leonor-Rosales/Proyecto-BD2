export const camposPaciente = `<fieldset><legend>Identificación y contacto</legend>
  <label>DPI o CUI (opcional)<input name="dpi_cui" maxlength="20"></label>
  <label>Género (opcional)<input name="genero" maxlength="20"></label>
  <label>Dirección<input name="direccion" maxlength="255"></label>
  <label>Teléfono<input name="telefono" maxlength="20"></label>
  <label>Correo electrónico<input name="correo_electronico" type="email" maxlength="150"></label>
  <label>Contacto de emergencia<input name="contacto_emergencia_nombre" maxlength="150"></label>
  <label>Teléfono de emergencia<input name="contacto_emergencia_telefono" maxlength="20"></label></fieldset>`;

const confirmacionesArchivo = {
  hospital: '¿Archivar el expediente y cancelar sus citas pendientes?',
  laboratorio: '¿Archivar el expediente del Laboratorio conservando sus resultados?',
  pediatria: '¿Archivar el expediente de Pediatría conservando sus controles y vacunas?',
  odontologia: '¿Archivar el expediente de Odontología conservando su historial y tratamientos?'
};

export async function mostrarDatos(panel,id,api,atender,actualizar,entidad='hospital') {
  const p=await api.datosPaciente(id);
  panel.innerHTML=`<h2>Datos del paciente</h2><p class="estado-paciente"></p>
    <form class="editar"><label>Nombres<input name="nombres" required maxlength="100"></label>
    <label>Apellidos<input name="apellidos" required maxlength="100"></label>
    <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" required></label>
    ${camposPaciente}<button>Guardar datos</button><p class="mensaje" role="status"></p></form>
    ${p.estado==='baja'?'':'<details><summary>Archivar expediente</summary><form class="archivo"><label>Causa de baja<textarea name="motivo" maxlength="2000" required></textarea></label><button>Confirmar archivo</button><p class="mensaje" role="status"></p></form></details>'}`;
  panel.querySelector('.estado-paciente').textContent=p.estado==='baja'?'Archivado · '+p.motivo_baja:'Estado · '+p.estado;
  const form=panel.querySelector('.editar');
  for (const input of form.querySelectorAll('input')) input.value=p[input.name]||'';
  atender(form,async d=>{await api.editarPaciente(id,d); actualizar();});
  const archivo=panel.querySelector('.archivo');
  if (archivo) atender(archivo,async d=>{
    const mensajeConfirm = confirmacionesArchivo[entidad] || '¿Confirmas que deseas dar de baja y archivar este expediente clínico?';
    if (!confirm(mensajeConfirm)) return;
    await api.archivarPaciente(id,d); actualizar();
  });
}

export async function mostrarSecretaria(raiz,id,api,atender,actualizar,entidad='hospital') {
  if (entidad !== 'hospital') {
    raiz.innerHTML='<p>Gestión administrativa · Identificación, contacto y archivo del expediente.</p><section class="datos"></section>';
    await mostrarDatos(raiz.querySelector('.datos'),id,api,atender,actualizar,entidad);
    return;
  }
  raiz.innerHTML='<section class="datos"></section><section class="agenda-secretaria"><h2>Citas del paciente</h2><ul></ul><h3>Agendar cita</h3><form><label>Médico<select name="id_personal" required></select></label><label>Fecha y hora de Guatemala<input name="fecha" type="datetime-local" step="1800" required></label><label>Motivo de reserva<input name="motivo" required maxlength="255"></label><button>Agendar cita</button><p class="mensaje" role="status"></p></form></section>';
  await mostrarDatos(raiz.querySelector('.datos'),id,api,atender,actualizar,entidad);
  const [citas,medicos]=await Promise.all([api.citasPaciente(id),api.medicos()]);
  const form=raiz.querySelector('.agenda-secretaria form');
  form.insertAdjacentHTML('afterbegin','<label>Cita<select name="cita"><option value="">Nueva cita</option></select></label>');
  for (const m of medicos) form.elements.id_personal.add(new Option(m.nombres+' '+m.apellidos,m.id));
  atender(form,async ({cita,...d})=>{await api.guardarCita(id,cita,d); actualizar();});
  form.querySelector('button').textContent='Guardar cita';
  for (const cita of citas) {
    const li=document.createElement('li');
    li.textContent=new Date(cita.fecha).toLocaleString('es-GT',{timeZone:'America/Guatemala'})+' · '+cita.medico+' · '+cita.estado;
    raiz.querySelector('ul').append(li);
    if (cita.estado==='programada') {
      form.elements.cita.add(new Option(new Date(cita.fecha).toLocaleString('es-GT',{timeZone:'America/Guatemala'})+' · '+cita.medico,cita.id));
      const cancelacion=document.createElement('form');
      cancelacion.innerHTML='<button>Cancelar cita</button><p class="mensaje" role="status"></p>';
      li.append(cancelacion);
      atender(cancelacion,async()=>{await api.cancelar(id,cita.id); actualizar();});
    }
  }
}
