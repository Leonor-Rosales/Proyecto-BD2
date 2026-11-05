# Proyecto BD2
Proyecto para aprender acerca de las diferentes DB SQL y No SQL

## Portal institucional local

El [contrato de los endpoints](ENDPOINTS.md) incluye la configuración inicial, las rutas por institución y ejemplos de registro de pacientes, consultas y exámenes.

Desde la raíz del proyecto, con las credenciales de Docker y la API en `.env`, ejecutar:

```powershell
docker compose up -d --wait
npm --prefix backend ci
npm --prefix backend start
```

Abrir http://127.0.0.1:3100 y elegir una institución. Hospital usa el usuario
`maria.hospital` con `API_HOSPITAL_PASSWORD`. Laboratorio usa `maria.laboratorio`
con `API_LAB_PASSWORD`. Las contraseñas se consultan en el archivo local `.env`.
Pediatría y Odontología tienen páginas de estado hasta incorporar sus adaptadores.

La vista usa las operaciones `sesion`, `historial` y `registrar` del adaptador
HTTP del frontend. El servidor autentica al usuario y resuelve las operaciones
de historial y alta con el repositorio de su institución. La selección de una
tarjeta solo determina la navegación.
