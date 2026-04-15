# Plan de Implementación — 6 Arquetipos de Bots

> Documento de planificación granular. Cada arquetipo está dividido en subfases
> independientes para implementar y testear de a uno sin bloquear los demás.
>
> **Convenciones:**
> - Seeds van en `builder/backend/prisma/`
> - APIs van en `builder/frontend/app/api/<arquetipo>/`
> - Tablas Supabase usan prefijo `a<N>_` para identificar el arquetipo
> - URLs de tools apuntan a `FRONTEND_API_URL` (default `http://localhost:3001`)
> - Todos los seeds soportan flag `--clean` y muestran curls de test al final

---

## Fase 0 — Base de datos compartida

> Ejecutar **una sola vez** antes de cualquier arquetipo. Crea todas las tablas demo
> en la misma Supabase que ya tiene `planes`, `usuarios`, `tickets`.

### Subfase 0.A — DDL (schema-demos.sql)
**Archivo:** `builder/saas-api/sql/schema-demos.sql`

Crear las siguientes tablas con sus prefijos:

```
a2_especialidades     — Arquetipo 2: especialidades médicas
a2_medicos            — Arquetipo 2: médicos por especialidad
a2_turnos             — Arquetipo 2: slots de turno (disponible true/false)
a3_propiedades        — Arquetipo 3: propiedades inmobiliarias
a3_leads              — Arquetipo 3: leads capturados por el bot
a4_pedidos            — Arquetipo 4: pedidos de ecommerce
a4_devoluciones       — Arquetipo 4: devoluciones iniciadas
a4_escalados          — Arquetipo 4: escalados a soporte humano
a5_politicas          — Arquetipo 5: políticas internas (RRHH)
a5_procedimientos     — Arquetipo 5: procedimientos operativos
a5_consultas_pendientes — Arquetipo 5: consultas sin respuesta
a6_usuarios           — Arquetipo 6: cuentas de billetera
a6_movimientos        — Arquetipo 6: historial de movimientos
a6_operaciones        — Arquetipo 6: transferencias ejecutadas
```

### Subfase 0.B — Datos de demo (seed-demos.sql)
**Archivo:** `builder/saas-api/sql/seed-demos.sql`

Insertar datos realistas para que cada bot tenga con qué trabajar:

- **a2**: 3 especialidades, 4 médicos, ~15 turnos (mezcla de disponibles e ocupados en los próximos 7 días)
- **a3**: 6 propiedades (2 departamentos, 2 casas, 1 local, 1 PH) en 3 zonas distintas con rangos de precio variados
- **a4**: 4 pedidos en distintos estados (`preparando`, `en_camino`, `entregado`, `cancelado`), con items JSON reales
- **a5**: 5 políticas (vacaciones, licencias, gastos, home office, código de conducta) y 3 procedimientos (onboarding, solicitud equipo, baja voluntaria)
- **a6**: 3 usuarios con saldo, CVU, PIN y 5 movimientos históricos cada uno

### Verificación Fase 0
```sql
-- Confirmar que las tablas existen
select table_name from information_schema.tables
where table_name like 'a%_' order by table_name;

-- Confirmar datos
select count(*) from a2_turnos;
select count(*) from a3_propiedades;
select count(*) from a4_pedidos;
select count(*) from a5_politicas;
select count(*) from a6_usuarios;
```

---

## Arquetipo 1 — FAQ & Info: Restaurante "La Parrilla Don Roberto"

> **Problema:** El dueño responde 50+ mensajes diarios en el chat web siempre
> con las mismas preguntas: horarios, menú, precios, delivery, reservas.
> Pierde 2hs por día. Toda la información cabe en el system prompt — sin tools.
>
> **Complejidad:** Mínima. Es el arquetipo de entrada. Sin tools, sin ciclo ReAct,
> sin Supabase. Flujo de una sola pasada.

### Subfase 1.A — Seed (no hay APIs)
**Archivo:** `builder/backend/prisma/seed-restaurante.ts`

```
Cliente:
  nombre: "La Parrilla Don Roberto"
  arquetipo: "faq"
  widgetColor: "#b45309"  (marrón parrilla)

System prompt incluye:
  - Dirección, teléfono, Instagram
  - Horarios: mar-dom, dos turnos (12-15:30 y 20-23:30), lunes cerrado
  - Menú completo con precios (entraña, bife, costillas, vacío, provoleta, empanadas, bebidas)
  - Política de reservas: +4 personas por tel/chat, menores sin reserva
  - Delivery: PedidosYa y Rappi, horarios acotados
  - Estacionamiento: no propio, playa paga a media cuadra
  - Regla de cierre: si no sabe → dar contacto directo
  - Regla de alergias: siempre derivar al local

Tools: ninguna

FlujoDef:
  Campos: [{ nombre: "categoria", tipo: "string", default: '"info"' }]
  Nodos:
    - agente_faq (llm_call, orden 0)
      config: { model: "claude-haiku-4-5-20251001", temperature: 0.3, maxTokens: 150 }
  Aristas:
    - __start__ → agente_faq (null)
    - agente_faq → __end__ (__end__)
```

