import { tiposExamen } from './tipos-examen.js';
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
    tratamientos: lista(datos.tratamientos, 'tratamientos').map(t => {
      const item = { nombre_procedimiento: texto(t?.nombre_procedimiento, 'nombre_procedimiento', 150) };
      if (t?.pieza != null && !isNaN(Number(t.pieza))) item.pieza = Number(t.pieza);
      if (t?.nuevo_estado) item.nuevo_estado = texto(String(t.nuevo_estado), 'nuevo_estado', 50);
      return item;
    }),
    recetas: lista(datos.recetas, 'recetas').map(r => {
      const medicamentos = lista(r?.medicamentos, 'medicamentos').map(m => ({
        medicamento: texto(m?.medicamento, 'medicamento', 150), dosis: texto(m?.dosis, 'dosis', 50),
        frecuencia: texto(m?.frecuencia, 'frecuencia', 50), duracion: texto(m?.duracion, 'duracion', 50)
      }));
      if (!medicamentos.length) invalido('Cada receta requiere al menos un medicamento.');
      return { medicamentos };
    })
  };
  if (datos.tipo_consulta && ['control_nino_sano', 'enfermedad', 'urgencia'].includes(datos.tipo_consulta)) {
    consulta.tipo_consulta = datos.tipo_consulta;
  }
  if (datos.control_crecimiento && typeof datos.control_crecimiento === 'object') {
    const cc = datos.control_crecimiento;
    if (cc.peso_kg != null && cc.talla_cm != null) {
      consulta.control_crecimiento = {
        peso_kg: Number(cc.peso_kg),
        talla_cm: Number(cc.talla_cm),
        perimetro_cefalico_cm: cc.perimetro_cefalico_cm != null ? Number(cc.perimetro_cefalico_cm) : null,
        percentil_observado: cc.percentil_observado ? texto(String(cc.percentil_observado), 'percentil_observado', 50) : null
      };
    }
  }
  if (hospital) consulta.id_personal = texto(String(datos.id_personal ?? ''), 'id_personal', 19);
  if (hospital && datos.id_cita != null) consulta.id_cita = texto(String(datos.id_cita), 'id_cita', 19);
  return consulta;
}

export function leerExamen(body) {
  const resultados = objeto(body?.resultados, 'resultados');
  if (!Object.keys(resultados).length) invalido('Incluye al menos un resultado.');
  if (body.tipo_id) {
    const tipo=tiposExamen.find(t=>t.id===body.tipo_id);
    if (!tipo) invalido('Tipo de examen desconocido.');
    const normalizados={};
    for (const campo of tipo.campos) {
      const entrada=resultados[campo.nombre];
      const valor=entrada && typeof entrada==='object'?entrada.valor:entrada;
      if (campo.tipo==='numero' && (typeof valor!=='number'||!Number.isFinite(valor)||valor<0)) invalido('Ingresa un valor numérico válido en '+campo.etiqueta+'.');
      normalizados[campo.nombre]={valor:campo.tipo==='texto'?texto(valor,campo.etiqueta,2000):valor};
      if (campo.unidad) normalizados[campo.nombre].unidad=campo.unidad;
    }
    if (Object.keys(resultados).some(k=>!tipo.campos.some(c=>c.nombre===k))) invalido('El examen contiene parámetros que no corresponden al tipo seleccionado.');
    return {tipo_id:tipo.id,tipo:tipo.nombre,resultados:normalizados};
  }
  const personalizados=Object.create(null);
  for (const [campo,entrada] of Object.entries(resultados)) {
    texto(campo,'parámetro',100);
    if (campo.startsWith('$')||campo.includes('.')||['__proto__','constructor','prototype'].includes(campo)) invalido('Nombre de parámetro inválido.');
    const estructurado=entrada && typeof entrada==='object' && !Array.isArray(entrada);
    const valor=estructurado?entrada.valor:entrada;
    if (typeof valor==='number') {
      if (!Number.isFinite(valor)) invalido('Resultado numérico inválido.');
    } else texto(valor,campo,2000);
    if (estructurado) {
      personalizados[campo]={valor};
      if (entrada.unidad) personalizados[campo].unidad=texto(entrada.unidad,'unidad',50);
    } else personalizados[campo]=valor;
  }
  return { tipo: texto(body.tipo, 'tipo', 150), resultados:personalizados };
}
