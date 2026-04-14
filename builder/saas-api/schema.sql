-- Ejecutar en Supabase SQL Editor

-- Planes de suscripción
create table planes (
  id text primary key,           -- 'free' | 'pro' | 'enterprise'
  nombre text not null,
  precio_mensual numeric(10,2) not null,
  limite_usuarios integer,       -- null = ilimitado
  soporte_prioritario boolean not null default false,
  sla_horas integer not null     -- tiempo máximo de respuesta prometido
);

insert into planes values
  ('free',       'Free',       0,      5,    false, 72),
  ('pro',        'Pro',        49,     50,   false, 24),
  ('enterprise', 'Enterprise', 299,    null, true,  4);

-- Usuarios / cuentas del SaaS
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null unique,
  empresa text,
  plan_id text not null references planes(id) default 'free',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Tickets de soporte
create table tickets (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id),
  titulo text not null,
  descripcion text not null,
  categoria text not null check (categoria in ('bug', 'consulta', 'facturacion', 'acceso', 'otro')),
  prioridad text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'critica')),
  estado text not null default 'abierto' check (estado in ('abierto', 'en_progreso', 'resuelto', 'cerrado')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Trigger para actualizar actualizado_en automáticamente
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

-- Datos de prueba
insert into usuarios (id, nombre, email, empresa, plan_id) values
  ('11111111-1111-1111-1111-111111111111', 'Ana García',   'ana@acme.com',    'Acme Corp',    'pro'),
  ('22222222-2222-2222-2222-222222222222', 'Pedro López',  'pedro@startup.io', 'Startup IO',   'free'),
  ('33333333-3333-3333-3333-333333333333', 'Laura Martínez','laura@bigco.com', 'Big Co',       'enterprise');

insert into tickets (usuario_id, titulo, descripcion, categoria, prioridad, estado) values
  ('11111111-1111-1111-1111-111111111111',
   'No puedo exportar reportes en PDF',
   'Cuando hago click en "Exportar PDF" aparece un error 500. Pasa desde ayer a las 14hs.',
   'bug', 'alta', 'en_progreso'),
  ('11111111-1111-1111-1111-111111111111',
   'Consulta sobre límite de usuarios',
   '¿Cuántos usuarios puedo agregar en el plan Pro?',
   'consulta', 'baja', 'resuelto'),
  ('22222222-2222-2222-2222-222222222222',
   'No recibo el mail de bienvenida',
   'Me registré hace 2 horas y no llegó el mail de bienvenida ni al spam.',
   'acceso', 'media', 'abierto'),
  ('33333333-3333-3333-3333-333333333333',
   'Error al procesar pago',
   'La renovación automática falló. Tarjeta vigente, ya verificado con el banco.',
   'facturacion', 'critica', 'abierto');
