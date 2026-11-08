import assert from 'node:assert/strict';
import { altaHospital, consultaHospital, historialHospital, postgres } from './repositorios.js';

// Ejecutar desde la raíz: node --env-file=.env backend/probar-integridad-hospital.mjs
// Cada ejecución conserva un paciente ficticio con su historial vacío como evidencia.
try {
  const id = await altaHospital({
    nombres: 'Prueba de integridad', apellidos: 'Hospital', fecha_nacimiento: '2000-01-01'
  });
  const contarHistoriales = async () => {
    const { rows } = await postgres.query(
      'SELECT count(*)::int AS total FROM hospital.historial_clinico WHERE id_paciente=$1', [id]
    );
    return rows[0].total;
  };
  assert.equal(await contarHistoriales(), 1);
  await assert.rejects(
    postgres.query('INSERT INTO hospital.historial_clinico (id_paciente) VALUES ($1)', [id]),
    { code: '23505', table: 'historial_clinico' }
  );
  assert.equal(await contarHistoriales(), 1);
  console.log('Paciente ficticio ' + id + ': segundo historial rechazado (23505). Historiales antes/después: 1/1.');

  const { rows: [medico] } = await postgres.query(
    'SELECT id_personal FROM hospital.personal_medico WHERE dpi_cui=$1', ['DEMO-MED-001']
  );
  assert.ok(medico, 'Se necesita el médico ficticio de la migración 003.');
  const antes = await historialHospital(id);
  assert.deepEqual(antes.consultas, []);
  const medicamento = { medicamento: 'Ficticio A', dosis: 'Demo', frecuencia: 'Demo', duracion: 'Demo' };
  await assert.rejects(consultaHospital(id, {
    id_personal: medico.id_personal, motivo: 'Prueba de rollback', notas: null, signos_vitales: null,
    diagnosticos: [{ codigo_cie: 'DEMO', descripcion: 'Diagnóstico ficticio', tipo: 'presuntivo' }],
    tratamientos: [{ nombre_procedimiento: 'Procedimiento ficticio' }],
    recetas: [{ medicamentos: [medicamento, { ...medicamento, medicamento: 'Ficticio B', dosis: null }] }]
  }), { code: '23502', table: 'receta_detalle', column: 'dosis' });
  assert.deepEqual(await historialHospital(id), antes);
  console.log('Segundo medicamento rechazado por dosis nula (23502). Consultas antes/después: 0/0. Expediente idéntico tras el rollback.');
} finally {
  await postgres.end();
}
