import express from 'express';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { altaHospital, altaLaboratorio, historialHospital, historialLaboratorio, consultaHospital, consultaLaboratorio, examenLaboratorio, medicosHospital } from './repositorios.js';
import { leerConsulta, leerExamen } from './atencion.js';
import { buscarHospital, buscarLaboratorio } from './repositorios.js';
import { ambulatorio } from './ambulatorio.js';
import { internamiento } from './internamiento.js';

const usuarios = new Map([
  ['maria.hospital', { clave: process.env.API_HOSPITAL_PASSWORD, historial: historialHospital, alta: altaHospital, consulta: consultaHospital, medicos: medicosHospital }],
  ['maria.laboratorio', { clave: process.env.API_LAB_PASSWORD, historial: historialLaboratorio, alta: altaLaboratorio, consulta: consultaLaboratorio, examen: examenLaboratorio }]
]);
if ([...usuarios.values()].some(usuario => !usuario.clave)) {
  throw new Error('Configura las dos contraseñas de la API en .env antes de iniciar.');
}
const hash = valor => createHash('sha256').update(valor).digest();
const app = express();
app.disable('x-powered-by');
app.get('/api/salud', (_req, res) => res.json({ estado: 'activo' }));
app.use(['/api/pacientes', '/api/sesion', '/api/medicos', '/api/agenda'], (req, res, next) => {
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
app.get('/api/pacientes', async (req, res) => {
  const termino = req.query.buscar ?? '';
  if (typeof termino !== 'string' || termino.length > 150 || termino.includes('\u0000')) {
    return res.status(400).json({ error: 'Ingresa un nombre o identificador válido.' });
  }
  const buscar = res.locals.entidad === 'hospital' ? buscarHospital : buscarLaboratorio;
  res.json(await buscar(termino.trim()));
});
app.use(express.static(fileURLToPath(new URL('../frontend/', import.meta.url))));
app.get('/api/medicos', async (_req, res) => {
  const { medicos } = res.locals.usuario;
  if (!medicos) return res.status(403).json({ error: 'Disponible en Hospital.' });
  res.json(await medicos());
});
app.post('/api/pacientes/:id/consultas', express.json({ limit: '32kb' }), async (req, res) => {
  const datos = leerConsulta(req.body, res.locals.entidad === 'hospital');
  const id = await res.locals.usuario.consulta(req.params.id, datos);
  if (!id) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.status(201).json({ id });
});
app.post('/api/pacientes/:id/examenes', express.json({ limit: '32kb' }), async (req, res) => {
  const { examen } = res.locals.usuario;
  if (!examen) return res.status(403).json({ error: 'Disponible en Laboratorio.' });
  const id = await examen(req.params.id, leerExamen(req.body));
  if (!id) return res.status(404).json({ error: 'Paciente no encontrado' });
  res.status(201).json({ id });
});
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
app.use('/api/pacientes/:id/hospitalizaciones', internamiento);
app.use('/api', ambulatorio);
app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: [404,409,422].includes(err.status) ? err.message : 'Revisa el cuerpo JSON de la solicitud.' });
  }
  console.error('Error de consulta:', err.name, err.code || '');
  res.status(500).json({ error: 'No se pudo consultar el expediente' });
});
app.listen(3100, '127.0.0.1', () => console.log('API local en http://127.0.0.1:3100'));
