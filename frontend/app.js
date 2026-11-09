import { conectar } from './api.js';
import { cargarAmbulatorio } from './ambulatorio.js';
import { mostrarInternamiento } from './internamiento.js';
import { crearExpediente } from './expediente.js';
import { mostrarCatalogos } from './catalogos.js';
import { camposPaciente,mostrarDatos,mostrarSecretaria } from './datos-paciente.js';

const entidades = new Map([
  ['hospital', ['Hospital General', 'Consultas, diagnósticos y tratamientos.', 'M3 21V7h6V3h6v4h6v14H3Zm7 0v-5h4v5M10 9h4m-2-2v4', true]],
  ['laboratorio', ['Laboratorio Clínico', 'Exámenes de laboratorio y resultados por paciente.', 'M9 3h6m-5 0v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3M7 16h10', true]],
  ['pediatria', ['Centro Médico Pediátrico', 'Crecimiento, vacunación y controles pediátricos.', 'M4 20h16M6 17l4-5 3 2 6-9m-5 0h5v5', true]],
  ['odontologia', ['Clínica Odontológica', 'Atención dental y seguimiento de procedimientos.', 'M12 5C6 1 2 5 5 12c2 4 1 9 4 9 2 0 1-7 3-7s1 7 3 7c3 0 2-5 4-9 3-7-1-11-7-7Z', true]]
]);
const getVista = () => document.querySelector('#vista') || document.body;
const enlace = '<a class="volver" href="#inicio">← Cambiar de institución</a>';
const mensaje = '<p class="mensaje" role="status"></p>';
function navegar() {
  const vista = getVista();
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
      const subArea = id === 'hospital' ? 'Atención hospitalaria' : (id === 'pediatria' ? 'Atención pediátrica' : (id === 'odontologia' ? 'Atención odontológica' : 'Estudios clínicos'));
      const descArea = id === 'hospital' ? 'Abre un expediente para revisar consultas, registrar diagnósticos y emitir recetas.' : (id === 'pediatria' ? 'Abre un expediente infantil para revisar controles de crecimiento, vacunas y consultas.' : (id === 'odontologia' ? 'Revisa odontogramas, consultas dentales y procedimientos por pieza.' : 'Busca al paciente para revisar sus estudios o registrar nuevos resultados.'));
      const demoUser = id === 'pediatria' ? 'josue.pediatria' : (id === 'odontologia' ? 'josue.odontologia' : 'maria.' + id);
      contenido.innerHTML = `<section class="acceso"><aside><span class="kicker">Área de trabajo</span><h2>${subArea}</h2><p>${descArea}</p></aside><div><h2>Iniciar sesión</h2>
        <form><label>Usuario<input name="usuario" autocomplete="username" required placeholder="${demoUser}"></label>
        <label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>
        <button>Entrar al directorio →</button>${mensaje}</form></div></section>`;
      atender(contenido.querySelector('form'), async datos => {
        const api = conectar(datos.usuario.trim(), datos.clave);
        const sesion = await api.sesion();
        if (sesion.entidad !== id) throw Error('La cuenta pertenece a otra institución.');
        if (contenido.isConnected) mostrarPanel(contenido, api, sesion.entidad,sesion.rol);
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
function mostrarPanel(contenido, api, entidad,rol) {
  contenido.innerHTML = `<nav class="acciones" aria-label="Área de pacientes"><button data-vista="directorio">Directorio de pacientes</button><button data-vista="registro">+ Registrar paciente</button>${entidad==='hospital'&&rol==='administrador'?'<button data-vista="catalogos">Catálogos del Hospital</button>':''}<a href="#inicio">Cerrar sesión</a></nav>
    <section class="panel" id="catalogos" hidden></section>
    <section class="panel" id="directorio"><h2>Directorio de pacientes</h2>
    <form id="filtro"><label>Buscar por nombre, apellidos o ID<input name="termino" type="search" maxlength="150"></label>
    <button>Buscar</button>${mensaje}</form><div id="lista" aria-live="polite"></div></section>
    <section class="panel" id="expediente" hidden><button class="secundario" id="regresar">← Volver al directorio</button><div class="resultado" aria-live="polite"></div></section>
    <section class="panel" id="registro" hidden><h2>Registrar paciente</h2><form id="alta">
    <label>Nombres<input name="nombres" required maxlength="100"></label>
    <label>Apellidos<input name="apellidos" required maxlength="100"></label>
    <label>Fecha de nacimiento<input name="fecha_nacimiento" type="date" required></label>
    ${camposPaciente}
    <button>Abrir expediente</button>${mensaje}</form></section>`;
  const resultado = contenido.querySelector('.resultado');
  const acceso=document.createElement('p');
  acceso.textContent=rol==='secretaria'?'Acceso de secretaría · Gestión de pacientes':rol==='laboratorista'?'Acceso de laboratorista · Pacientes y resultados clínicos':'Acceso · '+rol;
  contenido.prepend(acceso);
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
  if (entidad==='hospital'&&rol==='administrador') contenido.querySelector('[data-vista="catalogos"]').onclick=()=>{
    cambiar('catalogos'); mostrarCatalogos(contenido.querySelector('#catalogos'),api,atender);
  };
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
    if (rol==='secretaria') {
      await mostrarSecretaria(resultado,id,api,atender,()=>abrir(id),entidad);
      return;
    }
    const { paciente, consultas, examenes, citas, antecedentes, controles_crecimiento, vacunas, odontograma, cobros } = await api.historial(id);
    if (actual !== version) return;
    const {secciones,seleccionar}=crearExpediente(resultado,paciente,entidad,inicial);
    const historialAtenciones=secciones.consultas||secciones.historial;
    let destino=historialAtenciones;
    const agregar = (tag, texto) => {
      const elemento = document.createElement(tag);
      elemento.textContent = texto;
      destino.append(elemento);
    };
    if (paciente.estado === 'baja') {
      const avisoBaja = document.createElement('div');
      avisoBaja.style.cssText = 'background:#fee2e2; border:1px solid #ef4444; color:#991b1b; padding:10px 14px; border-radius:6px; margin-bottom:14px; font-weight:500;';
      avisoBaja.textContent = 'Expediente archivado (Baja): ' + (paciente.motivo_baja || 'Baja administrativa');
      secciones.historial.append(avisoBaja);
    }
    agregar('h3', 'Consultas (' + consultas.length + ')');
    if (!consultas.length) agregar('p', 'Sin consultas registradas.');
    for (const c of consultas) {
      destino=document.createElement('article'); destino.className='registro-clinico'; historialAtenciones.append(destino);
      agregar('h4', c.motivo + ' · ' + new Date(c.fecha).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }));
      if (c.notas) agregar('p', c.notas);
      if (c.id_cita) agregar('p', 'Cita de origen · ' + c.id_cita);
      for (const [nombre, valor] of Object.entries(c.signos_vitales || {})) agregar('p', nombre + ' · ' + (typeof valor === 'object' ? JSON.stringify(valor) : valor));
      for (const d of c.diagnosticos || []) agregar('p', 'Diagnóstico · ' + d.descripcion);
      for (const t of c.tratamientos || []) agregar('p', 'Tratamiento · ' + t.nombre_procedimiento + (t.pieza ? ' (Pieza ' + t.pieza + ')' : ''));
      for (const r of c.recetas || []) for (const m of r.medicamentos || []) agregar('p', [m.medicamento, m.dosis, m.frecuencia, m.duracion].join(' · '));
    }
    destino=secciones.historial;
    if (entidad === 'odontologia' && odontograma?.length) {
      agregar('h3', 'Odontograma Clínico (32 piezas dentales fijas)');
      destino = document.createElement('article'); destino.className = 'registro-clinico'; secciones.historial.append(destino);
      const colores = { sano: '#10b981', caries: '#ef4444', obturado: '#3b82f6', ausente: '#6b7280', corona: '#f59e0b', endodoncia: '#8b5cf6' };
      const rejilla=document.createElement('div');
      rejilla.style.cssText='display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:10px 0;font-size:12px;text-align:center';
      destino.append(rejilla);
      for (const pieza of odontograma) {
        const celda=document.createElement('div');
        const color=Object.hasOwn(colores,pieza.estado)?colores[pieza.estado]:'#64748b';
        celda.style.cssText='border:1px solid '+color+';padding:4px;border-radius:4px;background:'+color+'18';
        const numero=document.createElement('strong');
        numero.textContent=pieza.numero;
        const estado=document.createElement('span');
        estado.textContent=pieza.estado;
        estado.style.color=color;
        celda.append(numero,document.createElement('br'),estado);
        if (pieza.observaciones) {
          const nota=document.createElement('small');
          nota.textContent=pieza.observaciones;
          celda.append(document.createElement('br'),nota);
        }
        rejilla.append(celda);
      }
      if (cobros?.length) {
        destino = secciones.historial;
        agregar('h3', 'Historial de Cobros (' + cobros.length + ')');
        for (const cob of cobros) {
          destino = document.createElement('article'); destino.className = 'registro-clinico'; secciones.historial.append(destino);
          agregar('h4', 'Cobro · Q ' + Number(cob.monto).toFixed(2) + ' · ' + (cob.metodo_pago || 'efectivo') + ' · ' + (cob.estado_pago || 'pagado'));
          if (cob.fecha) agregar('p', 'Fecha: ' + new Date(cob.fecha).toLocaleDateString('es-GT', { timeZone: 'America/Guatemala' }));
        }
      }
    }
    if (entidad === 'pediatria') {
      if (controles_crecimiento?.length) {
        agregar('h3', 'Controles de crecimiento (' + controles_crecimiento.length + ')');
        for (const c of controles_crecimiento) {
          destino = document.createElement('article'); destino.className = 'registro-clinico'; secciones.historial.append(destino);
          agregar('h4', 'Control · ' + c.fecha);
          agregar('p', `Peso: ${c.peso_kg} kg · Talla: ${c.talla_cm} cm` + (c.perimetro_cefalico_cm ? ` · P. Cefálico: ${c.perimetro_cefalico_cm} cm` : '') + (c.percentil_observado ? ` · Percentil: ${c.percentil_observado}` : ''));
        }
      }
      if (vacunas?.length) {
        agregar('h3', 'Esquema de vacunación (' + vacunas.length + ')');
        for (const v of vacunas) {
          destino = document.createElement('article'); destino.className = 'registro-clinico'; secciones.historial.append(destino);
          agregar('h4', `${v.nombre_vacuna} (${v.numero_dosis}) · Estado: ${v.estado}`);
          agregar('p', `Programada: ${v.fecha_programada}` + (v.fecha_aplicacion ? ` · Aplicada: ${v.fecha_aplicacion}` : '') + (v.lote ? ` · Lote: ${v.lote}` : ''));
        }
      }
    }
    if (entidad === 'laboratorio') agregar('h3', 'Exámenes (' + examenes.length + ')');
    if (entidad === 'laboratorio' && !examenes.length) agregar('p','Este paciente todavía no tiene resultados. Usa Registrar examen para añadir su primer estudio.');
    for (const e of examenes) {
      destino=document.createElement('article'); destino.className='registro-clinico'; secciones.historial.append(destino);
      agregar('h4', e.tipo);
      if (e.fecha) agregar('p',new Date(e.fecha).toLocaleString('es-GT',{timeZone:'America/Guatemala'}));
      for (const [campo, valor] of Object.entries(e.resultados || {})) {
        const detalle = valor && typeof valor === 'object' ? (valor.valor !== undefined ? [valor.valor, valor.unidad].join(' ') : JSON.stringify(valor)) : valor;
        agregar('p', campo + ' · ' + detalle);
      }
    }
    if (paciente.estado !== 'baja') {
      const detalleArchivo = document.createElement('details');
      detalleArchivo.style.marginTop = '24px';
      detalleArchivo.style.borderTop = '1px solid #e5e7eb';
      detalleArchivo.style.paddingTop = '12px';
      detalleArchivo.innerHTML = `<summary style="cursor:pointer; color:#6b7280; font-size:13px; user-select:none;">Archivar o dar de baja este expediente clínico</summary>
        <form class="archivo-expediente" style="margin-top:10px;">
          <label>Causa o motivo de baja (traslado, fallecimiento, administrativo...)<textarea name="motivo" maxlength="2000" required placeholder="Escribe el motivo del archivo..."></textarea></label>
          <button style="background:#dc2626; color:white; border:none; padding:8px 14px; border-radius:4px; margin-top:6px; cursor:pointer;">Confirmar baja de expediente</button>
          <p class="mensaje" role="status"></p>
        </form>`;
      secciones.historial.append(detalleArchivo);
      atender(detalleArchivo.querySelector('form'), async d => {
        if (!confirm('¿Confirmas que deseas dar de baja y archivar este expediente clínico?')) return;
        await api.archivarPaciente(paciente.id, d);
        actualizar();
      });
    }
    secciones.atencion.insertAdjacentHTML('beforeend', `
      <form class="consulta">${['hospital', 'pediatria', 'odontologia'].includes(entidad) ? `<label>${entidad === 'pediatria' ? 'Pediatra' : (entidad === 'odontologia' ? 'Odontólogo' : 'Médico')}<select name="id_personal" required></select></label>` : ''}
      ${entidad === 'pediatria' ? '<label>Tipo de consulta<select name="tipo_consulta"><option value="control_nino_sano">Control de niño sano</option><option value="enfermedad">Enfermedad</option><option value="urgencia">Urgencia</option></select></label>' : ''}
      <label>Motivo<input name="motivo" required></label><label>Notas de evolución<input name="notas"></label>
      ${entidad === 'odontologia' ? `<fieldset><legend>Procedimiento y odontograma</legend>
        <label>Pieza dental (FDI: 11 a 48)<input name="pieza" type="number" min="11" max="48" placeholder="Ej. 18, 25, 46"></label>
        <label>Nuevo estado dental<select name="nuevo_estado"><option value="obturado">Obturado (Resina/Amalgama)</option><option value="caries">Caries activa</option><option value="endodoncia">Tratamiento de canales</option><option value="corona">Corona protésica</option><option value="ausente">Pieza extraída</option><option value="sano">Sano</option></select></label>
      </fieldset>` : ''}
      ${entidad === 'pediatria' ? `<fieldset><legend>Control de crecimiento (opcional)</legend>
        <label>Peso (kg)<input name="peso_kg" type="number" step="0.01"></label>
        <label>Talla (cm)<input name="talla_cm" type="number" step="0.1"></label>
        <label>Perímetro cefálico (cm)<input name="perimetro_cefalico_cm" type="number" step="0.1"></label>
        <label>Percentil observado<input name="percentil_observado" placeholder="Ej. P50 (OMS)"></label></fieldset>` : ''}
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
    await mostrarDatos(secciones.datos,paciente.id,api,atender,actualizar,entidad);
    if (paciente.estado === 'baja') {
      if (entidad === 'laboratorio') {
        secciones.atencion.innerHTML = '<h2>Expediente archivado</h2><p>Consulta los registros en Atenciones anteriores.</p>';
        secciones.examen.innerHTML = '<h2>Expediente archivado</h2><p>Los estudios anteriores permanecen disponibles en Resultados de exámenes.</p>';
        return;
      }
      if (['pediatria', 'odontologia'].includes(entidad)) {
        secciones.atencion.innerHTML = '<h2>Expediente archivado</h2><p>Este paciente se encuentra de baja administrativa. Consulta los registros en el historial clínico.</p>';
        return;
      }
    }
    if (entidad==='hospital') {
      const catalogo=await api.catalogos('procedimientos');
      formulario.insertAdjacentHTML('beforeend','<datalist id="procedimientos-hospital"></datalist>');
      const lista=formulario.querySelector('datalist');
      for (const p of catalogo) lista.append(new Option(p.nombre+' · Q'+p.precio,p.nombre));
      formulario.elements.procedimiento.setAttribute('list',lista.id);
      formulario.elements.procedimiento.placeholder='Elige del catálogo o escribe uno sin cargo';
    }
    for (const boton of formulario.querySelectorAll('[data-agregar]')) {
      boton.onclick = () => {
        const copia = formulario.querySelector('.'+boton.dataset.agregar).cloneNode(true);
        for (const campo of copia.querySelectorAll('input')) campo.value='';
        boton.before(copia);
        copia.querySelector('input').focus();
      };
    }
    const claveConsulta=entidad==='hospital'?crypto.randomUUID():undefined;
    atender(formulario, async d => {
      const datos = { motivo: d.motivo, notas: d.notas, id_personal: formulario.elements.id_personal?.value };
      if (d.id_cita) datos.id_cita=d.id_cita;
      if (entidad === 'pediatria') {
        if (d.tipo_consulta) datos.tipo_consulta = d.tipo_consulta;
        if (d.peso_kg && d.talla_cm) {
          datos.control_crecimiento = {
            peso_kg: Number(d.peso_kg),
            talla_cm: Number(d.talla_cm),
            perimetro_cefalico_cm: d.perimetro_cefalico_cm ? Number(d.perimetro_cefalico_cm) : null,
            percentil_observado: d.percentil_observado || null
          };
        }
      }
      const signos = Object.fromEntries(['presion','temperatura','pulso','respiracion','saturacion'].filter(k=>d[k]).map(k=>[k,k==='presion'?d[k]:Number(d[k])]));
      if (Object.keys(signos).length) datos.signos_vitales=signos;
      const filas = selector => Array.from(formulario.querySelectorAll(selector), fila =>
        Object.fromEntries(Array.from(fila.querySelectorAll('input,select'), campo => [campo.name,campo.value.trim()])));
      datos.diagnosticos=filas('.diagnostico').filter(f=>f.codigo_cie || f.descripcion);
      datos.tratamientos=filas('.tratamiento').filter(f=>f.procedimiento).map(f=>({nombre_procedimiento:f.procedimiento}));
      if (entidad === 'odontologia' && d.pieza) {
        datos.tratamientos.push({
          nombre_procedimiento: d.procedimiento || ('Procedimiento dental en pieza ' + d.pieza),
          pieza: Number(d.pieza),
          nuevo_estado: d.nuevo_estado || 'obturado'
        });
      }
      const medicamentos=filas('.farmaco').filter(f=>Object.values(f).some(Boolean));
      if (medicamentos.length) datos.recetas=[{medicamentos}];
      await api.consulta(paciente.id, datos, claveConsulta);
      actualizar();
    });
    if (['hospital', 'pediatria', 'odontologia'].includes(entidad)) {
      const medicos = await api.medicos();
      const select = formulario.querySelector('select[name="id_personal"]');
      if (select) {
        select.innerHTML = medicos.map(m => `<option value="${m.id}">${m.nombres} ${m.apellidos} (${m.especialidad || 'General'})</option>`).join('');
      }
      if (entidad === 'hospital') {
        if (actual===version) cargarAmbulatorio({secciones,seleccionar,formulario,paciente,citas,antecedentes,medicos,api,atender,actualizar});
        if (actual===version) await mostrarInternamiento({secciones,paciente,api,atender,actualizar,rol});
      }
    } else if (entidad === 'laboratorio') {
      secciones.examen.insertAdjacentHTML('beforeend', `<form class="examen">
        <label>Estudio<select name="tipo_id"></select></label>
        <label>Nombre del estudio personalizado<input name="tipo" required maxlength="150"></label>
        <fieldset><legend>Resultados</legend><div class="mediciones"></div><button type="button" class="secundario">+ Otro resultado</button></fieldset>
        <button>Guardar examen</button>${mensaje}</form>`);
      const examen = resultado.querySelector('.examen');
      const tipos=await api.tiposExamen();
      for (const tipo of tipos) examen.elements.tipo_id.add(new Option(tipo.nombre,tipo.id));
      examen.elements.tipo_id.add(new Option('Estudio personalizado',''));
      function agregarMedicion() {
        examen.querySelector('.mediciones').insertAdjacentHTML('beforeend', '<div class="medicion"><label>Parámetro<input required placeholder="Ej. Hemoglobina"></label><label>Resultado<input required placeholder="Ej. 13.2"></label><label>Unidad opcional<input placeholder="g/dL"></label><button type="button" class="secundario quitar">Quitar</button></div>');
      }
      function mostrarCampos() {
        const tipo=tipos.find(t=>t.id===examen.elements.tipo_id.value);
        examen.querySelector('.mediciones').replaceChildren();
        examen.elements.tipo.disabled=Boolean(tipo);
        examen.elements.tipo.parentElement.hidden=Boolean(tipo);
        examen.querySelector('fieldset > button').hidden=Boolean(tipo);
        if (!tipo) {agregarMedicion();return;}
        for (const campo of tipo.campos) {
          const fila=document.createElement('label');
          fila.className='parametro';
          fila.textContent=campo.etiqueta+(campo.unidad?' ('+campo.unidad+')':'');
          const input=document.createElement('input');
          input.dataset.campo=campo.nombre;
          input.type=campo.tipo==='numero'?'number':'text';
          if (campo.tipo==='numero') {input.min='0';input.step='any';}
          else input.maxLength=2000;
          input.required=true;
          fila.append(input); examen.querySelector('.mediciones').append(fila);
        }
      }
      mostrarCampos();
      examen.elements.tipo_id.onchange=mostrarCampos;
      examen.querySelector('fieldset > button').onclick = agregarMedicion;
      examen.querySelector('.mediciones').onclick = e => {
        if (e.target.matches('.quitar') && examen.querySelectorAll('.medicion').length > 1) e.target.closest('.medicion').remove();
      };
      atender(examen, async d => {
        const resultados = Object.create(null);
        for (const input of examen.querySelectorAll('[data-campo]')) resultados[input.dataset.campo]=input.type==='number'?Number(input.value):input.value.trim();
        for (const fila of examen.querySelectorAll('.medicion')) {
          const [campo, valor, unidad] = Array.from(fila.querySelectorAll('input'), input => input.value.trim());
          if (!campo || !valor || campo in resultados) throw Error('Cada resultado necesita un parámetro distinto y un valor.');
          const dato = /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : valor;
          resultados[campo] = unidad ? { valor: dato, unidad } : dato;
        }
        await api.examen(paciente.id, { tipo: d.tipo, tipo_id:d.tipo_id||undefined, resultados });
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
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', navegar);
} else {
  navegar();
}