### Subfase 1.B — Test
```bash
npx ts-node prisma/seed-restaurante.ts

# Horario
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿A qué hora cierran esta noche?","sessionId":"r1"}' | jq

# Precio
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Cuánto sale el bife de chorizo?","sessionId":"r2"}' | jq

# Pregunta fuera de scope (debe dar contacto)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Tienen opciones veganas?","sessionId":"r3"}' | jq
```

**Resultado esperado:**
- r1: horario correcto del turno noche
- r2: precio del bife ($9.200)
- r3: derivación al contacto directo (no inventar nada)

---

## Arquetipo 2 — Agenda & Turnos: Clínica Demo (reescritura)

> **Problema:** Recepcionistas coordinan toda la agenda de turnos manualmente
> por el chat web. Cada consulta de disponibilidad lleva 3-5 minutos de búsqueda
> manual. El bot consulta disponibilidad real y reserva directamente.
>
> **Reescritura** de `seed-clinica.ts` para que las tool URLs apunten al frontend
> en lugar del mock server de `:4000`. La lógica del flujo no cambia.

### Subfase 2.A — APIs del frontend
**Carpeta:** `builder/frontend/app/api/clinica/`

#### `especialidades/route.ts`
- **Método:** GET
- **Query params:** ninguno
- **Lógica:** `SELECT * FROM a2_especialidades ORDER BY nombre`
- **Respuesta:** `{ especialidades: [{ id, nombre, descripcion }] }`

#### `medicos/route.ts`
- **Método:** GET
- **Query params:** `especialidad_id?` (opcional, filtra por especialidad)
- **Lógica:** SELECT con join a `a2_especialidades`; si hay `especialidad_id` filtrar
- **Respuesta:** `{ medicos: [{ id, nombre, especialidad }] }`

#### `disponibilidad/route.ts`
- **Método:** GET
- **Query params:** `especialidad` (requerido), `fecha` (requerido, formato YYYY-MM-DD)
- **Validación:** ambos parámetros presentes; fecha en formato correcto
- **Lógica:**
  ```sql
  SELECT a2_turnos.*, a2_medicos.nombre as medico_nombre
  FROM a2_turnos
  JOIN a2_medicos ON a2_turnos.medico_id = a2_medicos.id
  JOIN a2_especialidades ON a2_medicos.especialidad_id = a2_especialidades.id
  WHERE a2_especialidades.nombre ILIKE '%especialidad%'
    AND a2_turnos.fecha = 'fecha'
    AND a2_turnos.disponible = true
  ORDER BY a2_turnos.hora
  ```
- **Respuesta:** `{ disponibles: [{ turno_id, medico, hora }] }` o `{ disponibles: [], mensaje: "Sin turnos disponibles para esa fecha" }`

#### `turnos/route.ts`
- **Método:** POST
- **Body:** `{ turno_id, nombre_paciente }`
- **Validación:** campos requeridos; verificar que el turno existe y sigue disponible
- **Lógica:**
  ```sql
  UPDATE a2_turnos SET disponible = false, paciente_nombre = :nombre
  WHERE id = :turno_id AND disponible = true
  RETURNING *
  ```
- **Respuesta:** `{ confirmacion_id, especialidad, medico, fecha, hora, paciente }` o error 409 si ya estaba tomado

### Subfase 2.B — Reescritura del seed
**Archivo:** `builder/backend/prisma/seed-clinica.ts` (sobreescribir)

Cambios respecto al original:
- `TURNOS_API_BASE` → eliminado
- Todas las URLs pasan a usar `FRONTEND_API_URL ?? 'http://localhost:3001'`
  - `buscar_disponibilidad` → GET `${FRONTEND_API_URL}/api/clinica/disponibilidad`
  - `reservar_turno` → POST `${FRONTEND_API_URL}/api/clinica/turnos`
  - `consultar_especialidades` → GET `${FRONTEND_API_URL}/api/clinica/especialidades`
  - `consultar_medicos` → GET `${FRONTEND_API_URL}/api/clinica/medicos`
