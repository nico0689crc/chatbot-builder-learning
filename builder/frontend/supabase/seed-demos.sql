-- =============================================================================
-- seed-demos.sql
-- Datos de demo para los 6 arquetipos de bots
--
-- Ejecutar DESPUÉS de schema-demos.sql.
-- Arquetipo 1 (FAQ Restaurante) no necesita datos — todo está en el system prompt.
-- =============================================================================

-- =============================================================================
-- ARQUETIPO 2 — Clínica Turnos
-- =============================================================================

insert into a2_especialidades (id, nombre, descripcion) values
  ('cardiologia',    'Cardiología',     'Diagnóstico y tratamiento de enfermedades del corazón'),
  ('pediatria',      'Pediatría',       'Atención médica de niños y adolescentes'),
  ('clinica',        'Clínica General', 'Consultas generales y derivaciones'),
  ('traumatologia',  'Traumatología',   'Lesiones del sistema músculo-esquelético')
on conflict (id) do nothing;

insert into a2_medicos (id, nombre, especialidad_id) values
  ('med-001', 'Dr. Carlos Ramírez',  'cardiologia'),
  ('med-002', 'Dra. Laura Gómez',    'cardiologia'),
  ('med-003', 'Dr. Martín Torres',   'pediatria'),
  ('med-004', 'Dra. Sofía Herrera',  'clinica'),
  ('med-005', 'Dr. Pablo Vega',      'traumatologia')
on conflict (id) do nothing;

-- Turnos para los próximos 7 días (mezcla de disponibles y ocupados)
-- Usamos fechas relativas con now() + interval para que siempre sean futuras
insert into a2_turnos (especialidad_id, medico_id, fecha, hora, disponible, paciente_nombre) values
  -- Cardiología mañana
  ('cardiologia', 'med-001', current_date + 1, '09:00', true,  null),
  ('cardiologia', 'med-001', current_date + 1, '09:30', false, 'Marta Suárez'),
  ('cardiologia', 'med-001', current_date + 1, '10:00', true,  null),
  ('cardiologia', 'med-002', current_date + 1, '11:00', true,  null),
  ('cardiologia', 'med-002', current_date + 1, '11:30', false, 'Jorge Pérez'),
  -- Cardiología pasado mañana
  ('cardiologia', 'med-001', current_date + 2, '09:00', true,  null),
  ('cardiologia', 'med-001', current_date + 2, '10:00', true,  null),
  ('cardiologia', 'med-002', current_date + 2, '14:00', true,  null),
  -- Pediatría
  ('pediatria', 'med-003', current_date + 1, '08:30', true,  null),
  ('pediatria', 'med-003', current_date + 1, '09:00', true,  null),
  ('pediatria', 'med-003', current_date + 1, '09:30', false, 'Ana García'),
  ('pediatria', 'med-003', current_date + 2, '08:30', true,  null),
  ('pediatria', 'med-003', current_date + 3, '10:00', true,  null),
  -- Clínica General
  ('clinica', 'med-004', current_date + 1, '08:00', true,  null),
  ('clinica', 'med-004', current_date + 1, '08:30', true,  null),
  ('clinica', 'med-004', current_date + 1, '09:00', false, 'Luis Fernández'),
  ('clinica', 'med-004', current_date + 2, '08:00', true,  null),
  -- Traumatología
  ('traumatologia', 'med-005', current_date + 2, '10:00', true, null),
  ('traumatologia', 'med-005', current_date + 2, '10:30', true, null),
  ('traumatologia', 'med-005', current_date + 3, '09:00', true, null);

-- =============================================================================
-- ARQUETIPO 3 — Inmobiliaria Ventas
-- =============================================================================

insert into a3_propiedades (tipo, zona, precio, m2, ambientes, descripcion) values
  ('departamento', 'Nueva Córdoba',  95000,  52, 2, 'Luminoso 2 ambientes con balcón, piso 4, sin expensas altas'),
  ('departamento', 'Nueva Córdoba', 145000,  78, 3, 'Amplio 3 ambientes, cocina integrada, 2 baños, cochera opcional'),
  ('departamento', 'Güemes',         82000,  48, 2, '2 ambientes reciclado, a pasos del patio olmos, excelente estado'),
  ('departamento', 'Güemes',        110000,  65, 3, '3 ambientes con dependencia, edificio con amenities, vista despejada'),
  ('casa',         'Argüello',      185000, 180, 4, 'Casa 4 ambientes con jardín, cochera doble, barrio residencial tranquilo'),
  ('casa',         'Villa Belgrano',220000, 210, 5, 'Casa 5 ambientes, pileta, quincho, doble cochera, barrio privado'),
  ('ph',           'Alberdi',        98000,  70, 3, 'PH de 2 plantas, 3 ambientes, terraza propia 40m², sin expensas'),
  ('local',        'Centro',         75000,  40, 1, 'Local comercial sobre peatonal, vidriera, ideal rubro gastronómico');

