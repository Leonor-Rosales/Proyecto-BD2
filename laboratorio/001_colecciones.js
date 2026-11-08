db.pacientes.updateOne(
  { _id: "PAC-001" },
  { $setOnInsert: { nombres: "Ana", apellidos: "Paciente de Prueba" } },
  { upsert: true }
);

for (const examen of [
  { _id: "EX-001", tipo: "Hematología", resultados: { hemoglobina: { valor: 13.2, unidad: "g/dL" } } },
  { _id: "EX-002", tipo: "Examen de orina", resultados: { color: "amarillo", aspecto: "claro", ph: 6 } }
]) {
  const { _id, ...datos } = examen;
  db.examenes.updateOne(
    { _id },
    { $setOnInsert: { paciente_id: "PAC-001", ...datos } },
    { upsert: true }
  );
}
