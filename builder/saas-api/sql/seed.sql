-- ── Planes ───────────────────────────────────────────────────────────────────

insert into planes (id, nombre, precio_mensual, limite_usuarios, soporte_prioritario, sla_horas) values
  ('free',       'Free',       0,    5,    false, 72),
  ('pro',        'Pro',        49,   50,   false, 24),
  ('enterprise', 'Enterprise', 299,  null, true,  4);

-- ── Usuarios de prueba ───────────────────────────────────────────────────────

insert into usuarios (id, nombre, email, empresa, plan_id) values
  ('11111111-1111-1111-1111-111111111111', 'Ana García',    'ana@acme.com',     'Acme Corp',  'pro'),
  ('22222222-2222-2222-2222-222222222222', 'Pedro López',   'pedro@startup.io', 'Startup IO', 'free'),
  ('33333333-3333-3333-3333-333333333333', 'Laura Martínez','laura@bigco.com',  'Big Co',     'enterprise');

-- ── Tickets de prueba ────────────────────────────────────────────────────────

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
