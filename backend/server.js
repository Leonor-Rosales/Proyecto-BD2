import express from 'express';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { altaHospital, altaLaboratorio, historialHospital, historialLaboratorio } from './repositorios.js';

const usuarios = new Map([
  ['maria.hospital', { clave: process.env.API_HOSPITAL_PASSWORD, historial: historialHospital, alta: altaHospital }],
  ['maria.laboratorio', { clave: process.env.API_LAB_PASSWORD, historial: historialLaboratorio, alta: altaLaboratorio }]
]);
if ([...usuarios.values()].some(usuario => !usuario.clave)) {
  throw new Error('Configura las dos contraseñas de la API en .env antes de iniciar.');
}
const hash = valor => createHash('sha256').update(valor).digest();
const app = express();
app.disable('x-powered-by');
app.get('/api/salud', (_req, res) => res.json({ estado: 'activo' }));
app.use(['/api/pacientes', '/api/sesion'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const token = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(req.get('Authorization') || '');
  const credencial = Buffer.from(token?.[1] || '', 'base64').toString();
  const corte = credencial.indexOf(':');
  const usuario = usuarios.get(credencial.slice(0, corte));
  if (!usuario || !timingSafeEqual(hash(usuario.clave), hash(credencial.slice(corte + 1)))) {
    return res.status(401).set('WWW-Authenticate', 'Basic realm="BD2"').json({ error: 'Credenciales requeridas' });
  }
  res.locals.usuario = usuario;
  res.locals.entidad = credencial.slice(0, corte).split('.')[1];
  next();
});
app.get('/api/sesion', (_req, res) => res.json({ entidad: res.locals.entidad }));
app.use(express.static(fileURLToPath(new URL('../frontend/', import.meta.url))));
app.post('/api/pacientes', express.json({ limit: '16kb' }), async (req, res) => {
  const { nombres, apellidos, fecha_nacimiento } = req.body || {};
  const textoValido = valor => typeof valor === 'string' && valor.trim().length > 0 &&
    valor.trim().length <= 100 && !valor.includes('\u0000');
  if (![nombres, apellidos].every(textoValido)) {
    return res.status(400).json({ error: 'Ingresa nombres y apellidos de 1 a 100 caracteres.' });
  }
  const fecha = typeof fecha_nacimiento === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento)
    ? new Date(fecha_nacimiento + 'T00:00:00Z') : new Date(NaN);
  if (!Number.isFinite(fecha.getTime()) || fecha.getUTCFullYear() < 1 ||
      fecha.toISOString().slice(0, 10) !== fecha_nacimiento || fecha > new Date()) {
    return res.status(400).json({ error: 'Ingresa una fecha de nacimiento válida en formato AAAA-MM-DD.' });
  }
  const id = await res.locals.usuario.alta({ nombres: nombres.trim(), apellidos: apellidos.trim(), fecha_nacimiento });
  res.location('/api/pacientes/' + id + '/historial').status(201).json({ id });
});
app.get('/api/pacientes/:id/historial', async (req, res) => {
  const expediente = await res.locals.usuario.historial(req.params.id);
  if (!expediente) return res.status(404).json({ error: 'Expediente no encontrado' });
  res.json(expediente);
});
app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Revisa el cuerpo JSON de la solicitud.' });
  }
  console.error('Error de consulta:', err.name, err.code || '');
  res.status(500).json({ error: 'No se pudo consultar el expediente' });
});
app.listen(3100, '127.0.0.1', () => console.log('API local en http://127.0.0.1:3100'));
