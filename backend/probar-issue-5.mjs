import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:3100/api';

const cuentas = {
  josuePediatria: ['josue.pediatria', process.env.API_PEDIATRIA_PASSWORD || '1234'],
  secretariaPediatria: ['secretaria.pediatria', process.env.API_PEDIATRIA_SECRETARIA_PASSWORD || '1234'],
  josueOdontologia: ['josue.odontologia', process.env.API_ODONTOLOGIA_PASSWORD || '1234'],
  secretariaOdontologia: ['secretaria.odontologia', process.env.API_ODONTOLOGIA_SECRETARIA_PASSWORD || '1234'],
  mariaHospital: ['maria.hospital', process.env.API_HOSPITAL_PASSWORD || '1234'],
  secretariaHospital: ['secretaria.hospital', process.env.API_SECRETARIA_PASSWORD || '1234'],
  mariaLab: ['maria.laboratorio', process.env.API_LAB_PASSWORD || '1234'],
  secretariaLab: ['secretaria.laboratorio', process.env.API_SECRETARIA_LAB_PASSWORD || '1234']
};

async function solicitar(rol, ruta, estado, metodo = 'GET', datos) {
  const [usuario, clave] = cuentas[rol];
  assert.ok(clave, 'Configura la contraseña de ' + usuario + ' en .env');
  const headers = {
    Authorization: 'Basic ' + Buffer.from(usuario + ':' + clave).toString('base64'),
    'Content-Type': 'application/json'
  };
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    signal: AbortSignal.timeout(15000),
    headers,
    body: datos === undefined ? undefined : JSON.stringify(datos)
  });
  assert.equal(respuesta.status, estado, `${metodo} ${ruta} (${rol}) devolvió ${respuesta.status}, esperado ${estado}`);
  return await respuesta.json();
}

console.log('--- 1. Verificación de Sesiones y Catálogos ---');
const sesionPediatria = await solicitar('josuePediatria', '/sesion', 200);
assert.equal(sesionPediatria.entidad, 'pediatria');
assert.equal(sesionPediatria.rol, 'administrador');

const sesionSecPediatria = await solicitar('secretariaPediatria', '/sesion', 200);
assert.equal(sesionSecPediatria.entidad, 'pediatria');
assert.equal(sesionSecPediatria.rol, 'secretaria');

const sesionOdonto = await solicitar('josueOdontologia', '/sesion', 200);
assert.equal(sesionOdonto.entidad, 'odontologia');
assert.equal(sesionOdonto.rol, 'administrador');

const sesionSecOdonto = await solicitar('secretariaOdontologia', '/sesion', 200);
assert.equal(sesionSecOdonto.entidad, 'odontologia');
assert.equal(sesionSecOdonto.rol, 'secretaria');

const medicosPediatria = await solicitar('josuePediatria', '/medicos', 200);
assert.ok(medicosPediatria.length > 0);
assert.ok(medicosPediatria.some(m => m.apellidos.includes('Menéndez')));
console.log('Pediatras disponibles:', medicosPediatria.length);

const medicosOdonto = await solicitar('josueOdontologia', '/medicos', 200);
assert.ok(medicosOdonto.length >= 2);
console.log('Odontólogos disponibles:', medicosOdonto.length);

console.log('--- 2. Criterio Pediatría (Cuenta clínica) ---');
// 1. Abrir menor (ID 1 de demostración o nuevo)
const pacPed = await solicitar('josuePediatria', '/pacientes/1/datos', 200);
const telOriginalPed = pacPed.telefono;
const nuevoTelPed = '5551-' + Math.floor(1000 + Math.random() * 9000);

// Editar y volver a leer un dato de contacto
await solicitar('josuePediatria', '/pacientes/1', 200, 'PATCH', { telefono: nuevoTelPed });
const pacPedActualizado = await solicitar('josuePediatria', '/pacientes/1/datos', 200);
assert.equal(pacPedActualizado.telefono, nuevoTelPed);
console.log('Contacto editado y verificado en Pediatría:', nuevoTelPed);

// Elegir pediatra, guardar control con peso y talla
const pesoTest = Number((9.1 + Math.random() * 0.5).toFixed(2));
const tallaTest = Number((72.0 + Math.random() * 0.5).toFixed(1));
const motivoConsultaPed = 'Control clínico de prueba ' + Date.now();
const resConsPed = await solicitar('josuePediatria', '/pacientes/1/consultas', 201, 'POST', {
  id_personal: medicosPediatria[0].id,
  motivo: motivoConsultaPed,
  tipo_consulta: 'control_nino_sano',
  control_crecimiento: {
    peso_kg: pesoTest,
    talla_cm: tallaTest,
    perimetro_cefalico_cm: 45.2,
    percentil_observado: 'P50'
  }
});
assert.ok(resConsPed.id);

