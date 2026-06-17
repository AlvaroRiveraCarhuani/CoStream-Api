# CoStream API

**CoStream** es una plataforma profesional de transmisión, diseñada para facilitar sesiones de *live coding*, defensas de proyectos y revisiones de arquitectura técnica en tiempo real. 

Este repositorio contiene la lógica del servidor (Backend), la API REST, y los WebSockets de orquestación desarrollados con **NestJS**.

## Arquitectura y Tecnologías

- **Framework:** NestJS 11 (Node.js con TypeScript)
- **Base de Datos:** PostgreSQL
- **ORM:** Prisma 7
- **WebRTC & Streaming:** LiveKit Server SDK (v2.15+)
- **Tiempo Real (Señalización/Chat):** Socket.io (v4.8+)
- **Autenticación:** JWT (JSON Web Tokens)

## Responsabilidades del Backend

- **Orquestación de Salas:** Creación, validación (códigos PIN) y cierre de salas de reuniones/transmisión.
- **Gestión de WebRTC (LiveKit):** 
  - Emisión de Access Tokens firmados y seguros para que el frontend pueda conectarse a LiveKit.
  - Recepción de Webhooks (eventos) desde los servidores de LiveKit para sincronizar el estado en la base de datos.
- **Sockets en Tiempo Real:** Emisión de eventos globales usando `Socket.io` para actualizar el historial del chat, manejar las entradas/salidas de participantes y notificar expulsiones o cambios forzados de hardware a clientes específicos.
- **Base de datos relacional:** Administración de la persistencia (Usuarios, Salas, Mensajes) mediante el esquema de Prisma.

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/AlvaroRiveraCarhuani/CoStream-Api.git
cd CoStream-Api
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto basándote en el entorno que necesitas:

```env
# Base de Datos (Prisma)
DATABASE_URL="postgresql://usuario:password@localhost:5432/costream?schema=public"

# Seguridad
JWT_SECRET="tu_super_secreto_jwt"

# LiveKit (Keys & URL)
LIVEKIT_API_KEY="tu_api_key_de_livekit"
LIVEKIT_API_SECRET="tu_api_secret_de_livekit"
LIVEKIT_HOST="wss://tu-instancia.livekit.cloud"
```

### 4. Generar el Cliente de Prisma y Migrar la DB
Asegúrate de que tu servidor de base de datos PostgreSQL esté corriendo, luego ejecuta:
```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Iniciar el Servidor
```bash
# Modo de desarrollo
npm run start

# Modo de desarrollo con recarga automática (Watch mode)
npm run start:dev

# Modo producción
npm run start:prod
```

## Pruebas y Tests

Para ejecutar la suite de pruebas unitarias o e2e integradas (Jest):
```bash
npm run test
npm run test:e2e
npm run test:cov
```

## Licencia

Este proyecto es propiedad de sus creadores y está restringido a los términos y condiciones especificados por el equipo de CoStream.
