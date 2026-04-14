-- ── Reset ────────────────────────────────────────────────────────────────────

drop table if exists tickets cascade;
drop table if exists usuarios cascade;
drop table if exists planes cascade;
drop function if exists update_actualizado_en cascade;

-- ── Planes de suscripción ────────────────────────────────────────────────────

create table planes (
  id                 text        primary key,
  nombre             text        not null,
  precio_mensual     numeric(10,2) not null,
  limite_usuarios    integer,                         -- null = ilimitado
  soporte_prioritario boolean   not null default false,
  sla_horas          integer    not null              -- tiempo máx. de respuesta prometido
);

-- ── Usuarios / cuentas del SaaS ──────────────────────────────────────────────

create table usuarios (
  id          uuid        primary key default gen_random_uuid(),
  nombre      text        not null,
  email       text        not null unique,
  empresa     text,
  plan_id     text        not null references planes(id) default 'free',
  activo      boolean     not null default true,
  creado_en   timestamptz not null default now()
);

-- ── Tickets de soporte ───────────────────────────────────────────────────────

create table tickets (
  id             uuid        primary key default gen_random_uuid(),
  usuario_id     uuid        not null references usuarios(id),
  titulo         text        not null,
  descripcion    text        not null,
  categoria      text        not null check (categoria in ('bug','consulta','facturacion','acceso','otro')),
  prioridad      text        not null default 'media' check (prioridad in ('baja','media','alta','critica')),
  estado         text        not null default 'abierto' check (estado in ('abierto','en_progreso','resuelto','cerrado')),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function update_actualizado_en()
returns trigger as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$ language plpgsql;

create trigger tickets_actualizado_en
  before update on tickets
  for each row execute function update_actualizado_en();