- El resto del flujo (3 ramas, ciclo ReAct, handoff urgencia) sin cambios

### Subfase 2.C — Test
```bash
npx ts-node prisma/seed-clinica.ts --clean

# Consulta (rama consulta, llama consultar_especialidades)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Qué especialidades tienen?","sessionId":"c1"}' | jq

# Turno (rama turnos, llama buscar_disponibilidad → reservar_turno)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Quiero un turno con cardiología para mañana","sessionId":"c2"}' | jq

# Urgencia (rama handoff)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Tengo un dolor en el pecho muy fuerte","sessionId":"c3"}' | jq
```

---

## Arquetipo 3 — Ventas & Captación: Inmobiliaria "PropNorte"

> **Problema:** El sitio web recibe muchas consultas fuera del horario laboral.
> Los asesores comerciales atienden sin información previa del lead y pierden tiempo
> calificando. El bot actúa como primer filtro: entiende qué busca el usuario,
> filtra propiedades por criterios reales y registra el lead con un score de calidad
> para que el asesor sepa con quién hablar primero.
>
> **Temperatura alta** (0.6) para tono consultivo y persuasivo sin ser invasivo.

### Subfase 3.A — APIs del frontend
**Carpeta:** `builder/frontend/app/api/inmobiliaria/`

#### `propiedades/route.ts`
- **Método:** GET
- **Query params:** `tipo?` (departamento/casa/local), `zona?` (texto libre), `presupuesto_max?` (número)
- **Lógica:**
  ```
  SELECT * FROM a3_propiedades WHERE disponible = true
    AND (tipo = :tipo OR :tipo IS NULL)
    AND (zona ILIKE '%zona%' OR :zona IS NULL)
    AND (precio <= :presupuesto_max OR :presupuesto_max IS NULL)
  ORDER BY precio ASC
  LIMIT 5
  ```
- **Respuesta:** `{ total, propiedades: [{ id, tipo, zona, precio, m2, ambientes, descripcion }] }`
- Si no hay resultados: `{ total: 0, mensaje: "No encontramos propiedades con esos criterios" }`

#### `leads/route.ts`
- **Método:** POST
- **Body:** `{ nombre, email, telefono?, interes?, presupuesto? }`
- **Validación:** `nombre` y `email` requeridos; formato básico de email
- **Lógica score:**
  - base: 0
  - presupuesto > 150.000: +40
  - presupuesto > 80.000: +25
  - telefono presente: +30
  - interes presente (> 20 chars): +30
  - Máximo 100
- **Lógica:** INSERT en `a3_leads` con score calculado
- **Respuesta (201):** `{ lead_id, nombre, score, mensaje: "¡Perfecto! Un asesor de PropNorte se va a contactar con vos en las próximas horas." }`

### Subfase 3.B — Seed
**Archivo:** `builder/backend/prisma/seed-inmobiliaria.ts`

```
Cliente:
  nombre: "PropNorte Inmobiliaria"
  arquetipo: "ventas"
  widgetColor: "#1d4ed8"
  widgetBienvenida: "¡Hola! Soy el asistente de PropNorte. ¿Estás buscando tu próxima propiedad?"

System prompt:
  - Actúa como asesor inmobiliario consultivo
  - Primero entender qué busca (tipo, zona, presupuesto, ambientes, uso)
  - No mostrar propiedades sin preguntar al menos tipo y presupuesto
  - Temperatura alta → tono amigable pero no invasivo
  - No presionar para datos personales hasta que el usuario muestre interés real
  - Cuando el usuario elige una propiedad, ofrecer dejarle los datos al asesor

Tools:
  1. buscar_propiedades(tipo, zona, presupuesto_max)
     → GET FRONTEND_API_URL/api/inmobiliaria/propiedades
     Params: tipo (string), zona (string), presupuesto_max (number)

  2. registrar_lead(nombre, email, telefono, interes, presupuesto)
     → POST FRONTEND_API_URL/api/inmobiliaria/leads
     Params: nombre*, email*, telefono, interes, presupuesto

FlujoDef:
  Campos:
    - etapa (string, last_wins, default: "explorar")
    - lead_id (string, last_wins, default: null)

  Nodos:
    - clasificador (classifier, orden 0)
      categories: ["consultar", "calificar", "registrar"]
      prompt: |
        "consultar": el usuario pregunta por propiedades, zonas, precios o características.
        "calificar": el usuario ya expresó su necesidad y está listo para ver opciones concretas.
        "registrar": el usuario quiere que lo contacten o dejó sus datos.

    - agente_ventas (llm_call, orden 1)
      config: { temperature: 0.6, maxTokens: 250 }

    - tools (tool_executor, orden 2)

  Aristas:
    __start__ → clasificador
    clasificador → agente_ventas (consultar)
    clasificador → agente_ventas (calificar)
    clasificador → agente_ventas (registrar)
    agente_ventas → tools (tools)
    agente_ventas → __end__ (__end__)
    tools → agente_ventas (null)
```

