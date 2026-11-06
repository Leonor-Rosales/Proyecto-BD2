# API de historiales clínicos

## Levantar una copia local

Desde la raíz del repositorio, usa Docker Desktop en modo Linux y Node.js 24. En una copia nueva, crea un archivo `.env` con cuatro valores locales distintos. Este ejemplo de PowerShell genera las claves antes del primer arranque. Conserva el archivo mientras uses los mismos volúmenes.

```powershell
if (!(Test-Path .env)) {
  'HOSPITAL_PASSWORD','LAB_PASSWORD','API_HOSPITAL_PASSWORD','API_LAB_PASSWORD' |
    ForEach-Object { "$_=$([guid]::NewGuid().ToString('N'))" } | Set-Content .env
}
docker compose up -d --wait
npm --prefix backend ci
npm --prefix backend start
```

Abre la aplicación en `http://127.0.0.1:3100`. Los scripts iniciales crean un médico y una institución en Hospital, y el paciente de laboratorio `PAC-001`. Para probar Hospital en una instalación nueva, primero crea un paciente y usa el ID devuelto.

## Autenticación y rutas disponibles

La base de las rutas es `http://127.0.0.1:3100/api`. Usa HTTP Basic en cada petición protegida. La cuenta `maria.hospital` usa la clave local `API_HOSPITAL_PASSWORD` y `maria.laboratorio` usa `API_LAB_PASSWORD`. El servidor selecciona el adaptador según la cuenta. Las escrituras reciben `Content-Type: application/json`. Trata los identificadores como cadenas.

| Método y ruta | Cuenta | Resultado |
|---|---|---|
| GET /salud | Pública | 200 con `{"estado":"activo"}` |
| GET /sesion | Ambas | 200 con `{"entidad":"hospital"}` o `{"entidad":"laboratorio"}` |
| POST /pacientes | Ambas | 201 con `{"id":"…"}` y Location apuntando a `/datos` para secretaría o a `/historial` para los demás roles |
| GET /pacientes/:id/historial | Ambas | 200 con `paciente`, `consultas` y `examenes` |
| GET /medicos | Hospital | 200 con una lista de médicos activos con `id`, `nombres` y `apellidos` |
| GET /pacientes?buscar=Ana | Ambas | 200 con hasta 25 pacientes por nombre, apellidos o ID. Sin término devuelve los primeros en orden alfabético. Cada fila contiene `id`, `nombres` y `apellidos`. |
| POST /pacientes/:id/consultas | Ambas | 201 con el ID de la consulta nueva |
| POST /pacientes/:id/examenes | Laboratorio | 201 con el ID del examen nuevo |

## Registrar y consultar un paciente desde PowerShell

Ejecuta desde la raíz en una segunda terminal. Sustituye el perfil y el nombre de la variable de contraseña para probar la otra institución.

```powershell
$clave = ((Select-String -Path .env -Pattern '^API_HOSPITAL_PASSWORD=').Line -split '=',2)[1]
$token = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("maria.hospital:$clave"))
$cabeceras = @{ Authorization = "Basic $token" }
$api = 'http://127.0.0.1:3100/api'
$datos = @{ nombres='Demo'; apellidos='Integración'; fecha_nacimiento='2001-01-15' } | ConvertTo-Json
$paciente = Invoke-RestMethod "$api/pacientes" -Method Post -Headers $cabeceras -ContentType 'application/json; charset=utf-8' -Body $datos
Invoke-RestMethod "$api/pacientes/$($paciente.id)/historial" -Headers $cabeceras | ConvertTo-Json -Depth 12
```

Los tres campos son obligatorios. Un expediente recién abierto devuelve esta estructura:

```json
{"paciente":{"id":"3","nombres":"Demo","apellidos":"Integración"},"consultas":[],"examenes":[]}
```

## Registrar una atención

Envía este cuerpo a `POST /pacientes/:id/consultas`. En Hospital reemplaza `id_personal` por un ID de `GET /medicos`. En Laboratorio omite ese campo. El motivo es obligatorio. Notas, signos vitales, diagnósticos, tratamientos y recetas son opcionales. Cada receta incluida requiere uno o más medicamentos completos. El tipo de diagnóstico admite `presuntivo` o `definitivo`.

