# Mentes que Aprenden — Sistema de Gestión Clínica Interdisciplinaria

Aplicación web para un centro de salud interdisciplinario (psicopedagogía, psicología, fonoaudiología). Permite a cada profesional gestionar sus pacientes, agenda, sesiones, evaluaciones e informes, derivar pacientes entre colegas, registrar pagos y trabajar con un asistente de IA integrado.

---

## Índice

- [Funcionalidades](#funcionalidades)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [API REST](#api-rest)
- [Asistente de IA](#asistente-de-ia)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Tests y CI](#tests-y-ci)

---

## Funcionalidades

### Autenticación y profesionales
- Registro público de profesionales, login, logout, refresh de sesión, recuperación y cambio de contraseña (Supabase Auth).
- Dos roles: **admin** y **profesional**. El admin gestiona profesionales (edición y baja) y ve la liquidación mensual.
- Cada profesional tiene especialidad y un porcentaje de honorarios (70 % por defecto).

### Pacientes
- Alta, edición, búsqueda, listado paginado y baja lógica (no se borra la historia clínica).
- Estados: `activo`, `derivado`, `alta`, `inactivo`. Asociación a obra social.
- **Aislamiento por profesional:** cada profesional (incluido el admin) ve solo sus propios pacientes, más los que le fueron derivados con derivación aceptada.
- Ficha del paciente con sus sesiones, turnos, derivaciones, evaluaciones y archivos adjuntos.

### Agenda y turnos
- Calendario (día / semana / mes / lista) con FullCalendar.
- **Consultorios compartidos:** cada turno reserva uno de los 3 consultorios físicos. Todos los profesionales ven la ocupación de cada consultorio (sin datos del paciente ajeno) y la base de datos impide reservar dos turnos superpuestos en el mismo consultorio.
- Creación, edición, cancelación y eliminación de turnos.

### Sesiones
- Registro de sesiones (evaluación, tratamiento, seguimiento, devolución, reunión interdisciplinaria) con notas clínicas, duración y monto.
- Historial de versiones de las notas (cada edición queda guardada).

### Evaluaciones e informes
- Evaluaciones por paciente con pruebas aplicadas (resultados y observaciones), motivo, antecedentes, observación de conducta, conclusiones y sugerencias.
- Estado `borrador` / `finalizado`.
- **Generación del informe con IA:** la IA redacta el informe en formato profesional usando *únicamente* los datos cargados — no inventa puntajes ni diagnósticos.
- Exportación del informe a PDF desde el navegador.

### Derivaciones
- Derivar un paciente a otro profesional con motivo; el receptor acepta o rechaza, y luego puede marcarla como completada.
- Al aceptarla, el profesional receptor obtiene acceso al paciente.

### Archivos adjuntos
- Subida y descarga de documentos del paciente (informes, estudios, consentimientos) en Supabase Storage (bucket `historias-clinicas`), mediante URLs firmadas de corta duración.

### Pagos y liquidación
- Registro de pagos por sesión; el monto se divide automáticamente entre el profesional (según su porcentaje) y el espacio.
- Listado de sesiones pendientes de cobro.
- Liquidación mensual por profesional (solo admin).

### Asistente de IA
- Chat lateral que entiende pedidos en lenguaje natural y ejecuta acciones sobre el sistema (ver detalle en [Asistente de IA](#asistente-de-ia)).
- Sugerencia de notas de sesión, resumen de sesiones, sugerencia de derivación y análisis de PDFs adjuntos.

### Otros
- PWA instalable (vite-plugin-pwa).
- Registro de auditoría de accesos a historias clínicas (Ley 25.326 de Protección de Datos Personales).

---

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| Frontend | React 18, Vite, React Router, TanStack Query, Zustand, React Hook Form, Tailwind CSS, FullCalendar, jsPDF, Sonner, Lucide |
| Backend | Node.js (≥ 18), Express, express-validator, Helmet, express-rate-limit, Morgan |
| Base de datos / Auth / Storage | Supabase (PostgreSQL con Row Level Security) |
| IA | OpenRouter (API compatible con OpenAI) con modelos gratuitos; `pdf-parse` para extraer texto de PDFs |
| Tests | Jest + Supertest |
| CI | GitHub Actions |

---

## Estructura del proyecto

```
MentesQueAprenden/
├── package.json              # Monorepo (npm workspaces): scripts para correr todo junto
├── .github/workflows/        # CI: corre los tests del backend en cada push/PR a master
├── client/                   # Frontend React + Vite
│   └── src/
│       ├── components/       # auth/, chat/, layout/, ui/ (asistente IA, modales, uploads…)
│       ├── pages/            # Inicio, Pacientes, Agenda, Sesiones, Evaluaciones,
│       │                     # Derivaciones, Pagos, Admin
│       ├── services/api.js   # Cliente HTTP hacia el backend
│       ├── store/            # Estado de autenticación (Zustand)
│       └── utils/            # Exportación de informes a PDF
└── server/                   # Backend Express
    ├── migrations/           # Esquema SQL y políticas RLS (001 → 007)
    ├── __tests__/            # Tests de seguridad, validación, IA y end-to-end
    └── src/
        ├── server.js         # Punto de entrada (levanta el servidor)
        ├── index.js          # App Express: middlewares, rate limiting, rutas
        ├── config/           # Clientes de Supabase (anon y service role)
        ├── middleware/       # Autenticación JWT, roles, auditoría de accesos
        ├── routes/           # Endpoints REST (validación de entrada)
        └── services/         # Lógica de negocio y acceso a datos, IA
```

---

## Puesta en marcha

### Requisitos
- Node.js 18 o superior
- Un proyecto de [Supabase](https://supabase.com)
- Una API key de [OpenRouter](https://openrouter.ai) (para las funciones de IA)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/stefanpepa/mentesQueAprenden.git
cd mentesQueAprenden

# 2. Instalar dependencias (raíz, server y client vía workspaces)
npm install

# 3. Configurar variables de entorno
cp server/.env.example server/.env
cp client/.env.example client/.env
# …y completar los valores (ver sección siguiente)

# 4. Crear la base de datos: ejecutar en orden, en el SQL Editor de Supabase,
#    los archivos server/migrations/001_*.sql a 007_*.sql

# 5. Crear en Supabase Storage un bucket privado llamado "historias-clinicas"

# 6. Levantar backend y frontend juntos
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001 (health check en `/health`)

### Scripts disponibles

| Comando (desde la raíz) | Qué hace |
|---|---|
| `npm run dev` | Levanta server y client en paralelo |
| `npm run dev:server` | Solo el backend (nodemon) |
| `npm run dev:client` | Solo el frontend (Vite) |
| `npm run build:client` | Build de producción del frontend |
| `npm test --prefix server` | Corre los tests del backend |

---

## Variables de entorno

Los archivos `.env` **no se suben al repositorio** (están en `.gitignore`). Usá los `.env.example` como plantilla.

### `server/.env`

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend (default `3001`) |
| `NODE_ENV` | `development`, `production` o `test` |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | Clave pública (anon) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase — **secreta, nunca exponer en el frontend** |
| `SUPABASE_JWT_SECRET` | JWT secret del proyecto de Supabase |
| `OPENROUTER_API_KEY` | API key de OpenRouter para las funciones de IA |
| `FRONTEND_URL` | Origen permitido por CORS (default `http://localhost:5173`) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Ventana y máximo de requests del rate limiting global |

### `client/.env`

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base de la API (ej. `http://localhost:3001/api`) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Datos públicos del proyecto de Supabase |

---

## Base de datos

El esquema vive en `server/migrations/` y se aplica en orden:

| Migración | Contenido |
|---|---|
| `001_initial_schema.sql` | Tablas principales: `profesionales`, `obras_sociales`, `pacientes`, `sesiones`, `versiones_notas`, `derivaciones`, `turnos`, `archivos_adjuntos`, `pagos`, `logs_acceso`, `configuracion_espacio` |
| `002_rls_policies.sql` | Políticas de Row Level Security |
| `003_evaluaciones.sql` | Tablas `evaluaciones` y `pruebas_aplicadas` |
| `004_pacientes_privados.sql` | Cada profesional ve solo sus pacientes (+ los derivados) |
| `005_derivacion_solo_aceptada.sql` | El acceso por derivación requiere que esté aceptada |
| `006_fix_pacientes_update_check.sql` | Corrección de la política de actualización de pacientes |
| `007_consultorios.sql` | Consultorios compartidos y trigger anti-superposición de turnos |

---

## API REST

Todas las rutas están bajo `/api` y (salvo registro/login/recuperación) requieren `Authorization: Bearer <token de Supabase>`.

| Recurso | Endpoints principales |
|---|---|
| `/auth` | `POST /register`, `POST /signup`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /refresh`, `GET /me`, `PATCH /change-password` |
| `/pacientes` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `GET /:id/sesiones`, `/turnos`, `/derivaciones`, `/archivos` |
| `/turnos` | `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `/sesiones` | `GET /:id`, `POST /`, `PATCH /:id`, `GET /:id/versiones` |
| `/evaluaciones` | `GET /:id`, `POST /`, `PATCH /:id`, `GET /paciente/:pacienteId`, `POST /:id/pruebas`, `PATCH /pruebas/:pruebaId`, `DELETE /pruebas/:pruebaId`, `POST /:id/generar-informe` |
| `/derivaciones` | `GET /`, `GET /pendientes`, `POST /`, `PATCH /:id/responder`, `PATCH /:id/completar` |
| `/archivos` | `POST /upload-url`, `GET /:id/download-url`, `DELETE /:id` |
| `/pagos` | `GET /`, `GET /sesiones-pendientes`, `POST /`, `GET /liquidacion` (admin) |
| `/profesionales` | `GET /`, `PATCH /:id`, `DELETE /:id` (admin) |
| `/obras-sociales` | `GET /` |
| `/ia` | `POST /chat`, `POST /sugerir-notas`, `POST /resumir-sesion`, `POST /sugerir-derivacion`, `POST /analizar-pdf` |

---

## Asistente de IA

El chat (`POST /api/ia/chat`) usa modelos gratuitos de OpenRouter con *function calling* manual: el modelo responde con una acción en JSON, el backend la ejecuta y le devuelve el resultado para que redacte la respuesta. Acciones disponibles:

- **Consultas:** listar mis pacientes, buscar pacientes, ver un paciente, ver la agenda (un día o un rango), listar sesiones futuras y pasadas (incluye turnos pasados sin sesión cargada), listar profesionales.
- **Formularios:** abrir el formulario de nuevo paciente o de nuevo turno prellenado a partir del pedido.
- **Acciones:** registrar una sesión; dar de baja un paciente (siempre pide confirmación explícita antes).

Las consultas del chat se ejecutan con el cliente autenticado del profesional, así que respetan las mismas reglas de acceso (RLS) que el resto de la app. Las fechas se manejan en hora argentina (`America/Argentina/Buenos_Aires`).

Otras funciones de IA:
- **Informes de evaluación:** redacta el informe a partir de los datos cargados, sin inventar resultados.
- **Análisis de PDFs:** extrae el texto localmente con `pdf-parse`; si el PDF es escaneado, usa un modelo con soporte de documentos como OCR de respaldo.
- **Notas, resúmenes y sugerencias de derivación** para sesiones.

Como los modelos `:free` de OpenRouter comparten capacidad entre todos sus usuarios, a veces se saturan; el backend detecta esos errores, reintenta y muestra un mensaje claro al usuario.

---

## Seguridad y privacidad

- Autenticación con JWT de Supabase verificada en cada request.
- **Row Level Security** en PostgreSQL como segunda capa de control de acceso.
- Aislamiento de pacientes entre profesionales (verificado por tests).
- Helmet, CORS restringido al frontend, límite de tamaño de body y rate limiting (más estricto en `/auth`, contando solo intentos fallidos).
- Auditoría de accesos a historias clínicas en `logs_acceso`.
- Archivos clínicos en un bucket privado, accesibles solo por URLs firmadas que vencen a los 5 minutos.
- En `NODE_ENV=development` existe un token `dev-token` que autentica como el primer admin activo, pensado solo para desarrollo local; está bloqueado en cualquier otro entorno.

---

## Tests y CI

```bash
npm test --prefix server
```

Los tests (Jest + Supertest) corren contra un proyecto real de Supabase, por lo que necesitan las variables de `server/.env`:

| Carpeta | Qué verifica |
|---|---|
| `__tests__/seguridad` | Un profesional no puede ver ni modificar pacientes de otro |
| `__tests__/validacion` | Validación de datos de entrada de pacientes |
| `__tests__/ia` | Que la IA no invente datos y que las tools del chat devuelvan lo correcto |
| `__tests__/e2e` | Flujo completo de un paciente de punta a punta |

GitHub Actions (`.github/workflows/tests.yml`) corre la suite en cada push y pull request a `master`. Las credenciales se configuran como *secrets* del repositorio: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `OPENROUTER_API_KEY`.