-- =============================================================================
-- ARQUETIPO 4 — Ecommerce Soporte (TiendaMax)
-- =============================================================================

insert into a4_pedidos (numero, cliente_nombre, cliente_email, estado, items, total, fecha_compra, fecha_estimada_entrega) values
  (
    'TM-00123',
    'Sofía Ramírez',
    'sofia.ramirez@email.com',
    'en_camino',
    '[{"nombre":"Auriculares Bluetooth XP200","qty":1,"precio":29990},{"nombre":"Funda protectora","qty":2,"precio":3500}]',
    36990,
    now() - interval '3 days',
    current_date + 2
  ),
  (
    'TM-00124',
    'Diego Morales',
    'diego.morales@email.com',
    'preparando',
    '[{"nombre":"Teclado mecánico RGB","qty":1,"precio":45000},{"nombre":"Mouse inalámbrico","qty":1,"precio":12500}]',
    57500,
    now() - interval '1 day',
    current_date + 5
  ),
  (
    'TM-00125',
    'Laura Vega',
    'laura.vega@email.com',
    'entregado',
    '[{"nombre":"Monitor 24\" Full HD","qty":1,"precio":89990}]',
    89990,
    now() - interval '10 days',
    current_date - 4
  ),
  (
    'TM-00126',
    'Carlos Herrera',
    'carlos.herrera@email.com',
    'cancelado',
    '[{"nombre":"Silla gamer ergonómica","qty":1,"precio":75000}]',
    75000,
    now() - interval '5 days',
    null
  );

-- =============================================================================
-- ARQUETIPO 5 — Asistente Interno LogiCorp
-- =============================================================================

insert into a5_politicas (tema, contenido, version) values
  (
    'vacaciones',
    'Los empleados de LogiCorp tienen derecho a 15 días hábiles de vacaciones por año trabajado durante el primer año. A partir del segundo año se incrementa a 20 días hábiles. Las vacaciones deben solicitarse con al menos 30 días de anticipación a través del portal de RRHH. No se pueden acumular más de 2 períodos consecutivos sin tomar. El pago se realiza antes del inicio del período vacacional.',
    '2.1'
  ),
  (
    'licencia por enfermedad',
    'En caso de enfermedad, el empleado debe notificar a su supervisor y a RRHH antes de las 9hs del día de ausencia. La licencia paga es de hasta 30 días corridos por año. A partir del día 4 de ausencia continua se requiere certificado médico. Para enfermedades crónicas o cirugías, comunicarse directamente con RRHH para evaluar licencias extendidas según convenio colectivo.',
    '1.3'
  ),
  (
    'reembolso de gastos',
    'Los gastos de trabajo (viáticos, traslados, materiales) se reembolsan dentro de los 10 días hábiles de presentada la liquidación. Límites: gastronomía hasta $15.000 por día, alojamiento hasta $50.000 por noche, traslados con comprobante sin límite. Presentar comprobantes en el portal de RRHH bajo "Liquidación de Gastos". Gastos sin comprobante no se reembolsan bajo ningún concepto.',
    '3.0'
  ),
  (
    'home office',
    'LogiCorp permite hasta 2 días de home office por semana para roles habilitados (listado en portal RRHH). Requisitos: conexión estable, disponibilidad en horario laboral, VPN corporativa activa. Los días de home office no son fijos — deben coordinarse semanalmente con el supervisor. No aplica durante el primer mes de incorporación ni en períodos de alta operativa definidos por Operaciones.',
    '1.0'
  ),
  (
    'código de conducta',
    'LogiCorp espera de todos sus empleados: respeto y trato profesional con compañeros, clientes y proveedores; confidencialidad de información de la empresa y clientes; uso ético de recursos corporativos; reporte de situaciones irregulares al área de Compliance (compliance@logicorp.com). Cualquier conducta que viole estos principios puede derivar en medidas disciplinarias según la gravedad, incluyendo desvinculación.',
    '4.2'
  );

