import { conectar } from './api.js';
import { cargarAmbulatorio } from './ambulatorio.js';
import { mostrarInternamiento } from './internamiento.js';
import { crearExpediente } from './expediente.js';

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
    vista.innerHTML = '<section class="portada"><div class="kicker">Red de instituciones</div><h1>¿Dónde trabajas?</h1><p>Elige tu centro para entrar al directorio de pacientes.</p></section><div class="grid"></div>';
    const grid = vista.querySelector('.grid');
    for (const [clave, [nombre, descripcion, dibujo, disponible]] of entidades) {
      grid.insertAdjacentHTML('beforeend', `<a class="card ${disponible ? 'disponible' : 'pendiente'} ${['laboratorio','odontologia'].includes(clave) ? 'azul' : ''}" href="#${clave}">
        <div class="fila"><span class="icono"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${dibujo}"/></svg></span>
        <span class="estado">${disponible ? 'Disponible' : 'Próximamente'}</span></div><h2>${nombre}</h2><p>${descripcion}</p><span class="entrada">${disponible ? 'Acceder' : 'Ver estado'} →</span></a>`);
    }
  } else {
    vista.innerHTML = enlace + '<div class="kicker">Acceso institucional</div><h1>' + entidad[0] + '</h1><div id="contenido"></div>';
    const contenido = vista.querySelector('#contenido');
    if (!entidad[3]) {
      contenido.innerHTML = '<section class="panel"><h2>Integración pendiente</h2><p>El acceso a los expedientes se habilitará cuando esta institución esté conectada.</p></section>';
    } else {
      contenido.innerHTML = `<section class="acceso"><aside><span class="kicker">Área de trabajo</span><h2>${id === 'hospital' ? 'Atención hospitalaria' : 'Estudios clínicos'}</h2><p>${id === 'hospital' ? 'Abre un expediente para revisar consultas, registrar diagnósticos y emitir recetas.' : 'Busca al paciente para revisar sus estudios o registrar nuevos resultados.'}</p></aside><div><h2>Iniciar sesión</h2>
        <form><label>Usuario<input name="usuario" autocomplete="username" required placeholder="maria.${id}"></label>
        <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
        <button>Entrar al directorio →</button>${mensaje}</form></div></section>`;
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
    const boton = form.querySelector('button:not([type="button"])');
    boton.disabled = true;
    aviso.textContent = '';
    try { await accion(Object.fromEntries(new FormData(form))); }
    catch (error) { aviso.textContent = error.message; }
    finally { boton.disabled = false; }
  });
}
function mostrarPanel(contenido, api, entidad) {
  contenido.innerHTML = `<nav class="acciones" aria-label="Área de pacientes"><button data-vista="directorio">Directorio de pacientes</button><button data-vista="registro">+ Registrar paciente</button><a href="#inicio">Cerrar sesión</a></nav>
    <section class="panel" id="directorio"><h2>Directorio de pacientes</h2>
    <form id="filtro"><label>Buscar por nombre, apellidos o ID<input name="termino" type="search" maxlength="150"></label>
    <button>Buscar</button>${mensaje}</form><div id="lista" aria-live="polite"></div></section>
    <section class="panel" id="expediente" hidden><button class="secundario" id="regresar">← Volver al directorio</button><div class="resultado" aria-live="polite"></div></section>
    <section class="panel" id="registro" hidden><h2>Registrar paciente</h2><form id="alta">
    <label>Nombres<input name="nombres" required maxlength="100"></label>
    <label>Apellidos<input name="apellidos" required maxlength="100"></label>
    <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" required></label>
    <button>Abrir expediente</button>${mensaje}</form></section>`;
  const resultado = contenido.querySelector('.resultado');
  const filtro = contenido.querySelector('#filtro');
  const lista = contenido.querySelector('#lista');
  let version = 0;
  function cambiar(nombre) {
    version++;
    for (const panel of contenido.querySelectorAll(':scope > section')) panel.hidden = panel.id !== nombre;
    for (const boton of contenido.querySelectorAll('[data-vista]')) boton.setAttribute('aria-pressed', String(boton.dataset.vista === nombre));
  }
  function directorio() {
    cambiar('directorio');
    filtro.requestSubmit();
    filtro.elements.termino.focus();
  }
  contenido.querySelector('[data-vista="directorio"]').onclick = directorio;
  contenido.querySelector('#regresar').onclick = directorio;
  contenido.querySelector('[data-vista="registro"]').onclick = () => {
    cambiar('registro');
    contenido.querySelector('#alta input').focus();
  };
  atender(filtro, async ({ termino }) => {
    const actual = ++version;
    lista.textContent = 'Buscando pacientes…';
    let pacientes;
    try { pacientes = await api.pacientes(termino.trim()); }
    catch (error) { if (actual === version) lista.replaceChildren(); throw error; }
    if (actual !== version) return;
    lista.replaceChildren();
    const total = document.createElement('p');
    total.textContent = pacientes.length ? 'Pacientes mostrados · ' + pacientes.length : 'Sin coincidencias. Prueba otro nombre o registra un paciente.';
    lista.append(total);
    for (const p of pacientes) {
      const fila = document.createElement('button');
      fila.className = 'paciente';
      fila.innerHTML = '<span class="avatar"></span><span><strong></strong><small></small></span><span class="abrir">Abrir expediente →</span>';
      fila.querySelector('.avatar').textContent = p.nombres[0] + p.apellidos[0];
      fila.querySelector('strong').textContent = p.nombres + ' ' + p.apellidos;
      fila.querySelector('small').textContent = 'ID ' + p.id;
      fila.onclick = () => abrir(p.id);
      lista.append(fila);
    }
  });
  async function abrir(id, inicial='historial') {
    cambiar('expediente');
    const actual = version;
    resultado.textContent = 'Abriendo expediente…';
    try { await dibujar(id, actual, inicial); }
    catch (error) { if (actual === version) resultado.append(document.createTextNode(' ' + error.message)); }
  }
  async function dibujar(id, actual, inicial) {
    const { paciente, consultas, examenes, citas, antecedentes } = await api.historial(id);
    if (actual !== version) return;
    const {secciones,seleccionar}=crearExpediente(resultado,paciente,entidad==='hospital',inicial);
    let destino=secciones.historial;
    const agregar = (tag, texto) => {
      const elemento = document.createElement(tag);
      elemento.textContent = texto;
      destino.append(elemento);
    };
    agregar('h3', 'Consultas (' + consultas.length + ')');
    if (!consultas.length) agregar('p', 'Sin consultas registradas.');
    for (const c of consultas) {
      destino=document.createElement('article'); destino.className='registro-clinico'; secciones.historial.append(destino);
      agregar('h4', c.motivo + ' · ' + new Date(c.fecha).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }));
      if (c.notas) agregar('p', c.notas);
      if (c.id_cita) agregar('p', 'Cita de origen · ' + c.id_cita);
      for (const [nombre, valor] of Object.entries(c.signos_vitales || {})) agregar('p', nombre + ' · ' + (typeof valor === 'object' ? JSON.stringify(valor) : valor));
      for (const d of c.diagnosticos) agregar('p', 'Diagnóstico · ' + d.descripcion);
      for (const t of c.tratamientos) agregar('p', 'Tratamiento · ' + t.nombre_procedimiento);
      for (const r of c.recetas) for (const m of r.medicamentos) agregar('p', [m.medicamento, m.dosis, m.frecuencia, m.duracion].join(' · '));
    }
    destino=secciones.historial;
    if (entidad === 'laboratorio') agregar('h3', 'Exámenes (' + examenes.length + ')');
    for (const e of examenes) {
      destino=document.createElement('article'); destino.className='registro-clinico'; secciones.historial.append(destino);
      agregar('h4', e.tipo);
      for (const [campo, valor] of Object.entries(e.resultados || {})) {
        const detalle = valor && typeof valor === 'object' ? (valor.valor !== undefined ? [valor.valor, valor.unidad].join(' ') : JSON.stringify(valor)) : valor;
        agregar('p', campo + ' · ' + detalle);
      }
    }
    secciones.atencion.insertAdjacentHTML('beforeend', `
      <form class="consulta">${entidad === 'hospital' ? '<label>Médico<select name="id_personal" required></select></label>' : ''}
      <label>Motivo<input name="motivo" required></label><label>Notas de evolución<input name="notas"></label>
      <fieldset><legend>Signos vitales opcionales</legend><label>Presión arterial (mmHg)<input name="presion" placeholder="120/80"></label>
      <label>Temperatura (°C)<input name="temperatura" type="number" step="0.1"></label><label>Frecuencia cardíaca (lpm)<input name="pulso" type="number" min="0"></label>
      <label>Frecuencia respiratoria (rpm)<input name="respiracion" type="number" min="0"></label><label>Saturación O₂ (%)<input name="saturacion" type="number" min="0" max="100"></label></fieldset>
      <fieldset class="diagnostico"><legend>Diagnóstico opcional</legend><label>Código CIE<input name="codigo_cie" maxlength="10"></label>
      <label>Descripción<input name="descripcion"></label><label>Tipo<select name="tipo"><option>presuntivo</option><option>definitivo</option></select></label></fieldset>
      <button type="button" data-agregar="diagnostico">+ Otro diagnóstico</button>
      <label class="tratamiento">Procedimiento opcional<input name="procedimiento"></label><button type="button" data-agregar="tratamiento">+ Otro procedimiento</button>
      <fieldset class="farmaco"><legend>Medicamento de la receta</legend><label>Medicamento<input name="medicamento"></label><label>Dosis<input name="dosis"></label>
      <label>Frecuencia<input name="frecuencia"></label><label>Duración<input name="duracion"></label></fieldset>
      <button type="button" data-agregar="farmaco">+ Otro medicamento</button><button>Guardar atención</button>${mensaje}</form>`);
    const formulario = resultado.querySelector('.consulta');
    const actualizar = () => { if (actual === version) abrir(paciente.id,resultado.dataset.seccion); };
    for (const boton of formulario.querySelectorAll('[data-agregar]')) {
      boton.onclick = () => {
        const copia = formulario.querySelector('.'+boton.dataset.agregar).cloneNode(true);
        for (const campo of copia.querySelectorAll('input')) campo.value='';
        boton.before(copia);
        copia.querySelector('input').focus();
      };
    }
    atender(formulario, async d => {
      const datos = { motivo: d.motivo, notas: d.notas, id_personal: formulario.elements.id_personal?.value };
      if (d.id_cita) datos.id_cita=d.id_cita;
      const signos = Object.fromEntries(['presion','temperatura','pulso','respiracion','saturacion'].filter(k=>d[k]).map(k=>[k,k==='presion'?d[k]:Number(d[k])]));
      if (Object.keys(signos).length) datos.signos_vitales=signos;
      const filas = selector => Array.from(formulario.querySelectorAll(selector), fila =>
        Object.fromEntries(Array.from(fila.querySelectorAll('input,select'), campo => [campo.name,campo.value.trim()])));
      datos.diagnosticos=filas('.diagnostico').filter(f=>f.codigo_cie || f.descripcion);
      datos.tratamientos=filas('.tratamiento').filter(f=>f.procedimiento).map(f=>({nombre_procedimiento:f.procedimiento}));
      const medicamentos=filas('.farmaco').filter(f=>Object.values(f).some(Boolean));
      if (medicamentos.length) datos.recetas=[{medicamentos}];
      await api.consulta(paciente.id, datos);
      actualizar();
    });
    if (entidad === 'hospital') {
      const medicos=await api.medicos();
      if (actual===version) cargarAmbulatorio({secciones,seleccionar,formulario,paciente,citas,antecedentes,medicos,api,atender,actualizar});
      if (actual===version) await mostrarInternamiento({secciones,paciente,api,atender,actualizar});
    } else {
      secciones.examen.insertAdjacentHTML('beforeend', `<form class="examen">
        <label>Tipo de examen<input name="tipo" required></label>
        <fieldset><legend>Resultados</legend><div class="mediciones"></div><button type="button" class="secundario">+ Otro resultado</button></fieldset>
        <button>Guardar examen</button>${mensaje}</form>`);
      const examen = resultado.querySelector('.examen');
      function agregarMedicion() {
        examen.querySelector('.mediciones').insertAdjacentHTML('beforeend', '<div class="medicion"><label>Parámetro<input required placeholder="Ej. Hemoglobina"></label><label>Resultado<input required placeholder="Ej. 13.2"></label><label>Unidad opcional<input placeholder="g/dL"></label><button type="button" class="secundario quitar">Quitar</button></div>');
      }
      agregarMedicion();
      examen.querySelector('fieldset > button').onclick = agregarMedicion;
      examen.querySelector('.mediciones').onclick = e => {
        if (e.target.matches('.quitar') && examen.querySelectorAll('.medicion').length > 1) e.target.closest('.medicion').remove();
      };
      atender(examen, async d => {
        const resultados = Object.create(null);
        for (const fila of examen.querySelectorAll('.medicion')) {
          const [campo, valor, unidad] = Array.from(fila.querySelectorAll('input'), input => input.value.trim());
          if (!campo || !valor || campo in resultados) throw Error('Cada resultado necesita un parámetro distinto y un valor.');
          const dato = /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : valor;
          resultados[campo] = unidad ? { valor: dato, unidad } : dato;
        }
        await api.examen(paciente.id, { tipo: d.tipo, resultados });
        actualizar();
      });
    }
  }
  const alta = contenido.querySelector('#alta');
  atender(alta, async datos => {
    const { id } = await api.registrar(datos);
    alta.reset();
    alta.querySelector('.mensaje').textContent = 'Expediente creado. Identificador: ' + id;
    await abrir(id);
  });
  directorio();
}
window.addEventListener('hashchange', navegar);
navegar();
