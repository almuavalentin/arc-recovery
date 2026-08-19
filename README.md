ARC Recovery

Aplicación full-stack instalable en el celular que digitaliza la coordinación entre jugadores y kinesiólogo: solicitud de recovery, armado de sesiones, asignación de turnos en tiempo real y generación automática de mensajes para el grupo.

Features

-Autenticación propia por DNI + PIN de 4 dígitos, sin dependencias externas de auth.
-Solicitud de recovery por parte del jugador, con comentario opcional (ej. molestias físicas).
-Panel de administración para el kinesiólogo: creación de sesiones, selección de material disponible (hielo / sauna / botas de compresión), convocatoria de jugadores con búsqueda por nombre o DNI y prioridad visual para quienes solicitaron recovery.
-Cálculo automático de capacidad: la app calcula cuántos jugadores entran en una ventana horaria según la duración del circuito (5' hielo + 5' sauna + 5' botas, con ingreso escalonado cada 5 minutos).
-Elección de turno en tiempo real: los jugadores eligen su horario dentro del circuito y ven el estado del grupo actualizarse en vivo (Supabase Realtime), incluyendo manejo de condiciones de carrera cuando dos personas eligen el mismo horario.
-Gestión de bajas: un jugador puede avisar que no asiste, liberando su lugar; el kinesiólogo puede readmitirlo desde el panel.
-Generación automática de mensajes listos para reenviar por WhatsApp (convocatoria inicial y horarios finales confirmados).
-PWA instalable: se agrega a la pantalla de inicio del celular como una app nativa.

Stack tecnológico

Framework	Next.js 14 (App Router)
UI	React 18 + TypeScript (modo estricto)
Estilos	Tailwind CSS con theming de marca custom
Backend / DB	Supabase (PostgreSQL + API autogenerada + Realtime)
Auth	Sistema propio (DNI + PIN), hash SHA-256 vía Web Crypto API
Hosting	Vercel
PWA	Web App Manifest, instalación en pantalla de inicio