```json
{
  "motivo": "Consulta de prueba",
  "id_personal": "1",
  "notas": "Seguimiento simulado",
  "signos_vitales": {"temperatura": 36.5},
  "diagnosticos": [{"codigo_cie":"R51","descripcion":"Cefalea","tipo":"presuntivo"}],
  "tratamientos": [{"nombre_procedimiento":"Observación clínica"}],
  "recetas": [{"medicamentos":[
    {"medicamento":"Ficticio A","dosis":"1 unidad","frecuencia":"Diaria","duracion":"3 días"}
  ]}]
}
```

La fecha se asigna en el servidor. Hospital guarda la atención y sus detalles en una transacción. Laboratorio incorpora la atención completa mediante una actualización atómica del documento del paciente. Una petición POST exitosa crea una atención nueva cada vez. Consulta el historial antes de repetirla si se pierde la respuesta.

## Registrar un examen

Envía el tipo y un objeto de resultados con al menos un campo a `POST /pacientes/:id/examenes`.

```json
{"tipo":"Examen de orina","resultados":{"color":"amarillo","ph":6}}
```

La respuesta tiene la forma `{"id":"EX-…"}`. Recupera los resultados con la ruta de historial del mismo paciente.

## Errores y conexión de las siguientes instituciones

Los errores de estas rutas devuelven `{"error":"mensaje"}`. El código 400 indica JSON incorrecto o datos de alta inválidos, 401 credenciales inválidas, 403 una operación exclusiva de otra institución, 404 un expediente ausente y 422 una atención o un examen inválido. Hospital también devuelve 422 si el paciente y el médico activo no corresponden al registrar una atención. Los cuerpos de consultas y exámenes admiten hasta 32 KB.

Para incorporar Pediatría y Odontología, registra la cuenta y sus adaptadores de `alta`, `historial` y `consulta` en el servidor. Mantén los campos del contrato y devuelve listas vacías cuando el expediente aún no tenga atenciones. El frontend centraliza las peticiones en `frontend/api.js`. Habilita la tarjeta de cada institución después de probar su adaptador y ajustar los campos específicos de su formulario.

## Hospital · atención ambulatoria

Para actualizar un volumen de Hospital creado antes de la agenda, desde PowerShell:

```powershell
Get-Content -Raw hospital/005_agenda.sql | docker compose exec -T hospital psql -v ON_ERROR_STOP=1 -U postgres -d hospital_general
```

Las rutas siguientes utilizan la cuenta del Hospital. Los identificadores pertenecen a esa institución.

| Operación | Solicitud | Resultado |
|---|---|---|
| Agendar | POST /pacientes/:id/citas | 201 con el ID |
| Reprogramar o cambiar médico | PATCH /pacientes/:id/citas/:cita | 200 con el ID |
| Cancelar | POST /pacientes/:id/citas/:cita/cancelacion | 200 con estado cancelada |
| Consultar turnos ocupados | GET /agenda?medico=1&desde=2026-11-01&hasta=2026-11-30 | 200 con citas programadas, paciente y hora, ambos días inclusive |
| Agregar antecedente | POST /pacientes/:id/antecedentes | 201 con el ID |
| Revisar antes de atender | GET /pacientes/:id/historial | Incluye listas citas y antecedentes, además de consultas |

Para agendar y reprogramar, envía el mismo formato. Elige una fecha futura en Guatemala. Los turnos empiezan a la hora o a la media hora. Un cruce de horario del médico o del paciente devuelve 409.

```json
{"id_personal":"1","fecha":"2027-02-05T09:30","motivo":"Control ambulatorio"}
```

Para registrar un antecedente, envía tipo y descripción. Los tipos disponibles son alergico, patologico, quirurgico y familiar. La gravedad es opcional para alergias.

```json
{"tipo":"alergico","descripcion":"Alergia de prueba","gravedad":"Leve"}
```

Para atender, agrega el campo opcional id_cita al cuerpo de POST /pacientes/:id/consultas y usa el mismo médico de la cita. El servidor guarda signos vitales, diagnósticos, tratamientos y medicamentos y cambia la cita a atendida en una sola transacción. Si la cita ya fue atendida, cancelada o pertenece a otro paciente o médico, responde 409. Sin id_cita se registra una atención espontánea. GET /medicos incluye la especialidad cuando está asignada.

