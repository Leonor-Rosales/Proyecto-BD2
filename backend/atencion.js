function invalido(mensaje) {
  throw Object.assign(new Error(mensaje), { status: 422 });
}

function texto(valor, campo, maximo) {
  if (typeof valor !== 'string' || !valor.trim() || valor.includes('\u0000') || valor.trim().length > maximo) {
    invalido('Revisa el campo ' + campo + '.');
  }
  return valor.trim();
}

function lista(valor, campo) {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) invalido(campo + ' debe ser una lista.');
  return valor;
}

function objeto(valor, campo) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) invalido(campo + ' debe ser un objeto.');
  return valor;
}

export function leerConsulta(body, hospital) {
  const datos = objeto(body, 'consulta');
  const consulta = {
    motivo: texto(datos.motivo, 'motivo', 4000),
    notas: datos.notas ? texto(datos.notas, 'notas', 8000) : null,
    signos_vitales: datos.signos_vitales == null ? null : objeto(datos.signos_vitales, 'signos_vitales'),
    diagnosticos: lista(datos.diagnosticos, 'diagnosticos').map(d => {
      if (!['presuntivo', 'definitivo'].includes(d?.tipo)) invalido('Tipo de diagnóstico inválido.');
      return { codigo_cie: texto(d.codigo_cie, 'codigo_cie', 10), descripcion: texto(d.descripcion, 'descripcion', 255), tipo: d.tipo };
    }),
    tratamientos: lista(datos.tratamientos, 'tratamientos').map(t => ({
      nombre_procedimiento: texto(t?.nombre_procedimiento, 'nombre_procedimiento', 150)
    })),
    recetas: lista(datos.recetas, 'recetas').map(r => {
      const medicamentos = lista(r?.medicamentos, 'medicamentos').map(m => ({
        medicamento: texto(m?.medicamento, 'medicamento', 150), dosis: texto(m?.dosis, 'dosis', 50),
        frecuencia: texto(m?.frecuencia, 'frecuencia', 50), duracion: texto(m?.duracion, 'duracion', 50)
      }));
      if (!medicamentos.length) invalido('Cada receta requiere al menos un medicamento.');
      return { medicamentos };
    })
  };
  if (hospital) consulta.id_personal = texto(String(datos.id_personal ?? ''), 'id_personal', 19);
  return consulta;
}

export function leerExamen(body) {
  const resultados = objeto(body?.resultados, 'resultados');
  if (!Object.keys(resultados).length) invalido('Incluye al menos un resultado.');
  return { tipo: texto(body.tipo, 'tipo', 150), resultados };
}
