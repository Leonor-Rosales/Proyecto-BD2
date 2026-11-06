const base = 'http://127.0.0.1:3100/api';
const casos = [
  ['maria.hospital', process.env.API_HOSPITAL_PASSWORD || '1234', '1', 200],
  ['maria.laboratorio', process.env.API_LAB_PASSWORD || '1234', 'PAC-001', 200],
  ['josue.pediatria', process.env.API_PEDIATRIA_PASSWORD || '1234', '1', 200],
  ['josue.odontologia', process.env.API_ODONTOLOGIA_PASSWORD || '1234', 'ODO-001', 200],
  ['maria.hospital', process.env.API_HOSPITAL_PASSWORD || '1234', 'PAC-001', 404],
  ['', '', '1', 401]
];
for (const [usuario, clave, id, esperado] of casos) {
  const headers = usuario ? { Authorization: 'Basic ' + Buffer.from(usuario + ':' + clave).toString('base64') } : {};
  const res = await fetch(base + '/pacientes/' + id + '/historial', { headers });
  const datos = await res.json();
  console.log(usuario || 'Sin credenciales', id, res.status, res.status === esperado ? 'OK' : 'FALLO');
  if (res.status !== esperado) process.exitCode = 1;
}