### Subfase 3.C — Test
```bash
npx ts-node prisma/seed-inmobiliaria.ts

# Consulta genérica
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Busco un departamento en Nueva Córdoba","sessionId":"v1"}' | jq

# Búsqueda con criterios (debe llamar buscar_propiedades)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Necesito algo hasta $120.000 en Güemes, 2 ambientes","sessionId":"v2"}' | jq

# Registro de lead (debe llamar registrar_lead)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Me interesa, soy Juan López, juan@email.com, 351-4567890","sessionId":"v3"}' | jq
```

---

## Arquetipo 4 — Soporte & Postventa: Ecommerce "TiendaMax"

> **Problema:** El 70% de los mensajes al soporte son "¿dónde está mi pedido?".
> Los agentes repiten siempre el mismo proceso: abrir sistema, buscar pedido por número,
> leer el estado, responder. El bot hace exactamente eso, y cuando no puede resolver
> (reclamos complejos), escala con todo el contexto ya recopilado — el agente humano
> no tiene que preguntar nada de nuevo.
>
> **Punto crítico de diseño:** El escalado debe llevar TODO el contexto. Si el usuario
> tiene que repetir su problema, el bot falló.

### Subfase 4.A — APIs del frontend
**Carpeta:** `builder/frontend/app/api/ecommerce/`

#### `pedidos/route.ts`
- **Método:** GET
- **Query params:** `numero` (requerido, ej: "TM-00123")
- **Validación:** parámetro presente
- **Lógica:** `SELECT * FROM a4_pedidos WHERE numero = :numero`
- **Respuesta:** `{ pedido: { numero, cliente_nombre, estado, items, total, fecha_compra, fecha_estimada_entrega } }`
- Error 404 si no existe: `{ error: "Pedido TM-XXXXX no encontrado" }`

#### `devoluciones/route.ts`
- **Método:** POST
- **Body:** `{ numero_pedido, motivo }`
- **Validación:** ambos requeridos; verificar que el pedido existe en `a4_pedidos`
- **Lógica:** INSERT en `a4_devoluciones`
- **Respuesta (201):** `{ devolucion_id, estado: "iniciada", plazo_dias: 5, mensaje: "Tu devolución fue registrada. El reembolso se acredita en 5 días hábiles." }`

#### `escalados/route.ts`
- **Método:** POST
- **Body:** `{ resumen, prioridad }` — `prioridad` en `['baja','media','alta','critica']`
- **Validación:** ambos requeridos; prioridad válida
- **Lógica:** INSERT en `a4_escalados`
- **Respuesta (201):** `{ ticket_id, prioridad, estado: "abierto", tiempo_respuesta: "2hs" si alta/critica, "24hs" si baja/media }`

### Subfase 4.B — Seed
**Archivo:** `builder/backend/prisma/seed-ecommerce.ts`

