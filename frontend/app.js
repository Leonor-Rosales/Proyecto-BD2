import { conectar } from './api.js';

const entidades = new Map([
  ['hospital', ['Hospital General', 'Consultas, diagnósticos y tratamientos.', 'M3 21V7h6V3h6v4h6v14H3Zm7 0v-5h4v5M10 9h4m-2-2v4', true]],
  ['laboratorio', ['Laboratorio Clínico', 'Exámenes de laboratorio y resultados por paciente.', 'M9 3h6m-5 0v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3M7 16h10', true]],
  ['pediatria', ['Centro Médico Pediátrico', 'Crecimiento, vacunación y controles pediátricos.', 'M4 20h16M6 17l4-5 3 2 6-9m-5 0h5v5', false]],
  ['odontologia', ['Clínica Odontológica', 'Atención dental y seguimiento de procedimientos.', 'M12 5C6 1 2 5 5 12c2 4 1 9 4 9 2 0 1-7 3-7s1 7 3 7c3 0 2-5 4-9 3-7-1-11-7-7Z', false]]
]);
const vista = document.querySelector('#vista');
const enlace = '<a class="volver" href="#inicio">← Cambiar de institución</a>';
const mensaje = '<p class="mensaje" role="status"></p>';
function navegar() {
  const id = location.hash.slice(1);
  const entidad = entidades.get(id);
  document.title = (entidad?.[0] || 'Acceso institucional') + ' · Red Clínica';
  if (!entidad) {
    vista.innerHTML = '<div class="kicker">Acceso institucional</div><h1>Elige tu institución</h1><p>Selecciona el centro al que perteneces para acceder a los expedientes de tus pacientes.</p><div class="grid"></div>';
    const grid = vista.querySelector('.grid');
    for (const [clave, [nombre, descripcion, dibujo, disponible]] of entidades) {
      grid.insertAdjacentHTML('beforeend', `<a class="card ${['laboratorio','odontologia'].includes(clave) ? 'azul' : ''}" href="#${clave}">
        <div class="fila"><span class="icono"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${dibujo}"/></svg></span>
        <span class="estado">${disponible ? 'Disponible' : 'Próximamente'}</span></div><h2>${nombre}</h2><p>${descripcion}</p><span class="entrada">${disponible ? 'Acceder' : 'Ver estado'} →</span></a>`);
    }
  } else {
    vista.innerHTML = enlace + '<div class="kicker">Acceso institucional</div><h1>' + entidad[0] + '</h1><div id="contenido"></div>';
    const contenido = vista.querySelector('#contenido');
    if (!entidad[3]) {
      contenido.innerHTML = '<section class="panel"><h2>Integración pendiente</h2><p>El acceso a los expedientes se habilitará cuando esta institución esté conectada.</p></section>';
    } else {
      contenido.innerHTML = `<section class="panel"><h2>Iniciar sesión</h2><p>Ingresa con tu cuenta de esta institución.</p>
        <form><label>Usuario<input name="usuario" autocomplete="username" required placeholder="maria.${id}"></label>
        <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
        <button>Ingresar</button>${mensaje}</form></section>`;
      atender(contenido.querySelector('form'), async datos => {
        const api = conectar(datos.usuario.trim(), datos.clave);
        const sesion = await api.sesion();
        if (sesion.entidad !== id) throw Error('La cuenta pertenece a otra institución.');
        if (contenido.isConnected) mostrarPanel(contenido, api, sesion.entidad);
      });
    }
  }
  vista.focus();
}
function atender(form, accion) {
  form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const aviso = form.querySelector('.mensaje');
    const boton = form.querySelector('button');
    boton.disabled = true;
    aviso.textContent = '';
    try { await accion(Object.fromEntries(new FormData(form))); }
    catch (error) { aviso.textContent = error.message; }
    finally { boton.disabled = false; }
  });
}
function mostrarPanel(contenido, api, entidad) {
  contenido.innerHTML = `<section class="panel"><h2>Consultar expediente</h2>
    <form id="buscar"><label>Identificador del paciente<input name="id" required></label>
    <button>Ver historial</button>${mensaje}</form><div class="resultado" aria-live="polite"></div></section>
    <section class="panel"><h2>Registrar paciente</h2><form id="alta">
    <label>Nombres<input name="nombres" required maxlength="100"></label>
    <label>Apellidos<input name="apellidos" required maxlength="100"></label>
    <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" required></label>
    <button>Abrir expediente</button>${mensaje}</form></section>`;
  const resultado = contenido.querySelector('.resultado');
  const buscar = contenido.querySelector('#buscar');
  atender(buscar, async ({ id }) => {
    resultado.replaceChildren();
    const { paciente, consultas, examenes } = await api.historial(id.trim());
    const agregar = (tag, texto) => {
      const elemento = document.createElement(tag);
      elemento.textContent = texto;
      resultado.append(elemento);
    };
    agregar('h3', paciente.nombres + ' ' + paciente.apellidos);
    agregar('p', 'Expediente del paciente ' + paciente.id);
    if (!consultas.length && !examenes.length) agregar('p', 'Este expediente aún no tiene atenciones registradas.');
    for (const c of consultas) {
      agregar('h4', c.motivo + ' · ' + new Date(c.fecha).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }));
      if (c.notas) agregar('p', c.notas);
      for (const d of c.diagnosticos) agregar('p', 'Diagnóstico · ' + d.descripcion);
      for (const t of c.tratamientos) agregar('p', 'Tratamiento · ' + t.nombre_procedimiento);
      for (const r of c.recetas) for (const m of r.medicamentos) agregar('p', [m.medicamento, m.dosis, m.frecuencia, m.duracion].join(' · '));
    }
    for (const e of examenes) {
      agregar('h4', e.tipo);
      for (const [campo, valor] of Object.entries(e.resultados || {})) {
        const detalle = valor && typeof valor === 'object' ? (valor.valor !== undefined ? [valor.valor, valor.unidad].join(' ') : JSON.stringify(valor)) : valor;
        agregar('p', campo + ' · ' + detalle);
      }
    }
    resultado.insertAdjacentHTML('beforeend', `<details class="panel"><summary>Registrar atención</summary>
      <form class="consulta">${entidad === 'hospital' ? '<label>Médico<select name="id_personal" required></select></label>' : ''}
      <label>Motivo<input name="motivo" required></label><label>Notas de evolución<input name="notas"></label>
      <fieldset><legend>Diagnóstico opcional</legend><label>Código CIE<input name="codigo_cie" maxlength="10"></label>
      <label>Descripción<input name="descripcion"></label><label>Tipo<select name="tipo"><option>presuntivo</option><option>definitivo</option></select></label></fieldset>
      <label>Procedimiento opcional<input name="procedimiento"></label>
      <fieldset><legend>Receta opcional</legend><label>Medicamento<input name="medicamento"></label><label>Dosis<input name="dosis"></label>
      <label>Frecuencia<input name="frecuencia"></label><label>Duración<input name="duracion"></label></fieldset>
      <button>Guardar atención</button>${mensaje}</form></details>`);
    const formulario = resultado.querySelector('.consulta');
    const actualizar = () => {
      if (formulario.isConnected) { buscar.elements.id.value = paciente.id; buscar.requestSubmit(); }
    };
    atender(formulario, async d => {
      const datos = { motivo: d.motivo, notas: d.notas, id_personal: d.id_personal };
      if (d.codigo_cie || d.descripcion) datos.diagnosticos = [{ codigo_cie: d.codigo_cie, descripcion: d.descripcion, tipo: d.tipo }];
      if (d.procedimiento) datos.tratamientos = [{ nombre_procedimiento: d.procedimiento }];
      if (d.medicamento || d.dosis || d.frecuencia || d.duracion) datos.recetas = [{ medicamentos: [{
        medicamento: d.medicamento, dosis: d.dosis, frecuencia: d.frecuencia, duracion: d.duracion
      }] }];
      await api.consulta(paciente.id, datos);
      actualizar();
    });
    if (entidad === 'hospital') {
      for (const medico of await api.medicos()) formulario.elements.id_personal.add(new Option(medico.nombres + ' ' + medico.apellidos, medico.id));
    } else {
      resultado.insertAdjacentHTML('beforeend', `<details class="panel"><summary>Registrar examen</summary><form class="examen">
        <label>Tipo de examen<input name="tipo" required></label>
        <label>Resultados en JSON<textarea name="resultados" required placeholder='{"color":"amarillo","ph":6}'></textarea></label>
        <button>Guardar examen</button>${mensaje}</form></details>`);
      atender(resultado.querySelector('.examen'), async d => {
        let resultados;
        try { resultados = JSON.parse(d.resultados); } catch { throw Error('Escribe un objeto JSON válido para los resultados.'); }
        await api.examen(paciente.id, { tipo: d.tipo, resultados });
        actualizar();
      });
    }
  });
  const alta = contenido.querySelector('#alta');
  atender(alta, async datos => {
    const { id } = await api.registrar(datos);
    alta.reset();
    alta.querySelector('.mensaje').textContent = 'Expediente creado. Identificador: ' + id;
    buscar.elements.id.value = id;
    buscar.requestSubmit();
  });
  buscar.elements.id.focus();
}
window.addEventListener('hashchange', navegar);
navegar();
