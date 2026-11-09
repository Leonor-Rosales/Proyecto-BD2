export function crearExpediente(raiz, paciente, entidad, inicial) {
  raiz.innerHTML = `<div class="ficha"><span class="avatar"></span><div><small>Expediente clínico</small><h2></h2><span class="identificador"></span></div></div>
    <div class="mesa"><nav aria-label="Secciones del expediente" class="menu-ficha"></nav><div class="hojas"></div></div>`;
  raiz.querySelector('.avatar').textContent = paciente.nombres[0] + paciente.apellidos[0];
  raiz.querySelector('.ficha h2').textContent = paciente.nombres + ' ' + paciente.apellidos;
  raiz.querySelector('.identificador').textContent = 'ID ' + paciente.id;
  let opciones;
  if (entidad === 'hospital' || entidad === true) {
    opciones = [['historial', 'Historial clínico'], ['atencion', 'Registrar atención'], ['datos', 'Datos del paciente'], ['citas', 'Citas y agenda'], ['internamiento', 'Hospitalización'], ['cuenta', 'Facturación y pagos']];
  } else if (entidad === 'laboratorio') {
    opciones = [['historial', 'Resultados de exámenes'], ['examen', 'Registrar examen'], ['datos', 'Datos del paciente'], ['consultas', 'Atenciones anteriores'], ['atencion', 'Registrar atención']];
  } else {
    opciones = [['historial', 'Historial clínico'], ['atencion', 'Registrar atención'], ['datos', 'Datos del paciente']];
  }
  const secciones = {};
  const botones = {};
  function seleccionar(clave) {
    for (const [nombre, panel] of Object.entries(secciones)) {
      panel.hidden = nombre !== clave;
      botones[nombre].setAttribute('aria-pressed', String(nombre === clave));
    }
    raiz.dataset.seccion = clave;
  }
  for (const [clave, titulo] of opciones) {
    const boton = document.createElement('button');
    boton.textContent = titulo;
    boton.onclick = () => seleccionar(clave);
    const panel = document.createElement('section');
    panel.className = 'hoja';
    panel.setAttribute('aria-label', titulo);
    const h = document.createElement('h2'); h.textContent = titulo; panel.append(h);
    botones[clave] = boton; secciones[clave] = panel;
    raiz.querySelector('.menu-ficha').append(boton);
    raiz.querySelector('.hojas').append(panel);
  }
  seleccionar(secciones[inicial] ? inicial : 'historial');
  return { secciones, seleccionar };
}
