export const tiposExamen = [
  { id:'hematologia', nombre:'Hematología', campos:[
    {nombre:'hemoglobina',etiqueta:'Hemoglobina',tipo:'numero',unidad:'g/dL'},
    {nombre:'hematocrito',etiqueta:'Hematocrito',tipo:'numero',unidad:'%'},
    {nombre:'leucocitos',etiqueta:'Leucocitos',tipo:'numero',unidad:'células/µL'},
    {nombre:'plaquetas',etiqueta:'Plaquetas',tipo:'numero',unidad:'células/µL'}
  ]},
  { id:'orina', nombre:'Examen de orina', campos:[
    {nombre:'color',etiqueta:'Color',tipo:'texto'},
    {nombre:'aspecto',etiqueta:'Aspecto',tipo:'texto'},
    {nombre:'ph',etiqueta:'pH',tipo:'numero'}
  ]},
  { id:'cultivo', nombre:'Cultivo', campos:[
    {nombre:'muestra',etiqueta:'Muestra',tipo:'texto'},
    {nombre:'resultado',etiqueta:'Resultado',tipo:'texto'},
    {nombre:'observaciones',etiqueta:'Observaciones',tipo:'texto'}
  ]}
];
