-- =============================================================================
-- schema-demos.sql
-- Tablas de demo para los 6 arquetipos de bots
--
-- Convención de prefijos:
--   a2_ = Arquetipo 2: Clínica Turnos
--   a3_ = Arquetipo 3: Inmobiliaria Ventas
--   a4_ = Arquetipo 4: Ecommerce Soporte
--   a5_ = Arquetipo 5: Asistente Interno LogiCorp
--   a6_ = Arquetipo 6: Fintech CuentaYa
--
-- Ejecutar en el editor SQL de Supabase o con psql.
-- Arquetipo 1 (FAQ Restaurante) no necesita tablas — solo system prompt.
-- =============================================================================

-- =============================================================================
-- ARQUETIPO 2 — Clínica Turnos
-- =============================================================================

create table if not exists a2_especialidades (
  id          text primary key,
  nombre      text not null,
  descripcion text
);

create table if not exists a2_medicos (
  id              text primary key,
  nombre          text not null,
  especialidad_id text not null references a2_especialidades(id),
  activo          boolean not null default true
);

create table if not exists a2_turnos (
  id              uuid primary key default gen_random_uuid(),
  especialidad_id text not null references a2_especialidades(id),
  medico_id       text not null references a2_medicos(id),
  fecha           date not null,
  hora            text not null,          -- "09:00", "10:30", etc.
  disponible      boolean not null default true,
  paciente_nombre text,
  creado_en       timestamptz not null default now()
);

-- =============================================================================
-- ARQUETIPO 3 — Inmobiliaria Ventas
-- =============================================================================

create table if not exists a3_propiedades (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,              -- 'departamento' | 'casa' | 'local' | 'ph'
  zona        text not null,
  precio      numeric(12,2) not null,
  m2          integer not null,
  ambientes   integer not null,
  descripcion text,
  disponible  boolean not null default true
);

create table if not exists a3_leads (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  email       text not null,
  telefono    text,
  interes     text,
  presupuesto numeric(12,2),
  score       integer not null default 0,  -- 0-100
  creado_en   timestamptz not null default now()
);

-- =============================================================================
-- ARQUETIPO 4 — Ecommerce Soporte
-- =============================================================================

create table if not exists a4_pedidos (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text not null unique,    -- "TM-00123"
  cliente_nombre         text not null,
  cliente_email          text not null,
  estado                 text not null check (estado in ('preparando','en_camino','entregado','cancelado')),
  items                  jsonb not null,           -- [{ nombre, qty, precio }]
  total                  numeric(10,2) not null,
  fecha_compra           timestamptz not null default now(),
  fecha_estimada_entrega date
);

create table if not exists a4_devoluciones (
  id            uuid primary key default gen_random_uuid(),
  pedido_numero text not null references a4_pedidos(numero),
  motivo        text not null,
  estado        text not null default 'iniciada'
    check (estado in ('iniciada','en_proceso','acreditada','rechazada')),
  creado_en     timestamptz not null default now()
);

create table if not exists a4_escalados (
  id        uuid primary key default gen_random_uuid(),
  resumen   text not null,
  prioridad text not null check (prioridad in ('baja','media','alta','critica')),
  estado    text not null default 'abierto',
  creado_en timestamptz not null default now()
);

-- =============================================================================
-- ARQUETIPO 5 — Asistente Interno LogiCorp
-- =============================================================================

create table if not exists a5_politicas (
  id             uuid primary key default gen_random_uuid(),
  tema           text not null,
  contenido      text not null,
  version        text not null default '1.0',
  actualizada_en timestamptz not null default now()
);

create table if not exists a5_procedimientos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  pasos           jsonb not null,          -- ["Paso 1: ...", "Paso 2: ..."]
  responsable     text not null,
  tiempo_estimado text not null
);

create table if not exists a5_consultas_pendientes (
  id          uuid primary key default gen_random_uuid(),
  pregunta    text not null,
  empleado_id text not null,
  respondida  boolean not null default false,
  creado_en   timestamptz not null default now()
);

-- =============================================================================
-- ARQUETIPO 6 — Fintech CuentaYa
-- =============================================================================

create table if not exists a6_usuarios (
  id     text primary key,                -- alias legible, ej: "mario.garcia"
  nombre text not null,
  alias  text not null unique,
  cvu    text not null unique,
  saldo  numeric(12,2) not null default 0,
  pin    text not null,                   -- PIN de 4 dígitos (solo demo, no producción)
  activo boolean not null default true
);

create table if not exists a6_movimientos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  text not null references a6_usuarios(id),
  tipo        text not null check (tipo in ('credito','debito')),
  monto       numeric(12,2) not null,
  descripcion text not null,
  creado_en   timestamptz not null default now()
);

create table if not exists a6_operaciones (
  id            uuid primary key default gen_random_uuid(),
  origen_id     text not null references a6_usuarios(id),
  destino_alias text not null,
  monto         numeric(12,2) not null,
  estado        text not null default 'pendiente'
    check (estado in ('pendiente','acreditada','rechazada')),
  creado_en     timestamptz not null default now()
);