```
Cliente:
  nombre: "TiendaMax"
  arquetipo: "soporte"
  widgetColor: "#16a34a"
  widgetBienvenida: "Hola, soy el asistente de TiendaMax. ¿En qué te puedo ayudar hoy?"

System prompt:
  - Siempre pedirle al usuario el número de pedido antes de consultar
  - Para devoluciones: verificar que el pedido existe y preguntar el motivo
  - Para reclamos complejos (no cubre las tools): escalar CON un resumen claro
  - Temperatura baja (0.3): respuestas precisas, sin floreos
  - Nunca inventar estados de pedidos
  - Si el pedido no existe: indicar y pedir verificar el número

Tools:
  1. consultar_pedido(numero_pedido)
     → GET FRONTEND_API_URL/api/ecommerce/pedidos?numero=
     Params: numero_pedido* (string, ej: "TM-00123")

  2. iniciar_devolucion(numero_pedido, motivo)
     → POST FRONTEND_API_URL/api/ecommerce/devoluciones
     Params: numero_pedido* (string), motivo* (string)

  3. escalar_a_humano(resumen, prioridad)
     → POST FRONTEND_API_URL/api/ecommerce/escalados
     Params:
       resumen* (string, incluir número de pedido, problema y lo ya intentado)
       prioridad* (string: "baja" | "media" | "alta" | "critica")

FlujoDef:
  Campos:
    - categoria (string, last_wins, default: "sin_clasificar")
    - pedido_numero (string, last_wins, default: null)
    - escalated (boolean, last_wins, default: false)

  Nodos:
    - clasificador (classifier, orden 0)
      categories: ["estado_pedido", "devolucion", "reclamo"]
      prompt: |
        "estado_pedido": quiere saber dónde está su pedido o cuándo llega.
        "devolucion": quiere devolver un producto o solicitar reembolso.
        "reclamo": producto dañado, error en pedido, cobro incorrecto, o situación que requiere intervención humana.

    - agente_soporte (llm_call, orden 1)
      config: { temperature: 0.3, maxTokens: 250 }

    - tools (tool_executor, orden 2)

    - handoff (human_handoff, orden 3)
      config:
        message: "Entiendo la situación. Voy a escalar tu caso a un agente de TiendaMax
                  que va a tener todo el contexto y te va a contactar en las próximas 2 horas."
        escalatedField: "escalated"

  Aristas:
    __start__ → clasificador
    clasificador → agente_soporte (estado_pedido)
    clasificador → agente_soporte (devolucion)
    clasificador → handoff (reclamo)
    agente_soporte → tools (tools)
    agente_soporte → __end__ (__end__)
    tools → agente_soporte (null)
    handoff → __end__ (null)
```

### Subfase 4.C — Test
```bash
npx ts-node prisma/seed-ecommerce.ts

# Estado de pedido (debe llamar consultar_pedido)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Dónde está mi pedido TM-00123?","sessionId":"s1"}' | jq

# Devolución (debe llamar iniciar_devolucion)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Quiero devolver el pedido TM-00124, llegó roto","sessionId":"s2"}' | jq

# Reclamo (debe ir directo al handoff)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Me cobraron dos veces el mismo pedido","sessionId":"s3"}' | jq

# Pedido que no existe
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Busco mi pedido TM-99999","sessionId":"s4"}' | jq
```

---

## Arquetipo 5 — Asistente Interno: Empresa "LogiCorp"

> **Problema:** Empresa de logística con 200 empleados. RRHH recibe 30+ consultas
> diarias sobre política de vacaciones, licencias médicas, reembolso de gastos,
> procedimiento de onboarding, equipamiento para empleados nuevos. El conocimiento
> existe en PDFs que nadie lee. Empleados nuevos preguntan siempre lo mismo y la
> respuesta depende de qué persona encuentren disponible.
>
> El bot simula RAG: cuando el empleado pregunta, busca en la base de conocimiento
> y responde **citando la fuente y versión** del documento. Si no encuentra respuesta,
> registra la pregunta para que RRHH la responda y mejore la base.
>
> **Usuario = empleado interno**, no cliente final.

### Subfase 5.A — APIs del frontend
**Carpeta:** `builder/frontend/app/api/logicorp/`

#### `politicas/route.ts`
- **Método:** GET
- **Query params:** `tema` (requerido)
- **Lógica:**
  ```sql
  SELECT * FROM a5_politicas
  WHERE tema ILIKE '%:tema%' OR contenido ILIKE '%:tema%'
  ORDER BY actualizada_en DESC
  LIMIT 3
  ```
- **Respuesta:** `{ encontradas: [{ id, tema, contenido, version, actualizada_en }], total: N }`
- Si no hay resultados: `{ encontradas: [], total: 0, mensaje: "No se encontró política sobre ese tema" }`

#### `procedimientos/route.ts`
- **Método:** GET
- **Query params:** `nombre` (requerido)
- **Lógica:**
  ```sql
  SELECT * FROM a5_procedimientos
  WHERE nombre ILIKE '%:nombre%'
  LIMIT 2
  ```
- **Respuesta:** `{ procedimiento: { nombre, pasos: [...], responsable, tiempo_estimado } }`
- Si no existe: `{ procedimiento: null, mensaje: "Procedimiento no encontrado" }`

#### `consultas-pendientes/route.ts`
- **Método:** POST
- **Body:** `{ pregunta, empleado_id }`
- **Validación:** ambos requeridos
- **Lógica:** INSERT en `a5_consultas_pendientes`
- **Respuesta (201):** `{ id, mensaje: "Tu consulta fue registrada. RRHH te va a responder antes del próximo día hábil." }`

### Subfase 5.B — Seed
**Archivo:** `builder/backend/prisma/seed-logicorp.ts`

