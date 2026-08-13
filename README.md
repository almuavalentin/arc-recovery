# ARC Recovery

App web (instalable como PWA en el celular) para gestionar las solicitudes y
turnos de la sala de recovery del equipo.

## Qué incluye este MVP

- Registro/login de jugadores con nombre + PIN de 4 dígitos.
- Botón "Solicitar recovery" con comentario opcional.
- Panel de admin/kinesiólogo para crear sesiones (fecha, hora, material
  disponible) y convocar jugadores, con búsqueda y prioridad visual para
  quienes solicitaron recovery.
- Generación automática del mensaje para reenviar (WhatsApp, lo que sea) con
  las indicaciones y la lista de convocados.
- Los jugadores eligen su horario dentro del circuito (5' hielo + 5' sauna +
  5' botas, con entrada de un jugador nuevo cada 5 minutos).

No incluido en este MVP (para agregar después si hace falta): notificaciones
push automáticas, recuperación de PIN olvidado, edición/cancelación de
sesiones ya creadas, reglas automáticas para "llegadas tarde" (según lo que
charlamos, esto se maneja a mano en la sala).

## 1. Crear el backend (Supabase) — 5 minutos

1. Andá a https://supabase.com, creá una cuenta gratis y un proyecto nuevo.
2. En el proyecto, abrí **SQL Editor** → **New query**, pegá el contenido de
   `supabase/schema.sql` y ejecutalo. Esto crea todas las tablas.
3. En **Project Settings → API**, copiá el `Project URL` y el `anon public key`.
4. Creá un archivo `.env.local` en la raíz del proyecto (basado en
   `.env.example`) y pegá esos dos valores.
5. Creá el primer usuario admin manualmente. En el SQL Editor, corré (reemplazando
   nombre y PIN, el hash se genera con SHA-256 del PIN — más fácil: registrate
   primero como jugador desde la app con tu usuario, y después corré):

   ```sql
   update users set rol = 'admin' where nombre = 'Tu Nombre';
   ```

## 2. Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:3000 en el celular (misma red wifi que tu compu, o usando
el IP de tu compu) para probarlo como si fuera una app.

## 3. Desplegar gratis (para que el equipo lo use de verdad)

1. Subí este proyecto a un repositorio de GitHub.
2. Andá a https://vercel.com, conectá tu cuenta de GitHub e importá el repo.
3. En la configuración del proyecto en Vercel, agregá las mismas variables de
   entorno (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. Vercel te da una URL pública (ej: `arc-recovery.vercel.app`).
5. Compartí esa URL con el equipo. Desde el celular, en Chrome/Safari pueden
   tocar "Agregar a pantalla de inicio" y les queda como un ícono de app.

## Notas de seguridad (léelo antes de usarlo con el equipo)

Este MVP prioriza velocidad sobre robustez, como charlamos:

- El PIN se hashea (SHA-256) pero no hay límite de intentos ni bloqueo de
  cuenta — suficiente para uso interno de un equipo, no para exponerlo
  masivamente.
- No se configuraron políticas de Row Level Security (RLS) en Supabase, así
  que cualquiera con la `anon key` (pública en el código del front) puede
  leer/escribir en las tablas vía API. Para un grupo cerrado de confianza está
  bien; si más adelante querés más seguridad, es la primera mejora a hacer.