## Hospital · internamiento

Con un volumen existente, aplica la migración desde la raíz antes de iniciar el servidor. En volúmenes nuevos Docker la ejecuta automáticamente.

```powershell
Get-Content -Raw hospital/006_internamiento.sql | docker compose exec -T hospital psql -v ON_ERROR_STOP=1 -U postgres -d hospital_general
```

Las rutas usan el prefijo `/api/pacientes/:id/hospitalizaciones` y requieren una cuenta del Hospital. La migración incorpora habitaciones ficticias en cuatro unidades del hospital de prueba.

| Método | Sufijo | Cuerpo o respuesta |
|---|---|---|
| GET | /habitaciones?unidad=UCI | Habitaciones con camas libres en la sede del paciente. El filtro admite UCI, normal, urgencias y pediatria. Omítelo para ver todas. |
| GET | (sin sufijo) | Ingresos del paciente con motivo, estado, fechas y recorrido de estancias. Una estancia abierta tiene fin nulo. |
| POST | (sin sufijo) | Enviar `{"motivo":"Observación","id_habitacion":"1"}`. Devuelve 201 con id y estado. |
| POST | /:ingreso/traslados | Enviar `{"id_habitacion":"2"}`. Cierra la estancia anterior y abre la siguiente en el mismo ingreso. |
| POST | /:ingreso/alta | Enviar `{}`. Cierra la estancia, marca el ingreso de alta y libera la cama. |

Usa los identificadores devueltos por las consultas. Un conflicto de capacidad o una transición incompatible devuelve 409. El traslado y el alta devuelven 200 con id y estado. Cada operación se ejecuta en una transacción. La interfaz presenta las fechas en hora de Guatemala.

## Hospital · cargos, factura y pagos

Para volúmenes existentes, aplica la migración desde PowerShell antes de iniciar la API:

```powershell
Get-Content -Raw hospital/007_facturacion.sql | docker compose exec -T hospital psql -v ON_ERROR_STOP=1 -U postgres -d hospital_general
```

Las rutas usan el prefijo `/api/pacientes/:id/hospitalizaciones` y la cuenta del Hospital.

| Método | Sufijo | Uso |
|---|---|---|
| GET | /catalogo | Medicamentos con su ID, nombre genérico y presentación. Para los honorarios usa GET /api/medicos. |
| GET | /:ingreso/cuenta | Devuelve cargos, acumulado, factura (nula mientras esté pendiente de emisión) y pagos. La factura contiene ID, fecha, total, estado y saldo. |
| POST | /:ingreso/cargos | Registra un cargo mientras el paciente está internado. Devuelve 201 con su ID. |
| POST | /:ingreso/alta | Cierra la estancia, libera la cama y emite una sola factura en la misma transacción. |
| POST | /:ingreso/factura | Emite la factura de un ingreso anterior ya dado de alta o devuelve la existente. Responde 200. |
| POST | /:ingreso/pagos | Registra un abono y actualiza el estado de la factura. Devuelve 201 con el ID del pago. |

Ejemplo de cargo:

```json
{"tipo":"servicio","descripcion":"Servicio de prueba","cantidad":"2","precio_unitario":"12.50"}
```

Tipos: material, servicio, medicamento (requiere id_medicamento) y honorario_medico (requiere id_personal). Los precios están en quetzales. La cantidad y el precio son positivos y admiten dos decimales. Cada subtotal se redondea al centavo antes de sumar. Un alta sin cargos genera una factura de Q0.00 saldada.

Ejemplo de pago:

```json
{"monto":"10.00","metodo":"efectivo","referencia":"DEMO-01"}
```

Métodos: efectivo, tarjeta o seguro. La referencia es opcional. Usa un UUID nuevo en el encabezado Idempotency-Key para cada cargo o pago y reutiliza esa misma clave al reenviar la misma operación. Un cargo después del alta o un abono mayor que el saldo devuelve 409. Datos inválidos devuelven 422 y un ingreso ajeno al paciente devuelve 404.

## Hospital · habitaciones, medicamentos y administración durante un ingreso

Para un volumen existente ejecuta en PowerShell:

```powershell
Get-Content -Raw hospital/008_catalogos.sql | docker compose exec -T hospital psql -v ON_ERROR_STOP=1 -U postgres -d hospital_general
```

El menú **Catálogos del Hospital** permite consultar y crear habitaciones y medicamentos, y actualizar precios por unidad. Las rutas requieren la cuenta del Hospital.

| Método y ruta | Cuerpo |
|---|---|
| GET /api/catalogos/habitaciones | Lista de habitaciones con número, unidad, piso, capacidad y estado |
| POST /api/catalogos/habitaciones | `{"numero":"N-102","tipo_unidad":"normal","piso":"1","capacidad":2}` |
| GET /api/catalogos/medicamentos | Lista con nombre, presentación, unidad de cobro y precio |
| POST /api/catalogos/medicamentos | `{"nombre_generico":"Demo","presentacion":"Tableta","unidad_medida":"tableta","precio_unitario":"8.50"}` |
| PATCH /api/catalogos/medicamentos/:id | `{"precio_unitario":"9.00"}` |
| POST /api/pacientes/:id/hospitalizaciones/:ingreso/administraciones | `{"id_medicamento":"1","cantidad":"2"}` |

Una administración registrada durante un ingreso activo genera un cargo con el precio vigente, cantidad y fecha. Enviar el mismo Idempotency-Key (UUID) al reintentar evita cobrar dos veces. Una nueva administración usa otra clave. Los medicamentos existentes quedan con precio pendiente hasta que se asigne en el catálogo. Los cambios de precio solo afectan cargos posteriores. Los cargos manuales de medicamentos con precio asignado también utilizan el precio de catálogo.

## Hospital · datos, archivo y roles

Aplica `hospital/009_archivo.sql` a un volumen existente con el mismo procedimiento de las migraciones previas.

| Ruta | Operación |
|---|---|
| POST /api/pacientes | Acepta nombres, apellidos, fecha_nacimiento y campos opcionales dpi_cui, genero, direccion, telefono, correo_electronico, contacto_emergencia_nombre y contacto_emergencia_telefono |
| GET /api/pacientes/:id/datos | Devuelve datos administrativos, estado, motivo y fecha de baja |
| PATCH /api/pacientes/:id | Actualiza únicamente los campos de paciente enviados |
| POST /api/pacientes/:id/archivo | Cuerpo `{"motivo":"Traslado"}`. Conserva el historial y cancela las citas pendientes. Rechaza el archivo con 409 si existe hospitalización activa |
| GET /api/pacientes/:id/citas | Devuelve fechas, estado y médico para gestionar la agenda |
| GET y POST /api/catalogos/especialidades | Lista especialidades o crea una con nombre y descripción opcional |
| POST /api/catalogos/medicos | Registra nombres, apellidos, dpi_cui, num_colegiado, rol (medico o especialista), id_especialidad y teléfono/correo opcionales |

La cuenta maria.hospital tiene rol administrador. Para habilitar las cuentas de demostración adicionales, configura API_MEDICO_PASSWORD y API_SECRETARIA_PASSWORD en el archivo local .env antes de arrancar la API. Se usan los usuarios medico.hospital y secretaria.hospital. GET /api/sesion devuelve entidad y rol.

- Administrador gestiona todas las funciones del Hospital.
- Médico consulta y registra atención, administra medicamentos y gestiona internamientos. Puede consultar catálogos y cuentas. Los cambios de catálogo, cargos manuales, emisión manual de factura y pagos requieren administrador.
- Secretaria registra y edita pacientes, archiva expedientes y gestiona citas. El servidor rechaza el acceso al historial clínico, antecedentes, consultas y hospitalizaciones.

El formulario de profesionales registra al médico en el catálogo clínico. Las cuentas de acceso se configuran separadamente en .env. Los registros existentes siguen disponibles aunque no tengan datos de contacto.

## Laboratorio · datos y archivo del expediente

La primera parte del Laboratorio utiliza las rutas comunes POST /api/pacientes, GET /api/pacientes/:id/datos, PATCH /api/pacientes/:id y POST /api/pacientes/:id/archivo con la cuenta maria.laboratorio. El alta acepta los mismos campos de identificación y contacto que Hospital. El motivo de archivo es obligatorio. Repetir un archivo conserva su motivo y fecha originales.