```
Cliente:
  nombre: "LogiCorp Asistente Interno"
  arquetipo: "interno"
  widgetColor: "#7c3aed"
  widgetBienvenida: "Hola, soy el asistente interno de LogiCorp. ¿En qué te puedo ayudar?"

System prompt:
  - El usuario es un empleado de LogiCorp (no un cliente)
  - Siempre buscar en la base de conocimiento antes de responder
  - Citar la fuente: "Según la [nombre política] (versión X.X)"
  - Si no encontrás información → registrar la consulta como pendiente
  - No inventar información de RRHH — solo lo que devuelvan las tools
  - Tono profesional pero accesible
  - Si el empleado pregunta por algo confidencial (salarios, legajos), derivar a RRHH directamente

Tools:
  1. buscar_politica(tema)
     → GET FRONTEND_API_URL/api/logicorp/politicas?tema=
     Params: tema* (string, ej: "vacaciones", "licencia por enfermedad", "gastos")

  2. buscar_procedimiento(nombre)
     → GET FRONTEND_API_URL/api/logicorp/procedimientos?nombre=
     Params: nombre* (string, ej: "onboarding", "solicitud de equipo", "baja voluntaria")

  3. registrar_consulta_pendiente(pregunta, empleado_id)
     → POST FRONTEND_API_URL/api/logicorp/consultas-pendientes
     Params:
       pregunta* (string, la pregunta completa del empleado)
       empleado_id* (string, pedirle al empleado su legajo o nombre)

FlujoDef:
  Campos:
    - tipo_consulta (string, last_wins, default: "desconocido")
    - respondida (boolean, last_wins, default: false)

  Nodos:
    - clasificador (classifier, orden 0)
      categories: ["politica", "procedimiento", "desconocido"]
      prompt: |
        "politica": pregunta sobre reglas, beneficios, permisos, licencias, código de conducta.
        "procedimiento": pregunta sobre cómo hacer algo paso a paso (onboarding, solicitudes, bajas).
        "desconocido": pregunta que no cae claramente en ninguna categoría o es muy específica.

    - agente_interno (llm_call, orden 1)
      config: { temperature: 0.25, maxTokens: 300 }

    - tools (tool_executor, orden 2)

  Aristas:
    __start__ → clasificador
    clasificador → agente_interno (politica)
    clasificador → agente_interno (procedimiento)
    clasificador → agente_interno (desconocido)
    agente_interno → tools (tools)
    agente_interno → __end__ (__end__)
    tools → agente_interno (null)
```

### Subfase 5.C — Test
```bash
npx ts-node prisma/seed-logicorp.ts

# Consulta de política (busca en a5_politicas)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Cuántos días de vacaciones tenemos por año?","sessionId":"i1"}' | jq

# Consulta de procedimiento (busca en a5_procedimientos)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Cómo hago para pedir una notebook nueva?","sessionId":"i2"}' | jq

# Pregunta sin respuesta (debe registrar en consultas_pendientes)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"¿Hay política sobre uso de IA en el trabajo?","sessionId":"i3"}' | jq
```

---

## Arquetipo 6 — Transaccional: Fintech "CuentaYa"

> **Problema:** App de billetera digital. Los usuarios quieren consultar saldo,
> ver últimos movimientos y transferir dinero desde el chat web sin abrir la app.
> El bot primero verifica identidad con PIN, luego ejecuta. Para transferencias,
> **siempre muestra un resumen y pide confirmación explícita** antes de ejecutar.
>
> **Regla de oro:** Llamar `ejecutar_transferencia` con `confirmado=false` devuelve
> un preview. Con `confirmado=true` ejecuta. El bot NUNCA debe pasar `confirmado=true`
> sin que el usuario haya dicho "sí, confirmo" o equivalente explícito.
>
> **Complejidad:** Alta. Dos fases (auth + operación), flujo condicional, 5 tools,
> escrituras que afectan saldos.

### Subfase 6.A — APIs del frontend
**Carpeta:** `builder/frontend/app/api/cuentaya/`

#### `verificar/route.ts`
- **Método:** POST
- **Body:** `{ usuario_id, pin }`
- **Validación:** ambos requeridos
- **Lógica:**
  ```sql
  SELECT id, nombre, alias FROM a6_usuarios
  WHERE id = :usuario_id AND pin = :pin AND activo = true
  ```
- **Respuesta OK:** `{ valido: true, nombre, alias }`
- **Respuesta KO:** `{ valido: false }` (nunca decir qué campo es incorrecto)

