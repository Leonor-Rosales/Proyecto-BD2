# Red Clinica Distribuida - Sistema de Gestion Hospitalaria y Expedientes Clinicos

Proyecto academico para la integracion de multiples motores de bases de datos relacionales (SQL) y no relacionales (NoSQL) en una red asistencial interconectada.

### Integrantes del Proyecto
* **Maria Leonor Rosales Gutierrez** - 1560124
* **Josue André Menéndez Juárez** - 1511124

El sistema unifica el acceso a cuatro instituciones medicas independientes a traves de una unica interfaz web y una API centralizada, garantizando el aislamiento de datos, la seguridad en base a roles y la atomicidad de las operaciones clinicas y administrativas.

---

## 1. Arquitectura de Datos e Instituciones

El sistema modela cuatro subsistemas especializados, cada uno implementado sobre el motor de base de datos mas adecuado segun sus requerimientos de consistencia, estructura y volumen de datos:

| Institucion | Motor de Base de Datos | Tipo | Proposito y Caracteristicas Tecnicas |
|---|---|---|---|
| **Hospital General** | PostgreSQL 16 | Relacional (SQL) | Gestion de consultas generales, prescripcion farmaceutica, hospitalizaciones, cargos por servicios, abonos financieros y transacciones complejas con garantias ACID. |
| **Laboratorio Clinico** | MongoDB 6.0 | Documental (NoSQL) | Gestion de estudios clinicos heterogeneos (hematologia, uroanalisis, cultivos y parametros dinamicos estructurados). Documentos extensibles con consistencia documental atomica. |
| **Centro Medico Pediatrico** | MySQL 8.0 | Relacional (SQL) | Controles de crecimiento y desarrollo infantil (peso, talla, perimetro cefalico, percentiles), esquemas de vacunacion y trazabilidad de pacientes menores de edad. |
| **Clinica Odontologica** | Google Cloud Firestore | Documental (NoSQL) | Modelado del odontograma anatomico fijo de 32 piezas dentales (FDI 11 a 48), evolucion de piezas por procedimiento, historial clinico dental y registro de cobros. |

---

## 2. Requisitos Previos

Para ejecutar la solucion en un entorno local se requiere:

* **Docker Desktop** (con soporte para Linux Containers y Docker Compose v2).
* **Node.js** (version 20 LTS o superior).
* **Git** (para control de versiones).

---

## 3. Guia de Instalacion y Puesta en Marcha

### Paso 1: Clonar el repositorio
```bash
git clone https://github.com/Leonor-Rosales/Proyecto-BD2.git
cd Proyecto-BD2
```

### Paso 2: Configuracion de Variables de Entorno
Crea un archivo `.env` en la raiz del proyecto basado en `.env.example`. Puedes crearlo manualmente o copiar el archivo de ejemplo:

```bash
cp .env.example .env
```

El archivo `.env` debe contener los siguientes parametros de conexion:

```env
# Contrasenas de bases de datos para Docker
HOSPITAL_PASSWORD=postgres123
LAB_PASSWORD=mongo123
PEDIATRIA_ROOT_PASSWORD=mysql123
PEDIATRIA_PASSWORD=mysql123

# Configuracion de Firestore (Emulador local)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_PROJECT_ID=clinica-odontologica

# Credenciales de acceso a la API y Portal
API_HOSPITAL_PASSWORD=1234
API_SECRETARIA_PASSWORD=1234
API_LAB_PASSWORD=1234
API_LABORATORISTA_PASSWORD=1234
API_SECRETARIA_LAB_PASSWORD=1234
API_PEDIATRIA_PASSWORD=1234
API_PEDIATRIA_SECRETARIA_PASSWORD=1234
API_ODONTOLOGIA_PASSWORD=1234
API_ODONTOLOGIA_SECRETARIA_PASSWORD=1234
```

### Paso 3: Levantar los contenedores de las Bases de Datos
Ejecuta Docker Compose desde la raiz del proyecto para iniciar los cuatro motores:

```bash
docker compose up -d --wait
```