Los documentos anteriores sin estado se interpretan como activos. Sus datos faltantes aparecen vacíos para que puedan completarse. El archivo conserva consultas y resultados y bloquea nuevas consultas y exámenes con HTTP 409.

### Decisión de modelado para esta versión

Los nuevos exámenes se incorporan al documento del paciente mediante una actualización condicionada a su estado activo. La escritura y la comprobación de estado son atómicas en MongoDB. Los exámenes anteriores permanecen en la colección examenes y el endpoint de historial combina ambos orígenes. Las consultas también se agregan atómicamente al paciente activo.

Este diseño requiere vigilar el crecimiento del documento del paciente. Para historiales de alto volumen, la evolución prevista es conservar todos los exámenes por separado y usar transacciones en un replica set. Esta versión local mantiene compatibilidad con los documentos y colecciones ya creados.

## Laboratorio · tipos de examen

GET /api/tipos-examen devuelve el catálogo de plantillas para la cuenta del Laboratorio. Incluye hematologia, orina y cultivo, con nombre, campos, tipo de dato y unidad. Son plantillas iniciales del proyecto que deben ajustarse al catálogo real del laboratorio.

POST /api/pacientes/:id/examenes admite tipo_id y resultados. El servidor determina el nombre y las unidades a partir de la plantilla y exige todos sus campos. Los valores numéricos deben ser finitos y no negativos. Un campo faltante, adicional o con tipo incorrecto devuelve 422.

```json
{"tipo_id":"orina","resultados":{"color":"amarillo","aspecto":"claro","ph":6}}
```

Para estudios personalizados, omite tipo_id y envía tipo con el nombre y resultados como un objeto de parámetros. Cada resultado puede ser un texto, número o un objeto con valor y unidad. La pantalla permite añadir y quitar filas. Los exámenes previos siguen mostrándose con sus campos originales. La fecha de los nuevos exámenes se presenta en hora de Guatemala.

## Laboratorio · permisos por cuenta

GET /api/sesion devuelve entidad `laboratorio` y rol `laboratorista` o `secretaria`. La cuenta existente `maria.laboratorio` conserva sus funciones y utiliza el rol `laboratorista`.

| Usuario | Contraseña configurada en .env | Permisos |
|---|---|---|
| maria.laboratorio | API_LAB_PASSWORD | Pacientes, archivo, consultas, resultados y plantillas |
| laboratorista.laboratorio | API_LABORATORISTA_PASSWORD | Los mismos permisos de María en Laboratorio |
| secretaria.laboratorio | API_SECRETARIA_LAB_PASSWORD | Buscar, registrar, editar datos administrativos y archivar pacientes |

Las dos cuentas adicionales solo se habilitan cuando su variable contiene una contraseña al iniciar el servidor. Configura contraseñas distintas en tu archivo local `.env` y reinicia con `node --env-file=.env backend/server.js`. No publiques ese archivo ni las contraseñas en Git.

Secretaría puede usar GET /api/sesion, GET y POST /api/pacientes, GET /api/pacientes/:id/datos, PATCH /api/pacientes/:id y POST /api/pacientes/:id/archivo. El endpoint de datos excluye consultas y exámenes. Las demás operaciones devuelven 403 para esa cuenta, incluidas la lectura de historial y la escritura de resultados. La pantalla de secretaría muestra únicamente identificación, contacto y archivo; no carga agenda hospitalaria ni resultados.

Para Josué: consulta el rol al iniciar sesión y utiliza `/datos` para abrir pacientes con secretaría; `/historial` requiere laboratorista. Los permisos se comprueban en el servidor. Las credenciales incorrectas devuelven 401; una operación no autorizada, 403.

Prueba local con API y Docker encendidos: `node --env-file=.env backend/probar-roles-laboratorio.mjs`. Crea un paciente ficticio, verifica el flujo completo (atenciones, cuatro estudios, validaciones, permisos y archivo) y conserva su expediente archivado como evidencia. No modifica pacientes existentes. Consulta el recorrido y los límites de la entrega en [ENTREGA-LABORATORIO.md](ENTREGA-LABORATORIO.md).
