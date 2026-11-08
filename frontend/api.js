export function conectar(usuario, clave) {
  const bytes = new TextEncoder().encode(usuario + ':' + clave);
  const authorization = 'Basic ' + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  async function solicitar(ruta, opciones = {}) {
    const respuesta = await fetch('/api/' + ruta, {
      ...opciones, credentials: 'omit',
      headers: { Authorization: authorization, 'Content-Type': 'application/json', ...opciones.headers }
    });
    const datos = await respuesta.json();
    if (respuesta.status === 401) throw Error('Revisa el usuario y la contraseña de la institución.');
    if (!respuesta.ok) throw Error(datos.error || 'No se pudo completar la solicitud.');
    return datos;
  }
  return {
    tiposExamen: ()=>solicitar('tipos-examen'),
    datosPaciente: id=>solicitar('pacientes/'+encodeURIComponent(id)+'/datos'),
    citasPaciente: id=>solicitar('pacientes/'+encodeURIComponent(id)+'/citas'),
    editarPaciente: (id,datos)=>solicitar('pacientes/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(datos)}),
    archivarPaciente: (id,datos)=>solicitar('pacientes/'+encodeURIComponent(id)+'/archivo',{method:'POST',body:JSON.stringify(datos)}),
    catalogos: (ruta,metodo='GET',datos) => solicitar('catalogos/'+ruta,{method:metodo,body:datos&&JSON.stringify(datos)}),
    cuenta: (id,ingreso) => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones/'+encodeURIComponent(ingreso)+'/cuenta'),
    catalogoHospital: id => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones/catalogo'),
    registrarImporte: (id,ingreso,accion,datos,clave) => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones/'+encodeURIComponent(ingreso)+'/'+accion,
      {method:'POST',body:JSON.stringify(datos),headers:{'Idempotency-Key':clave}}),
    internamientos: id => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones'),
    habitaciones: id => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones/habitaciones'),
    movimiento: (id,ruta,datos) => solicitar('pacientes/'+encodeURIComponent(id)+'/hospitalizaciones'+ruta,{method:'POST',body:JSON.stringify(datos)}),
    agenda: filtros => solicitar('agenda?' + new URLSearchParams(filtros)),
    guardarCita: (id, cita, datos) => solicitar('pacientes/' + encodeURIComponent(id) + '/citas' + (cita ? '/' + encodeURIComponent(cita) : ''), {method:cita ? 'PATCH' : 'POST',body:JSON.stringify(datos)}),
    cancelar: (id,cita) => solicitar('pacientes/' + encodeURIComponent(id) + '/citas/' + encodeURIComponent(cita) + '/cancelacion',{method:'POST'}),
    antecedente: (id,datos) => solicitar('pacientes/' + encodeURIComponent(id) + '/antecedentes',{method:'POST',body:JSON.stringify(datos)}),
    pacientes: termino => solicitar('pacientes?buscar=' + encodeURIComponent(termino)),
    medicos: () => solicitar('medicos'),
    consulta: (id, datos, clave) => solicitar('pacientes/' + encodeURIComponent(id) + '/consultas', { method: 'POST', headers:clave?{'Idempotency-Key':clave}:{}, body: JSON.stringify(datos) }),
    examen: (id, datos) => solicitar('pacientes/' + encodeURIComponent(id) + '/examenes', { method: 'POST', body: JSON.stringify(datos) }),
    sesion: () => solicitar('sesion'),
    historial: id => solicitar('pacientes/' + encodeURIComponent(id) + '/historial'),
    registrar: datos => solicitar('pacientes', { method: 'POST', body: JSON.stringify(datos) })
  };
}
