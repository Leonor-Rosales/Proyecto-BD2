db.pacientes.insertOne({ _id: "PAC-001", nombres: "Ana", apellidos: "Paciente de Prueba" });
db.examenes.insertOne({
    _id: "EX-001",
    paciente_id: "PAC-001",
    tipo: "Hematología",
    resultados: { hemoglobina: { valor: 13.2, unidad: "g/dL" } }
});
