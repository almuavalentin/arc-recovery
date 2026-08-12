-- ============================================
-- ARC Recovery - Schema de base de datos
-- Ejecutar en Supabase: SQL Editor > New query
-- ============================================

create extension if not exists "pgcrypto";

-- Usuarios (jugadores y admins/kinesiologos)
create table users (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pin_hash text not null,          -- PIN de 4 digitos, hasheado
  rol text not null default 'jugador' check (rol in ('jugador', 'admin')),
  posicion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Solicitudes de recovery hechas por jugadores
create table recovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  comentario text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'atendida')),
  created_at timestamptz not null default now()
);

-- Sesiones de recovery creadas por el admin/kinesiologo
create table sessions (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora_inicio time not null,
  hora_fin time not null,          -- se calcula segun cantidad de jugadores (5 min por jugador)
  hielo boolean not null default true,
  sauna boolean not null default true,
  botas boolean not null default true,
  mensaje text,                    -- mensaje generado para reenviar a los jugadores
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- Jugadores seleccionados/convocados para una sesion
create table session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  prioridad boolean not null default false,   -- true si tenia solicitud pendiente al momento de crear la sesion
  slot_index int,                             -- orden dentro del circuito (0,1,2,3... = cada uno inicia 5 min despues del anterior)
  hora_asignada time,                         -- calculada: hora_inicio + slot_index * 5 min
  confirmado boolean not null default false,  -- true cuando el jugador elige su horario
  unique (session_id, user_id)
);

create index idx_session_players_session on session_players(session_id);
create index idx_recovery_requests_estado on recovery_requests(estado);

-- Nota MVP: por simplicidad no se configuraron políticas RLS estrictas.
-- Si vas a exponer esto públicamente en producción, conviene agregar
-- Row Level Security antes de compartir la app con todo el plantel.