// Recargar y comprobar que aparece una sola vez
const histPed = await solicitar('josuePediatria', '/pacientes/1/historial', 200);
const coincidenciasPed = histPed.consultas.filter(c => c.motivo === motivoConsultaPed);
assert.equal(coincidenciasPed.length, 1, 'La consulta debe aparecer una sola vez');
const controlGuardado = histPed.controles_crecimiento.find(c => Number(c.peso_kg) === pesoTest);
assert.ok(controlGuardado, 'El control de crecimiento debe haberse guardado');
console.log('Consulta y control registrados y únicos en Pediatría. ID consulta:', resConsPed.id);

console.log('--- 3. Criterio Odontología (Cuenta clínica) ---');
// 1. Abrir paciente ODO-001
const pacOdo = await solicitar('josueOdontologia', '/pacientes/ODO-001/datos', 200);
const nuevoTelOdo = '5552-' + Math.floor(1000 + Math.random() * 9000);
await solicitar('josueOdontologia', '/pacientes/ODO-001', 200, 'PATCH', { telefono: nuevoTelOdo });
const pacOdoActualizado = await solicitar('josueOdontologia', '/pacientes/ODO-001/datos', 200);
assert.equal(pacOdoActualizado.telefono, nuevoTelOdo);
console.log('Contacto editado y verificado en Odontología:', nuevoTelOdo);

// Elegir odontólogo, registrar atención sobre pieza 25
const motivoOdo = 'Restauración estética ' + Date.now();
const resConsOdo = await solicitar('josueOdontologia', '/pacientes/ODO-001/consultas', 201, 'POST', {
  id_personal: medicosOdonto[0].id,
  motivo: motivoOdo,
  tratamientos: [{
    nombre_procedimiento: 'Resina compuesta en pieza 25',
    pieza: 25,
    nuevo_estado: 'obturado'
  }]
});
assert.ok(resConsOdo.id);

// Recargar y comprobar visita y odontograma
const histOdo = await solicitar('josueOdontologia', '/pacientes/ODO-001/historial', 200);
const coincidenciasOdo = histOdo.consultas.filter(c => c.motivo === motivoOdo);
assert.equal(coincidenciasOdo.length, 1, 'La consulta odontológica debe aparecer una sola vez');
const pieza25 = histOdo.odontograma.find(p => p.numero === 25);
assert.ok(pieza25, 'La pieza 25 debe existir en el odontograma');
assert.equal(pieza25.estado, 'obturado', 'La pieza 25 debe estar obturada');
console.log('Consulta odontológica y actualización de odontograma verificadas. ID consulta:', resConsOdo.id);

console.log('--- 4. Criterio Secretaría en Ambas Instituciones ---');
// Pediatría Secretaría:
const nuevoPedSec = await solicitar('secretariaPediatria', '/pacientes', 201, 'POST', {
  nombres: 'Ficticio Pediatria',
  apellidos: 'Prueba Secretaria',
  fecha_nacimiento: '2024-01-01',
  telefono: '55500011'
});
const idPedFicticio = nuevoPedSec.id;
console.log('Paciente ficticio Pediatría creado:', idPedFicticio);

const busquedaPed = await solicitar('secretariaPediatria', '/pacientes?buscar=' + idPedFicticio, 200);
assert.ok(busquedaPed.some(p => String(p.id) === String(idPedFicticio)));

await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio, 200, 'PATCH', { direccion: 'Calle Falsa 123' });
const datosPedSec = await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/datos', 200);
assert.equal(datosPedSec.direccion, 'Calle Falsa 123');

// Archivar con motivo
await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/archivo', 200, 'POST', {
  motivo: 'Fin de tratamiento pediátrico'
});
const datosPedArchivado = await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/datos', 200);
assert.equal(datosPedArchivado.estado, 'baja');
assert.equal(datosPedArchivado.motivo_baja, 'Fin de tratamiento pediátrico');
console.log('Paciente ficticio archivado en Pediatría y baja verificada.');

// Odontología Secretaría:
const nuevoOdoSec = await solicitar('secretariaOdontologia', '/pacientes', 201, 'POST', {
  nombres: 'Ficticio Odonto',
  apellidos: 'Prueba Secretaria',
  fecha_nacimiento: '1995-05-15',
  telefono: '55500022'
});
const idOdoFicticio = nuevoOdoSec.id;
console.log('Paciente ficticio Odontología creado:', idOdoFicticio);