Los contenedores quedaran expuestos en los siguientes puertos locales:
* PostgreSQL (Hospital General): `127.0.0.1:55432`
* MongoDB (Laboratorio Clinico): `127.0.0.1:57017`
* MySQL (Centro Medico Pediatrico): `127.0.0.1:33060`
* Firestore Emulator (Clinica Odontologica): `127.0.0.1:8080`

### Paso 4: Instalar dependencias e iniciar el servidor API
Instala las dependencias del directorio `backend` e inicia la aplicacion:

```bash
npm --prefix backend install
npm --prefix backend start
```

Alternativamente, si ejecutas desde el directorio `backend`:
```bash
cd backend
node --env-file=../.env server.js
```

### Paso 5: Acceso al Portal Institucional
Abre cualquier navegador web y navega a:
```
http://127.0.0.1:3100
```

---

## 4. Directorio de Cuentas y Credenciales de Demostracion

El portal utiliza autenticacion HTTP Basic. Cada institucion cuenta con credenciales diferenciadas por rol clinico y administrativo:

| Institucion | Rol | Usuario | Contrasena | Alcance y Permisos |
|---|---|---|---|---|
| **Hospital General** | Administrador / Clinico | `maria.hospital` | `1234` | Consultas, diagnosticos, recetas, catalogo medico, internamientos y facturacion. |
| **Hospital General** | Secretaria | `secretaria.hospital` | `1234` | Gestion administrativa de pacientes, datos de contacto y agenda de citas hospitalarias. |
| **Laboratorio Clinico** | Laboratorista | `maria.laboratorio` | `1234` | Registro de examenes de laboratorio, captura de resultados y consulta de historial. |
| **Laboratorio Clinico** | Secretaria | `secretaria.laboratorio` | `1234` | Alta y modificacion de datos de contacto del paciente y archivo de expedientes. |
| **Centro Medico Pediatrico** | Pediatra / Clinico | `josue.pediatria` | `1234` | Consultas pediatricas, controles de crecimiento, vacunacion y prescripciones. |
| **Centro Medico Pediatrico** | Secretaria | `secretaria.pediatria` | `1234` | Busqueda, edicion de datos de contacto y archivo administrativo de expedientes. |
| **Clinica Odontologica** | Odontologo / Clinico | `josue.odontologia` | `1234` | Visualizacion del odontograma, intervenciones por pieza dental y tratamientos. |
| **Clinica Odontologica** | Secretaria | `secretaria.odontologia` | `1234` | Busqueda, edicion de datos de contacto y archivo administrativo de expedientes. |

---

## 5. Estructura del Proyecto