#### `cuenta/route.ts`
- **Método:** GET
- **Query params:** `usuario_id` (requerido)
- **Validación:** parámetro presente
- **Lógica:** `SELECT alias, cvu, saldo FROM a6_usuarios WHERE id = :usuario_id`
- **Respuesta:** `{ alias, cvu, saldo, saldo_formateado: "$ 45.230,50" }`

#### `movimientos/route.ts`
- **Método:** GET
- **Query params:** `usuario_id` (requerido), `limite?` (default 5)
- **Lógica:**
  ```sql
  SELECT * FROM a6_movimientos
  WHERE usuario_id = :usuario_id
  ORDER BY creado_en DESC
  LIMIT :limite
  ```
- **Respuesta:** `{ movimientos: [{ tipo, monto, descripcion, creado_en }] }`

#### `transferencias/route.ts`
- **Método:** POST
- **Body:** `{ origen_id, destino_alias, monto, confirmado }`
- **Validación:** todos requeridos; `monto > 0`; `confirmado` es boolean
- **Lógica si `confirmado = false`:**
  ```
  SELECT * FROM a6_usuarios WHERE alias = :destino_alias
  SELECT saldo FROM a6_usuarios WHERE id = :origen_id
  Si destino no existe → error 404
  Si saldo < monto → error 400 "Saldo insuficiente"
  Retornar preview: { preview: true, origen, destino_nombre, monto, saldo_disponible }
  ```
- **Lógica si `confirmado = true`:**
  ```
  UPDATE a6_usuarios SET saldo = saldo - :monto WHERE id = :origen_id
  UPDATE a6_usuarios SET saldo = saldo + :monto WHERE alias = :destino_alias
  INSERT INTO a6_operaciones (origen_id, destino_alias, monto, estado) VALUES (..., 'acreditada')
  INSERT INTO a6_movimientos × 2 (debito para origen, credito para destino)
  Retornar: { operacion_id, estado: "acreditada", monto, destino_alias }
  ```
- **Respuesta (201 si ejecutada):** `{ operacion_id, estado, monto, destino_alias, mensaje: "Transferencia acreditada" }`

#### `comprobante/route.ts`
- **Método:** GET
- **Query params:** `operacion_id` (requerido)
- **Lógica:**
  ```sql
  SELECT a6_operaciones.*, a6_usuarios.nombre as origen_nombre
  FROM a6_operaciones
  JOIN a6_usuarios ON a6_operaciones.origen_id = a6_usuarios.id
  WHERE a6_operaciones.id = :operacion_id
  ```
- **Respuesta:** `{ comprobante: { id, origen_nombre, destino_alias, monto, estado, fecha } }`

### Subfase 6.B — Seed
**Archivo:** `builder/backend/prisma/seed-fintech.ts`