insert into a5_procedimientos (nombre, pasos, responsable, tiempo_estimado) values
  (
    'onboarding',
    '["1. RRHH envía accesos al correo corporativo el día anterior al ingreso", "2. El primer día: presentación con el equipo y recorrida por las instalaciones", "3. IT entrega el equipo asignado y configura accesos a sistemas (Slack, JIRA, ERP)", "4. El supervisor asigna el buddy (compañero guía) por los primeros 30 días", "5. Completar el curso de inducción online en la plataforma de capacitación (72hs)", "6. Firma de NDA y políticas internas en el portal de RRHH", "7. Primera reunión 1:1 con el supervisor al finalizar la primera semana"]',
    'RRHH + IT + Supervisor directo',
    '5 días hábiles'
  ),
  (
    'solicitud de equipo',
    '["1. Completar el formulario \"Solicitud de Equipamiento\" en el portal de RRHH", "2. El supervisor debe aprobar la solicitud dentro de las 48hs", "3. IT evalúa disponibilidad de stock (2 días hábiles)", "4. Si hay stock: IT prepara el equipo y coordina entrega. Si no: compra y entrega en 10 días hábiles", "5. El empleado firma el acta de recepción de equipamiento", "6. IT registra el activo en el inventario corporativo"]',
    'RRHH + IT',
    '3 a 12 días hábiles según disponibilidad'
  ),
  (
    'baja voluntaria',
    '["1. El empleado notifica por escrito (email) su decisión de renuncia al supervisor y RRHH con 15 días de anticipación mínima (30 días para roles gerenciales)", "2. RRHH inicia el proceso de desvinculación y agenda la entrevista de salida", "3. IT bloquea accesos progresivamente según cronograma acordado", "4. El empleado devuelve equipamiento corporativo con inventario firmado", "5. RRHH liquida haberes (vacaciones pendientes, proporcional aguinaldo) en el plazo legal", "6. Se emite certificado de trabajo dentro de los 30 días"]',
    'RRHH + Supervisor + IT',
    '15 a 30 días según preaviso'
  );

-- =============================================================================
-- ARQUETIPO 6 — Fintech CuentaYa
-- =============================================================================

insert into a6_usuarios (id, nombre, alias, cvu, saldo, pin) values
  ('mario.garcia', 'Mario García',   'mario.garcia', '0000003100012345678901', 45230.50, '1234'),
  ('ana.lopez',    'Ana López',      'ana.lopez',    '0000003100098765432109', 12800.00, '5678'),
  ('pedro.silva',  'Pedro Silva',    'pedro.silva',  '0000003100011122334455', 78500.75, '9999')
on conflict (id) do nothing;

insert into a6_movimientos (usuario_id, tipo, monto, descripcion, creado_en) values
  -- Mario García
  ('mario.garcia', 'credito', 50000.00, 'Transferencia recibida de Empresa ABC',          now() - interval '10 days'),
  ('mario.garcia', 'debito',   8200.00, 'Transferencia a ana.lopez',                       now() - interval '7 days'),
  ('mario.garcia', 'debito',   3500.00, 'Pago servicios – Edesur',                         now() - interval '5 days'),
  ('mario.garcia', 'credito',  7200.00, 'Cobro freelance – Proyecto Web',                  now() - interval '3 days'),
  ('mario.garcia', 'debito',     269.50,'Suscripción mensual – Plataforma streaming',       now() - interval '1 day'),
  -- Ana López
  ('ana.lopez', 'credito',  8200.00, 'Transferencia recibida de mario.garcia',             now() - interval '7 days'),
  ('ana.lopez', 'debito',   2500.00, 'Pago alquiler – Inmobiliaria Norte',                 now() - interval '6 days'),
  ('ana.lopez', 'credito', 15000.00, 'Depósito sueldo – LogiCorp',                        now() - interval '4 days'),
  ('ana.lopez', 'debito',   5000.00, 'Transferencia a pedro.silva',                        now() - interval '2 days'),
  ('ana.lopez', 'debito',   2900.00, 'Compra supermercado – Carrefour',                   now() - interval '1 day'),
  -- Pedro Silva
  ('pedro.silva', 'credito', 80000.00, 'Venta propiedad – señal',                         now() - interval '15 days'),
  ('pedro.silva', 'debito',   5000.00, 'Transferencia enviada – varios',                   now() - interval '8 days'),
  ('pedro.silva', 'credito',  5000.00, 'Transferencia recibida de ana.lopez',              now() - interval '2 days'),
  ('pedro.silva', 'debito',   1499.25, 'Pago expensas',                                   now() - interval '1 day'),
  ('pedro.silva', 'debito',     500.00,'Carga SUBE',                                       now() - interval '12 hours');
