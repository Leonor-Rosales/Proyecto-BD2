export function conectar(usuario, clave) {
  const bytes = new TextEncoder().encode(usuario + ':' + clave);
  const authorization = 'Basic ' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  async function solicitar(ruta, opciones = {}) {
    const respuesta = await fetch('/api/' + ruta, {
      ...opciones, headers: { Authorization: authorization, 'Content-Type': 'application/json' }
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) throw Error(datos.error || 'No se pudo completar la solicitud.');
    return datos;
  }
  return {
    sesion: () => solicitar('sesion'),
    historial: id => solicitar('pacientes/' + encodeURIComponent(id) + '/historial'),
    registrar: datos => solicitar('pacientes', { method: 'POST', body: JSON.stringify(datos) })
  };
}
