export function selectorPanel(etiqueta, opciones, seleccionar, inicial) {
  const control=document.createElement('label');
  control.className='selector-panel';
  control.append(etiqueta);
  const select=document.createElement('select');
  for (const [clave,nombre] of opciones) select.add(new Option(nombre,clave));
  if (opciones.some(([clave])=>clave===inicial)) select.value=inicial;
  control.append(select);
  const cambiar=()=>seleccionar(select.value);
  select.addEventListener('change',cambiar);
  cambiar();
  return control;
}
