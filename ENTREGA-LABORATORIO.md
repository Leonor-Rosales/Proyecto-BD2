# Laboratorio: revisión y guía de entrega

Revisión local: 5 de noviembre de 2026. Este documento cubre el módulo de María; no certifica la finalización de las cuatro instituciones.

## Iniciar y demostrar

Desde la raíz del proyecto, con Docker Desktop iniciado y el archivo local `.env` configurado:

```powershell
docker compose up -d --wait
npm --prefix backend ci
npm --prefix backend start
```

Si la API ya está ejecutándose, utiliza esa instancia. Abre http://127.0.0.1:3100 y selecciona Laboratorio Clínico. No es necesario recrear volúmenes ni volver a ejecutar la carga inicial para usar estos cambios.

1. Entra con `maria.laboratorio` y la contraseña `API_LAB_PASSWORD` de `.env`.
2. Pulsa **Registrar paciente**. Completa nombres, apellidos y fecha de nacimiento; los datos de contacto son opcionales. Guarda el ID generado para encontrarlo después.
3. En **Datos del paciente**, cambia teléfono o dirección y pulsa **Guardar datos**.
4. En **Registrar atención**, escribe un motivo. Puedes añadir diagnóstico, procedimiento y receta. Si añades una receta, completa medicamento, dosis, frecuencia y duración. Utiliza datos ficticios para la demostración.
5. En **Registrar examen**, selecciona hematología, orina o cultivo. Completa los campos de la plantilla y guarda. Para un examen diferente, selecciona **Estudio personalizado** y añade parámetros, resultados y unidades opcionales.
6. Abre **Resultados de exámenes** para revisar los estudios y **Atenciones anteriores** para consultar las atenciones. Vuelve al directorio y busca al paciente por nombre o ID.
7. Cierra sesión y entra con `secretaria.laboratorio`, cuya contraseña está en `API_SECRETARIA_LAB_PASSWORD`. Esta cuenta permite administrar pacientes; no muestra ni permite consultar resultados clínicos.
8. Abre el paciente, despliega **Archivar expediente**, escribe la causa y confirma. El archivo conserva la información. No existe eliminación permanente ni reactivación en esta versión.
9. Entra de nuevo como María: el historial permanece disponible, pero no se admiten nuevos exámenes ni atenciones para el paciente archivado.

La cuenta opcional `laboratorista.laboratorio` usa `API_LABORATORISTA_PASSWORD` y tiene las mismas funciones del Laboratorio que María. Las cuentas opcionales requieren sus variables al arrancar la API. Las contraseñas no se incluyen en Git.

## Verificación reproducible

Con la API abierta, ejecuta en otra terminal desde la raíz:

```powershell
node --env-file=.env backend/probar-roles-laboratorio.mjs
```

La prueba requiere las cuatro contraseñas de API que utiliza: María Hospital, María Laboratorio, laboratorista y secretaría del Laboratorio. Cada ejecución crea un paciente ficticio y lo deja archivado. No borra datos ni modifica pacientes existentes. Si se interrumpe por un fallo, el paciente de prueba puede quedar activo para inspeccionarlo.

| Comprobación | Resultado local |
|---|---|
| Alta, búsqueda por ID y edición de contacto | Correcto |
| Atención con diagnóstico, procedimiento y receta | Persistencia y lectura correctas |
| Hematología, orina, cultivo y estudio personalizado | Cuatro estudios guardados y recuperados |
| Plantilla desconocida, campos faltantes/adicionales y tipos incorrectos | Rechazados con 422 |
| Solicitud sin credenciales | Rechazada con 401 |
| Secretariado intentando leer historial o escribir atención/resultados | Rechazado con 403 |
| Datos administrativos sin consultas ni exámenes | Correcto |
| Consulta de ID MongoDB desde Hospital | No encontrado; no se mezclan instituciones |
| Archivo con motivo vacío | Rechazado con 422 |
| Repetir archivo | Conserva motivo y fecha originales |
| Atención o examen después de archivar | Rechazado con 409 |
| Historial después de archivar | Conserva consultas y resultados |

También se verificó en Edge el flujo de alta, examen de orina, lectura del historial, edición de teléfono y archivo. No hubo errores JavaScript ni desbordamiento horizontal del historial con anchos de 390 y 1440 píxeles. Esto no sustituye una revisión de accesibilidad de todas las pantallas.

## Modelado, consistencia y seguridad para el comparativo

**Asignación de motor.** MongoDB permite almacenar resultados heterogéneos: una hematología tiene parámetros distintos de una orina o un cultivo. PostgreSQL en Hospital permite relaciones con claves foráneas y operaciones transaccionales entre consulta, diagnósticos y recetas. Ambas instituciones comparten rutas de alta e historial, aunque sus repositorios persisten estructuras distintas.

**Documentos y referencias.** `pacientes` contiene identificación, contacto, estado y fechas administrativas. Las consultas se embeben con sus diagnósticos, procedimientos y recetas. Los nuevos exámenes también se embeben con ID, tipo, resultados y fecha. Los exámenes anteriores siguen en la colección `examenes`, referenciados por `paciente_id`; el repositorio combina ambos orígenes al leer. Se conserva esta compatibilidad sin migrar ni borrar registros históricos.

**Consistencia.** Registrar una consulta completa o un examen utiliza una única actualización del documento del paciente, condicionada a que esté activo. Archivar actualiza ese mismo documento. Así, una escritura clínica aplicada después del archivo no supera la condición de estado. No se utilizan transacciones entre documentos en el MongoDB standalone actual. En Hospital, el registro de consulta y sus elementos asociados utiliza BEGIN/COMMIT y revierte con ROLLBACK ante errores.

**Seguridad.** La API identifica la institución a partir de la cuenta autenticada, no de un motor enviado por el navegador. El servidor restringe las operaciones de secretaría y devuelve únicamente campos administrativos en `/datos`. Los datos enviados pasan por validaciones y listas de campos permitidos. MongoDB y PostgreSQL requieren contraseñas y sus puertos Docker están publicados solo en localhost. La autenticación HTTP Basic es para la demostración local: esta configuración no está preparada para publicar datos reales en Internet.

**Límites explícitos.** Los arrays embebidos crecen con el historial. Para alto volumen se debe separar los exámenes y definir un mecanismo de consistencia con transacciones sobre replica set, o una estrategia equivalente. Las plantillas actuales son ejemplos académicos, no un catálogo clínico validado. No se han implementado auditoría de cambios, recuperación de contraseñas, edición de exámenes ya emitidos ni prevención de duplicados ante reintentos de alta de exámenes. El archivo sí es idempotente.

## Pendientes del conjunto de la entrega

- Integrar y probar Pediatría y Odontología con sus motores; actualmente sus tarjetas indican integración pendiente.
- Completar el comparativo con las decisiones reales de MySQL y Firebase del equipo y actualizar los modelos entregables para que coincidan con la implementación.
- La separación hexagonal es parcial: existen adaptadores de frontend y repositorios por institución, pero algunas rutas acceden directamente a la base de datos. No presentar el proyecto como una arquitectura hexagonal completa ni como intercambio de motores por configuración ya resuelto.
- Ejecutar una demostración conjunta de operaciones equivalentes en los cuatro motores cuando estén integrados.

El contrato de rutas, cuerpos y permisos para Josué se mantiene en [ENDPOINTS.md](ENDPOINTS.md). Estos pendientes grupales no impiden demostrar el flujo local del Laboratorio verificado aquí.
