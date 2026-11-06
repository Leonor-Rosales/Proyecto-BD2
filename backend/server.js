import express from 'express';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  altaHospital, altaLaboratorio, altaPediatria, altaOdontologia,
  historialHospital, historialLaboratorio, historialPediatria, historialOdontologia,
  consultaHospital, consultaLaboratorio, consultaPediatria, consultaOdontologia,
  examenLaboratorio, medicosHospital, medicosPediatria, medicosOdontologia,
  buscarHospital, buscarLaboratorio, buscarPediatria, buscarOdontologia,
  archivarHospital, archivarPediatria, archivarLaboratorio, archivarOdontologia,
  inicializarOdontologia
} from './repositorios.js';
import { leerConsulta, leerExamen } from './atencion.js';
import { ambulatorio } from './ambulatorio.js';
import { internamiento } from './internamiento.js';
import { catalogos } from './catalogos.js';
import { pacientes, validarPaciente } from './pacientes.js';
import { tiposExamen } from './tipos-examen.js';

const usuarios = new Map([
  ['maria.hospital', { clave: process.env.API_HOSPITAL_PASSWORD, historial: historialHospital, alta: altaHospital, consulta: consultaHospital, medicos: medicosHospital, buscar: buscarHospital, archivar: archivarHospital, rol: 'administrador' }],
  ['maria.laboratorio', { clave: process.env.API_LAB_PASSWORD, historial: historialLaboratorio, alta: altaLaboratorio, consulta: consultaLaboratorio, examen: examenLaboratorio, buscar: buscarLaboratorio, archivar: archivarLaboratorio, rol: 'medico' }]
]);

if (process.env.API_PEDIATRIA_PASSWORD) {
  usuarios.set('josue.pediatria', {
    clave: process.env.API_PEDIATRIA_PASSWORD,
    historial: historialPediatria,
    alta: altaPediatria,
    consulta: consultaPediatria,
    medicos: medicosPediatria,
    buscar: buscarPediatria,
    archivar: archivarPediatria,
    rol: 'administrador'
  });
}
if (process.env.API_PEDIATRIA_SECRETARIA_PASSWORD) {
  usuarios.set('secretaria.pediatria', {
    clave: process.env.API_PEDIATRIA_SECRETARIA_PASSWORD,
    historial: historialPediatria,
    alta: altaPediatria,
    consulta: consultaPediatria,
    medicos: medicosPediatria,
    buscar: buscarPediatria,
    archivar: archivarPediatria,
    rol: 'secretaria'
  });
}

if (process.env.API_ODONTOLOGIA_PASSWORD) {
  usuarios.set('josue.odontologia', {
    clave: process.env.API_ODONTOLOGIA_PASSWORD,
    historial: historialOdontologia,
    alta: altaOdontologia,
    consulta: consultaOdontologia,
    medicos: medicosOdontologia,
    buscar: buscarOdontologia,
    archivar: archivarOdontologia,
    rol: 'administrador'
  });
}
if (process.env.API_ODONTOLOGIA_SECRETARIA_PASSWORD) {
  usuarios.set('secretaria.odontologia', {
    clave: process.env.API_ODONTOLOGIA_SECRETARIA_PASSWORD,
    historial: historialOdontologia,
    alta: altaOdontologia,
    consulta: consultaOdontologia,
    medicos: medicosOdontologia,
    buscar: buscarOdontologia,
    archivar: archivarOdontologia,
    rol: 'secretaria'
  });
}