```text
Proyecto-BD2/
|-- backend/                             # Logica del servidor y adaptadores de bases de datos
|   |-- ambulatorio.js                   # Endpoints de citas y agenda para Hospital General
|   |-- atencion.js                      # Procesamiento y validacion de consultas y examenes
|   |-- catalogos.js                     # Catalogo de procedimientos medicos y tarifas
|   |-- facturacion.js                   # Cobros, cargos hospitalarios y emision de facturas
|   |-- internamiento.js                 # Hospitalizacion, habitaciones y altas medicas
|   |-- pacientes.js                     # Rutas administrativas (/datos, /archivo, busqueda)
|   |-- repositorios.js                  # Adaptadores de conexion (pg, mysql2, mongodb, firestore)
|   |-- server.js                        # Configuracion de Express, middleware de auth y roles
|   |-- tipos-examen.js                  # Esquemas y campos de examenes de laboratorio
|   |-- probar.mjs                       # Pruebas basicas de conectividad y autenticacion
|   |-- probar-integridad-hospital.mjs   # Verificacion de unicidad y rollback transaccional en Postgres
|   |-- probar-roles-laboratorio.mjs     # Suite de permisos y examenes de laboratorio en Mongo
|   `-- package.json                     # Dependencias del backend (pg, mysql2, mongodb, firestore)
|
|-- frontend/                            # Interfaz de usuario (Single Page Application nativa)
|   |-- ambulatorio.js                   # Vista de agenda y citas medicas del hospital
|   |-- api.js                           # Cliente HTTP asincrono y envoltorio de peticiones
|   |-- app.js                           # Enrutador principal, control de sesion y renderizado
|   |-- catalogos.js                     # Modulo de gestion de catalogos hospitalarios
|   |-- datos-paciente.js                # Modulo de edicion de contacto y vista de secretaria
|   |-- expediente.js                    # Maquetacion de pestanas del expediente clinico
|   |-- facturacion.js                   # Interfaz de pagos, cuentas y cargos de internamiento
|   |-- internamiento.js                 # Asignacion de camas y gestion de hospitalizacion
|   |-- panel-acciones.js                # Acciones rapidas de navegacion
|   |-- estilos.css                      # Hojas de estilo estructuradas sin dependencias externas
|   `-- index.html                       # Documento raiz de la aplicacion web
|
|-- hospital/                            # Scripts de inicializacion de PostgreSQL
|   |-- 001_esquema.sql                  # Tablas relacionales, indices y llaves foraneas
|   |-- 002_catalogos.sql                # Procedimientos, especialidades y medicamentos base
|   |-- 003_personal.sql                 # Personal medico y credenciales institucionales
|   |-- 010_datos_demostracion.sql       # Pacientes ficticios y consultas precargadas
|   |-- 011_abonos.sql                   # Estructura financiera de pagos y abonos
|   `-- 012_tarifas_estancia.sql         # Configuracion de tarifas por tipo de habitacion
|
|-- laboratorio/                         # Scripts de inicializacion de MongoDB
|   `-- 001_colecciones.js               # Validadores JSON Schema, indices y documentos iniciales
|
|-- pediatria/                           # Scripts de inicializacion de MySQL
|   |-- 001_tablas.sql                   # Esquema relacional de tablas pediatricas
|   `-- 002_datos_prueba.sql             # Catalogo de vacunas, personal y paciente demostracion
|
|-- compose.yaml                         # Orquestacion de contenedores Docker
|-- ENDPOINTS.md                         # Especificacion formal del contrato de la API REST
|-- ENTREGA-LABORATORIO.md               # Documento tecnico de diseno y modelado NoSQL
`-- README.md                            # Documentacion general del repositorio
```

---

## 6. Seguridad, Aislamiento y Roles

1. **Aislamiento Multitenant:**
   * Cada peticion a la API valida las credenciales y aisla el contexto de ejecucion segun la institucion correspondiente.
   * La modificacion de un paciente en una institucion no altera registros en otras entidades que compartan identificadores numericos coincidentes.
2. **Separacion de Privilegios:**
   * **Cuentas Clinicas (Medicos, Odontologos, Laboratoristas):** Acceso completo al historial clinico, captura de signos vitales, diagnosticos CIE, tratamientos por pieza dental, examenes y recetas.
   * **Cuentas de Secretaria:** Acceso restringido exclusivamente a busqueda, actualizacion de contacto (direccion, telefonos, correos) y archivo administrativo. Intentos de acceso directo a rutas clinicas (`/historial`, `/consultas`, `/examenes`) son rechazados con codigo HTTP `403 Forbidden`.
3. **Manejo de Bajas y Archivo de Expedientes:**
   * El sistema no realiza eliminaciones fisicas (`DELETE`). Al dar de baja un expediente se actualiza el estado a `baja`, se registra el motivo y la fecha, y se cancelan automaticamente las citas medicas pendientes.
   * Un expediente archivado conserva permanentemente la lectura de su historial medico pero bloquea la emision de nuevas atenciones clinicas (rechazo con codigo HTTP `422 Unprocessable Entity`).

---

## 7. Ejecucion de Pruebas Automatizadas

El proyecto incluye suites de prueba que verifican la integridad referencial, el aislamiento y el cumplimiento funcional de los endpoints. Para ejecutarlas:

```bash
# Prueba basica de autenticacion y endpoints generales
node --env-file=.env backend/probar.mjs

# Prueba de integridad transaccional y rollback en PostgreSQL (Hospital)
node --env-file=.env backend/probar-integridad-hospital.mjs

# Prueba de roles, validaciones y estudios en MongoDB (Laboratorio)
node --env-file=.env backend/probar-roles-laboratorio.mjs
```
