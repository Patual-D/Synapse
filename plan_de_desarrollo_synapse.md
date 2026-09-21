# SYSTEM MASTER PLAN: PROYECTO "SYNAPSE"
**Target Audience:** AI Development Agent (Dev Agent)
**Project Name:** Synapse (Sistema de Gestión de Recursos Organizacionales)
**Objective:** Desarrollar un sistema web basado en microservicios para gestionar recursos materiales, financieros y tecnológicos de una organización.

---

## 1. ESPECIFICACIONES ARQUITECTÓNICAS (TECH STACK)
Deberás inicializar y construir el proyecto utilizando las siguientes tecnologías dictadas por el diseño del sistema:
*   **Frontend:** React (SPA, Hooks, Context API / Redux para manejo de estado).
*   **Backend:** Node.js con Express (Arquitectura orientada a microservicios/módulos).
*   **Base de Datos:** MySQL (Relacional). ORM recomendado: Sequelize o Prisma.
*   **Infraestructura:** AWS (EC2 para contenedores Docker, S3 para almacenamiento de archivos).
*   **Testing:** Jest (y Supertest para endpoints).
*   **CI/CD:** GitHub Actions.

---

## 2. REQUISITOS OBLIGATORIOS (CRITICAL CONSTRAINTS)
Al desarrollar el código, debes garantizar obligatoriamente la implementación del siguiente módulo base con estas características:
1.  **Módulo de Gestión y Registro (Usuarios/Roles):** 
    *   Implementar autenticación mediante **JWT (JSON Web Tokens)**.
    *   Implementar asignación y validación de roles (`ADMIN`, `USER`). El acceso a ciertas rutas del backend y frontend debe estar protegido por middleware según el rol.
2.  **Pruebas Unitarias (Testing):**
    *   Cobertura de código (**Coverage**) de este módulo debe ser **>= 80%**.
    *   Utilizar **Jest**. Generar el reporte de cobertura (`jest --coverage`).
3.  **Pipeline CI/CD:**
    *   Crear un archivo `.github/workflows/deploy.yml` para integración y entrega continuas.
    *   El pipeline debe ejecutar las pruebas unitarias y, si pasan, construir la imagen Docker y simular el despliegue automático en un entorno de pruebas (Staging).

---

## 3. MODELO DE DATOS Y BASE DE DATOS (MYSQL)
Deberás crear las siguientes entidades principales en la base de datos relacional:

*   **Users (Usuarios):** `id`, `nombre`, `email`, `password_hash`, `role` (Enum: admin, user), `created_at`.
*   **Assets (Inventario):** `id`, `nombre`, `tipo`, `estado` (disponible, en_uso, mantenimiento), `ubicacion`, `responsable_id` (FK a Users).
*   **Reservations (Reservas):** `id`, `asset_id` (FK a Assets), `user_id` (FK a Users), `fecha_inicio`, `fecha_fin`, `estado_aprobacion`.
*   **MaintenanceLogs (Mantenimiento):** `id`, `asset_id` (FK a Assets), `descripcion`, `fecha_reporte`, `estado_reparacion`.

---

## 4. FASES DE DESARROLLO Y TAREAS PARA EL AGENTE IA

### FASE 1: Inicialización y CI/CD (Setup)
**Instrucciones para el Agente:**
1.  Inicializar el repositorio Node.js (`npm init -y`).
2.  Configurar la estructura de carpetas: `/frontend`, `/backend`, `/.github/workflows`.
3.  **Crear el Pipeline (Requisito Crítico):**
    *   Ruta: `.github/workflows/ci-cd.yml`
    *   *Steps:* Checkout code -> Setup Node.js -> Install dependencies -> Run Tests (`npm run test:coverage`) -> Build Docker Image -> Push/Deploy to staging environment.

### FASE 2: Módulo Base y Autenticación (Cumplimiento de Constraints)
**Instrucciones para el Agente:**
1.  Desarrollar `auth.controller.js` y `auth.routes.js`.
2.  Implementar registro de usuarios (`/api/auth/register`) con encriptación de contraseña (bcrypt).
3.  Implementar login (`/api/auth/login`) que devuelva un JWT con el payload del `id` y `rol`.
4.  Crear middleware `verifyToken` y `isAdmin`.
5.  **Desarrollo de Pruebas (Requisito Crítico):**
    *   Crear `/tests/auth.test.js` usando Jest y Supertest.
    *   Escribir pruebas para: Registro exitoso, login exitoso, login fallido, acceso denegado sin token, acceso denegado sin rol de admin.
    *   Asegurar y configurar `jest.config.js` para exigir 80% de cobertura en *statements, branches, functions, y lines*.

### FASE 3: Desarrollo de Microservicios (Backend API)
**Instrucciones para el Agente:**
Implementar las siguientes APIs bajo los principios REST:
1.  **Gestor de Inventario:**
    *   `GET /api/assets`: Listar activos con filtros (tipo, estado).
    *   `POST /api/assets`: Crear activo (Solo ADMIN).
2.  **Sistema de Reservas:**
    *   `POST /api/reservations`: Crear reserva comprobando cruces de fechas.
    *   `GET /api/reservations`: Calendario de disponibilidad.
3.  **Notificaciones y Mantenimiento:**
    *   `POST /api/maintenance`: Reportar falla de equipo.
    *   Implementar un sistema de eventos (Node.js EventEmitter o similar) para generar alertas automáticas al personal de soporte cuando se registre una falla.

### FASE 4: Interfaz de Usuario (Frontend React)
**Instrucciones para el Agente:**
1.  Configurar enrutamiento con `react-router-dom`.
2.  Desarrollar el contexto de Autenticación (`AuthContext`) para guardar el JWT en memoria/local storage y manejar sesiones.
3.  Crear Vistas principales:
    *   **Login/Dashboard:** Redirección basada en rol.
    *   **Catálogo de Recursos:** Vista con filtros y botón de "Reservar".
    *   **Calendario Interactivo:** Integrar librería de calendario (ej. `react-big-calendar`) para visualizar disponibilidades.
    *   **Panel de Administración:** Gráficos (ej. `recharts`) mostrando índices de uso y activos en reparación.

### FASE 5: Contenerización y Despliegue
**Instrucciones para el Agente:**
1.  Crear `Dockerfile` para el Backend y `Dockerfile` para el Frontend (usando Nginx).
2.  Crear `docker-compose.yml` para orquestar los servicios junto con la base de datos MySQL.
3.  Asegurar que todas las variables de entorno (JWT_SECRET, DB_HOST, AWS_ACCESS_KEY) estén externalizadas y listas para ser inyectadas en AWS EC2.

---

## 5. REGLAS ESTRICTAS DE CODIFICACIÓN PARA LA IA
1.  **No mockear bases de datos en producción:** Todo debe conectar al ORM establecido.
2.  **Seguridad:** Encriptar contraseñas. Retornar solo el estado 401/403 en errores de autenticación, sin exponer el stack trace.
3.  **Performance:** Asegurar paginación en endpoints que devuelvan listas (ej. recursos, usuarios).
4.  **Tiempos de Respuesta:** Mantener consultas a BD optimizadas con índices (ej. índice por `fecha_inicio` y `fecha_fin` en reservas) para cumplir la regla no funcional de carga < 5 segundos.