```
Cliente:
  nombre: "CuentaYa"
  arquetipo: "transaccional"
  widgetColor: "#0891b2"
  widgetBienvenida: "Hola, soy el asistente de CuentaYa. Para empezar, necesito verificar tu identidad."

System prompt:
  INSTRUCCIONES CRÍTICAS:
  1. SIEMPRE verificar identidad con verificar_pin ANTES de mostrar cualquier dato
  2. Para transferencias: SIEMPRE llamar ejecutar_transferencia con confirmado=false primero,
     mostrar el resumen al usuario, y solo pasar confirmado=true si el usuario dice explícitamente
     "sí", "confirmo", "adelante" o equivalente
  3. NUNCA ejecutar transferencia si el usuario dice "no", "espera", "cancelar" o no responde
  4. NUNCA mostrar el PIN del usuario en ninguna respuesta
  5. Si verificar_pin retorna valido=false → indicar que las credenciales son incorrectas
     y ofrecer contactar soporte. No reintentar más de 2 veces.

  Flujo esperado:
    - Pedirle al usuario su ID (alias o ID)
    - Pedirle el PIN
    - Verificar con verificar_pin
    - Si válido: preguntar qué quiere hacer
    - Para consulta saldo: usar consultar_cuenta
    - Para movimientos: usar consultar_movimientos
    - Para transferencia: pedir destino y monto → preview → confirmación → ejecutar

Tools:
  1. verificar_pin(usuario_id, pin)
     → POST FRONTEND_API_URL/api/cuentaya/verificar
     Params: usuario_id* (string), pin* (string)

  2. consultar_cuenta(usuario_id)
     → GET FRONTEND_API_URL/api/cuentaya/cuenta?usuario_id=
     Params: usuario_id* (string)

  3. consultar_movimientos(usuario_id)
     → GET FRONTEND_API_URL/api/cuentaya/movimientos?usuario_id=
     Params: usuario_id* (string)

  4. ejecutar_transferencia(origen_id, destino_alias, monto, confirmado)
     → POST FRONTEND_API_URL/api/cuentaya/transferencias
     Params:
       origen_id* (string)
       destino_alias* (string, alias del destinatario)
       monto* (number, mayor a 0)
       confirmado* (boolean — false para preview, true para ejecutar)
     IMPORTANTE: llamar con confirmado=false primero SIEMPRE

  5. generar_comprobante(operacion_id)
     → GET FRONTEND_API_URL/api/cuentaya/comprobante?operacion_id=
     Params: operacion_id* (string)

FlujoDef:
  Campos:
    - autenticado (boolean, last_wins, default: false)
    - usuario_id (string, last_wins, default: null)
    - operacion_pendiente (object, last_wins, default: null)
    - operacion_id (string, last_wins, default: null)

  Nodos:
    - agente_auth (llm_call, orden 0)
      config: { temperature: 0.15, maxTokens: 200 }
      [solicita ID y PIN al usuario]

    - tools_auth (tool_executor, orden 1)
      [ejecuta solo verificar_pin]

    - agente_transaccional (llm_call, orden 2)
      config: { temperature: 0.15, maxTokens: 300 }

    - tools (tool_executor, orden 3)
      [ejecuta consultar_cuenta, consultar_movimientos,
       ejecutar_transferencia, generar_comprobante]

  Aristas:
    __start__ → agente_auth (null)
    agente_auth → tools_auth (tools)
    agente_auth → __end__ (__end__)       [si ya autenticado o rechaza]
    tools_auth → agente_auth (null)       [ciclo auth hasta verificado]
    agente_auth → agente_transaccional (autenticado)  [condición campo autenticado=true]
    agente_transaccional → tools (tools)
    agente_transaccional → __end__ (__end__)
    tools → agente_transaccional (null)
```

### Subfase 6.C — Test

Los usuarios de prueba están en `a6_usuarios`. Con los datos del seed-demos.sql:
- `mario.garcia` / PIN `1234` / saldo $45.230
- `ana.lopez` / PIN `5678` / saldo $12.800

```bash
npx ts-node prisma/seed-fintech.ts

# Consulta saldo (verificar PIN → consultar_cuenta)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Hola, quiero ver mi saldo","sessionId":"f1"}' | jq

# (continuar la sesión f1 con ID y PIN)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"mi id es mario.garcia y mi PIN es 1234","sessionId":"f1"}' | jq

# Transferencia con confirmación (debe hacer preview primero)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Quiero transferirle $5000 a ana.lopez","sessionId":"f1"}' | jq

# Confirmación explícita (ejecuta la transferencia)
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Sí, confirmo","sessionId":"f1"}' | jq

# Comprobante
curl -s -X POST http://localhost:3000/chat \
  -H "x-client-id: <id>" \
  -d '{"mensaje":"Dame el comprobante","sessionId":"f1"}' | jq
```

---

## Checklist de implementación

```
Fase 0 — Base de datos
  [ ] schema-demos.sql ejecutado en Supabase
  [ ] seed-demos.sql ejecutado en Supabase
  [ ] Verificar conteos de tablas

Arquetipo 1 — Restaurante FAQ
  [ ] seed-restaurante.ts creado
  [ ] Test: 3 curls básicos pasan

Arquetipo 2 — Clínica Turnos
  [ ] APIs: /api/clinica/* (4 rutas)
  [ ] seed-clinica.ts reescrito (URLs al frontend)
  [ ] Test: 3 ramas (consulta / turno / urgencia)

Arquetipo 3 — Inmobiliaria Ventas
  [ ] APIs: /api/inmobiliaria/* (2 rutas)
  [ ] seed-inmobiliaria.ts creado
  [ ] Test: búsqueda + registro de lead

Arquetipo 4 — Ecommerce Soporte
  [ ] APIs: /api/ecommerce/* (3 rutas)
  [ ] seed-ecommerce.ts creado
  [ ] Test: estado pedido + devolución + reclamo (handoff)

Arquetipo 5 — Interno LogiCorp
  [ ] APIs: /api/logicorp/* (3 rutas)
  [ ] seed-logicorp.ts creado
  [ ] Test: política + procedimiento + consulta sin respuesta

Arquetipo 6 — Fintech CuentaYa
  [ ] APIs: /api/cuentaya/* (5 rutas)
  [ ] seed-fintech.ts creado
  [ ] Test: auth + saldo + transferencia preview + confirmación + comprobante
```
