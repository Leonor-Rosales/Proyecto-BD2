const base = 'http://127.0.0.1:3100/api';
const casos = [
  ['maria.hospital', process.env.API_HOSPITAL_PASSWORD, '1', 200],
  ['maria.laboratorio', process.env.API_LAB_PASSWORD, 'PAC-001', 200],
  ['maria.hospital', process.env.API_HOSPITAL_PASSWORD, 'PAC-001', 404],
  ['', '', '1', 401]
];
for (const [usuario, clave, id, esperado] of casos) {
  const headers = usuario ? { Authorization: 'Basic ' + Buffer.from(usuario + ':' + clave).toString('base64') } : {};
  const res = await fetch(base + '/pacientes/' + id + '/historial', { headers });
  const datos = await res.json();
  console.log(usuario || 'Sin credenciales', id, res.status, JSON.stringify(datos, null, 2));
  if (res.status !== esperado) process.exitCode = 1;
}