if (!process.env.API_HOSPITAL_PASSWORD || !process.env.API_LAB_PASSWORD) {
  throw new Error('Configura las dos contraseñas de la API en .env antes de iniciar.');
}
usuarios.get('maria.hospital').rol='administrador';
usuarios.get('maria.laboratorio').rol='laboratorista';
for (const [nombre,rol,variable] of [
  ['medico.hospital','medico','API_MEDICO_PASSWORD'],
  ['secretaria.hospital','secretaria','API_SECRETARIA_PASSWORD']
]) {
  if (process.env[variable]) usuarios.set(nombre,{...usuarios.get('maria.hospital'),rol,clave:process.env[variable]});
}
for (const [nombre,rol,variable] of [
  ['laboratorista.laboratorio','laboratorista','API_LABORATORISTA_PASSWORD'],
  ['secretaria.laboratorio','secretaria','API_SECRETARIA_LAB_PASSWORD']
]) {
  if (process.env[variable]) usuarios.set(nombre,{...usuarios.get('maria.laboratorio'),rol,clave:process.env[variable]});
}
const hash = valor => createHash('sha256').update(valor).digest();
const app = express();
app.disable('x-powered-by');
app.get('/api/salud', (_req, res) => res.json({ estado: 'activo' }));
app.use(['/api/pacientes', '/api/sesion', '/api/medicos', '/api/agenda','/api/catalogos','/api/tipos-examen'], (req, res, next) => {
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
  const rol=usuario.rol;
  const ruta=req.originalUrl.split('?')[0];
  if (rol==='secretaria') {
    if (res.locals.entidad==='laboratorio') {
      const permitida = req.method==='GET' && ['/api/sesion','/api/pacientes'].includes(ruta) ||
        req.method==='POST' && ruta==='/api/pacientes' ||
        req.method==='GET' && /^\/api\/pacientes\/[^/]+\/datos\/?$/i.test(ruta) ||
        req.method==='PATCH' && /^\/api\/pacientes\/[^/]+\/?$/i.test(ruta) ||
        req.method==='POST' && /^\/api\/pacientes\/[^/]+\/archivo\/?$/i.test(ruta);
      if (!permitida) return res.status(403).json({error:'Secretaría del Laboratorio solo permite gestionar datos de pacientes y archivar expedientes.'});
      return next();
    }
    const permitida = ruta==='/api/sesion' || ruta==='/api/medicos' || ruta==='/api/agenda' ||
      ruta==='/api/pacientes' || /^\/api\/pacientes\/[^/]+(?:\/datos|\/archivo|\/citas(?:\/[^/]+(?:\/cancelacion)?)?)?$/.test(ruta);
    if (!permitida) return res.status(403).json({error:'Tu cuenta de secretaría permite pacientes y agenda.'});
  }
  if (rol==='medico' && (ruta.includes('/catalogos') && req.method!=='GET' || /\/(pagos|factura|cargos)$/.test(ruta))) {
    return res.status(403).json({error:'Esta operación requiere la cuenta administradora.'});
  }
  next();
});
app.get('/api/sesion', (_req, res) => res.json({ entidad: res.locals.entidad,rol:res.locals.usuario.rol }));
app.get('/api/tipos-examen', (_req,res)=>{
  if (res.locals.entidad!=='laboratorio') return res.status(403).json({error:'Disponible en Laboratorio.'});
  res.json(tiposExamen);
});
app.get('/api/pacientes', async (req, res) => {
  const termino = req.query.buscar ?? '';
  if (typeof termino !== 'string' || termino.length > 150 || termino.includes('\u0000')) {
    return res.status(400).json({ error: 'Ingresa un nombre o identificador válido.' });
  }
  const buscar = res.locals.usuario.buscar || (res.locals.entidad === 'hospital' ? buscarHospital : buscarLaboratorio);
  res.json(await buscar(termino.trim()));
});
app.use(express.static(fileURLToPath(new URL('../frontend/', import.meta.url))));
app.get('/api/medicos', async (_req, res) => {
  const { medicos } = res.locals.usuario;
  if (!medicos) return res.status(403).json({ error: 'Disponible en Hospital, Pediatría y Odontología.' });
  res.json(await medicos());
});
app.post('/api/pacientes/:id/consultas', express.json({ limit: '32kb' }), async (req, res) => {
  const datos = leerConsulta(req.body, ['hospital', 'pediatria', 'odontologia'].includes(res.locals.entidad));
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
  if (['hospital', 'laboratorio', 'pediatria', 'odontologia'].includes(res.locals.entidad)) {
    const id = await res.locals.usuario.alta(validarPaciente(req.body));
    const destino = res.locals.usuario.rol === 'secretaria' ? 'datos' : 'historial';
    return res.location('/api/pacientes/' + id + '/' + destino).status(201).json({ id });
  }
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
app.post('/api/pacientes/:id/archivo', express.json({ limit: '16kb' }), async (req, res) => {
  const motivo = req.body?.motivo;
  if (typeof motivo !== 'string' || !motivo.trim() || motivo.length > 2000 || motivo.includes('\u0000')) {
    return res.status(422).json({ error: 'Escribe la causa del archivo.' });
  }
  const { archivar } = res.locals.usuario;
  if (!archivar) return res.status(403).json({ error: 'Operación no soportada para esta entidad.' });
  const resultado = await archivar(req.params.id, motivo);
  if (!resultado) return res.status(404).json({ error: 'Paciente no encontrado.' });
  res.json(resultado);
});
app.get('/api/pacientes/:id/historial', async (req, res) => {
  const expediente = await res.locals.usuario.historial(req.params.id);
  if (!expediente) return res.status(404).json({ error: 'Expediente no encontrado' });
  res.json(expediente);
});
app.use('/api/pacientes/:id/hospitalizaciones', internamiento);
app.use('/api/pacientes', pacientes);
app.use('/api/catalogos', catalogos);
app.use('/api', ambulatorio);
app.use((err, req, res, next) => {
  if (err.code === '23505' || err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return res.status(409).json({ error: 'Ya existe un registro con ese DPI, colegiado, correo o nombre.' });
  }
  if (err.code === '23503' || err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    return res.status(422).json({ error: 'La referencia seleccionada no existe.' });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: [404,409,422].includes(err.status) ? err.message : 'Revisa el cuerpo JSON de la solicitud.' });
  }
  console.error('Error de consulta:', err.name, err.code || err.errno || err.message || '');
  res.status(500).json({ error: 'No se pudo consultar el expediente' });
});
inicializarOdontologia().catch(() => {});
app.listen(3100, () => console.log('API local en http://127.0.0.1:3100'));