const busquedaOdo = await solicitar('secretariaOdontologia', '/pacientes?buscar=' + idOdoFicticio, 200);
assert.ok(busquedaOdo.some(p => String(p.id) === String(idOdoFicticio)));

await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio, 200, 'PATCH', { direccion: 'Avenida Siempre Viva 742' });
const datosOdoSec = await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/datos', 200);
assert.equal(datosOdoSec.direccion, 'Avenida Siempre Viva 742');

// Archivar con motivo
await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/archivo', 200, 'POST', {
  motivo: 'Traslado a otra ciudad'
});
const datosOdoArchivado = await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/datos', 200);
assert.equal(datosOdoArchivado.estado, 'baja');
assert.equal(datosOdoArchivado.motivo_baja, 'Traslado a otra ciudad');
console.log('Paciente ficticio archivado en Odontología y baja verificada.');

console.log('--- 5. Permisos y Aislamiento ---');
// Verificar 403 en solicitudes clínicas directas de secretaría:
await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/historial', 403);
await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/consultas', 403, 'POST', { motivo: 'Intento de consulta' });
await solicitar('secretariaPediatria', '/pacientes/' + idPedFicticio + '/citas', 403);

await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/historial', 403);
await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/consultas', 403, 'POST', { motivo: 'Intento de consulta' });
await solicitar('secretariaOdontologia', '/pacientes/' + idOdoFicticio + '/citas', 403);

console.log('403 confirmado en rutas clínicas para secretaría de Pediatría y Odontología.');

// Comprobar que clínica no puede registrar consulta en paciente archivado:
await solicitar('josuePediatria', '/pacientes/' + idPedFicticio + '/consultas', 422, 'POST', {
  id_personal: medicosPediatria[0].id,
  motivo: 'Consulta rechazada por baja'
});
await solicitar('josueOdontologia', '/pacientes/' + idOdoFicticio + '/consultas', 422, 'POST', {
  id_personal: medicosOdonto[0].id,
  motivo: 'Consulta rechazada por baja'
});
console.log('Restricción del servidor verificada: consultas en pacientes dados de baja devuelven 422.');

// Aislamiento: Con datos ficticios de igual ID entre instituciones:
// Hospital tiene paciente ID '1' (PostgreSQL) y Pediatría tiene paciente ID '1' (MySQL)
const hosp1Antes = await solicitar('mariaHospital', '/pacientes/1/datos', 200);
const ped1Antes = await solicitar('josuePediatria', '/pacientes/1/datos', 200);

const telHospOriginal = hosp1Antes.telefono;
const nuevoTelPedAislado = '5557-9999';

try {
  // Editar teléfono en Pediatría
  await solicitar('josuePediatria', '/pacientes/1', 200, 'PATCH', { telefono: nuevoTelPedAislado });

  // Verificar que Hospital ID '1' NO fue modificado
  const hosp1Despues = await solicitar('mariaHospital', '/pacientes/1/datos', 200);
  assert.equal(hosp1Despues.telefono, telHospOriginal, 'Editar en Pediatría NO debe modificar Hospital');

  // Verificar que Pediatría ID '1' SÍ fue modificado
  const ped1Despues = await solicitar('josuePediatria', '/pacientes/1/datos', 200);
  assert.equal(ped1Despues.telefono, nuevoTelPedAislado, 'Pediatría debe reflejar el nuevo teléfono');
} finally {
  await solicitar('josuePediatria', '/pacientes/1', 200, 'PATCH', { telefono: ped1Antes.telefono });
}
console.log('Aislamiento entre instituciones confirmado: editar paciente 1 en Pediatría no tocó paciente 1 en Hospital.');

console.log('--- 6. No Regresión ---');
// Secretaría de Hospital conserva citas
const citasHospital = await solicitar('secretariaHospital', '/pacientes/1/citas', 200);
assert.ok(Array.isArray(citasHospital));
console.log('Secretaría de Hospital accede a citas correctamente.');

// Secretaría de Laboratorio abre sus datos administrativos
const datosLab = await solicitar('secretariaLab', '/pacientes/PAC-001/datos', 200);
assert.ok(datosLab.id);
console.log('Secretaría de Laboratorio accede a datos administrativos correctamente.');

console.log('\n>>> Todos los criterios de aceptación del backend/API cumplidos exitosamente. <<<');
process.exit(0);
