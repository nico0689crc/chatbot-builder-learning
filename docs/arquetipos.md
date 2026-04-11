# Los 6 Arquetipos de Chatbots

> Referencia rápida para identificar qué tipo de bot necesita un cliente
> y qué marco de trabajo aplicar. Usá este archivo durante el discovery.

---

## Cómo identificar el arquetipo en 15 minutos

Hacé estas tres preguntas al principio de la reunión:

1. **"¿Qué pasa cuando alguien les consulta a las 11 de la noche?"**
   → Si el problema es disponibilidad horaria → FAQ o Turnos

2. **"¿Pueden mostrarme los últimos 20 mensajes que recibieron?"**
   → Si las respuestas requieren consultar un sistema → Turnos, Soporte o Transaccional
   → Si son siempre las mismas preguntas → FAQ

3. **"¿Qué tendría que pasar para que el bot funcione bien?"**
   → Si mencionan datos en tiempo real → Function calling requerido
   → Si mencionan reducir trabajo del equipo → cualquier arquetipo con automatización

---

## Arquetipo 1 — FAQ & Info

### Qué hace
Responde preguntas frecuentes con información estática. No consulta ningún sistema externo. El bot sabe todo lo que necesita desde el system prompt.

### Señales que lo identifican
- El equipo responde siempre las mismas preguntas
- No necesitan consultar un sistema para hacerlo
- Alto volumen de consultas repetidas por WhatsApp, Instagram o web

### Industrias típicas
Restaurantes · Comercios · Profesionales independientes · ONGs · Municipios · Gimnasios · Inmobiliarias (info general)

### Flujo de conversación
```
Usuario pregunta
    └─→ ¿está en el system prompt?
            ├─→ Sí → responde directamente
            └─→ No → escala o da contacto alternativo
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Claude Haiku |
| Temperatura | 0.2 – 0.4 |
| Historial | 4–6 turnos |
| Max tokens salida | 150 |
| Function calling | No |

### Precios
- Setup: $200 – $400
- Mensualidad: $50 – $100
- Costo IA estimado: $2 – $5/mes

### Riesgos de diseño
- System prompt desactualizado si el negocio cambia datos sin avisar
- Definir proceso claro para que el cliente notifique cambios (precios, horarios, servicios)

### Plantilla de system prompt
```
Sos [nombre del bot], el asistente virtual de [nombre del negocio].
Respondé siempre en español con un tono [formal/amigable/profesional].

INFORMACIÓN DEL NEGOCIO:
- Horario: [horarios]
- Dirección: [dirección]
- Servicios: [servicios]
- Precios: [precios si aplica]
- Contacto: [teléfono/email]

REGLAS:
- Si te preguntan algo que no está en esta información, decí:
  "Para esa consulta te recomiendo contactarnos directamente al [contacto]"
- No inventes información que no esté aquí
- Respondé de forma concisa — máximo 3 oraciones por respuesta
```

---

## Arquetipo 2 — Agenda & Turnos

### Qué hace
Consulta disponibilidad en tiempo real y gestiona reservas. Puede ser de solo lectura (consultar turno existente) o lectura y escritura (crear, modificar, cancelar).

### Señales que lo identifican
- Muchas consultas de disponibilidad por WhatsApp
- Reservas que se hacen por teléfono o mensaje manual
- Cancelaciones de último momento sin aviso previo
- El equipo pierde tiempo coordinando agenda manualmente

### Industrias típicas
Clínicas · Consultorios · Peluquerías · Estéticas · Talleres mecánicos · Canchas deportivas · Espacios de coworking

### Flujo de conversación
```
Usuario quiere turno
    └─→ consultar_disponibilidad(fecha, hora)
            ├─→ disponible → ofrecer confirmación
            │       └─→ usuario confirma → crear_turno() → confirmación al usuario
            └─→ no disponible → ofrecer alternativas
                    └─→ usuario elige → crear_turno() → confirmación
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Haiku (flujos simples) / Sonnet (lógica compleja) |
| Temperatura | 0.2 – 0.3 |
| Historial | 6–8 turnos |
| Max tokens salida | 200 |
| Function calling | Sí — lectura y escritura |

### Tools típicas
```typescript
verificar_disponibilidad(fecha, hora, profesional?)
crear_turno(usuario_id, fecha, hora, profesional, servicio)
cancelar_turno(turno_id, motivo?)
listar_turnos_usuario(usuario_id)
```

### Precios
- Setup: $400 – $800
- Mensualidad: $100 – $200
- Costo IA estimado: $5 – $12/mes

### Riesgos de diseño
- Doble booking si la sincronización con la agenda no es inmediata
- Si la integración falla, el bot no puede operar — necesitás fallback claro
- Siempre confirmar el turno con un resumen antes de guardarlo

---

## Arquetipo 3 — Ventas & Captación

### Qué hace
Actúa como un vendedor consultivo. Entiende la necesidad del usuario, presenta opciones relevantes según su perfil y captura los datos de contacto para el equipo comercial.

### Señales que lo identifican
- Muchos visitantes web que no convierten
- El equipo comercial pierde tiempo con leads no calificados
- Consultas que llegan fuera del horario comercial sin respuesta
- Clientes que preguntan por productos/servicios y no reciben seguimiento

### Industrias típicas
Inmobiliarias · Agencias · SaaS · Instituciones educativas · Seguros · Financieras · Consultoras

### Flujo de conversación
```
Usuario expresa interés
    └─→ calificar: preguntar necesidad, presupuesto, urgencia
            └─→ presentar opciones según perfil
                    └─→ capturar datos (nombre, email, teléfono)
                            └─→ registrar_lead(datos, score, etapa)
                                    └─→ notificar al equipo comercial
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Claude Sonnet |
| Temperatura | 0.5 – 0.7 |
| Historial | 8–10 turnos |
| Max tokens salida | 250 |
| Function calling | Sí — escritura en CRM |

### Tools típicas
```typescript
buscar_productos(criterios: { presupuesto, tipo, zona? })
registrar_lead(nombre, email, telefono, interes, score)
notificar_vendedor(lead_id, resumen_conversacion)
consultar_disponibilidad_demo(fecha?)
```

### Precios
- Setup: $500 – $1000
- Mensualidad: $120 – $250
- Costo IA estimado: $8 – $18/mes

### Riesgos de diseño
- Temperatura alta puede hacer que el bot prometa cosas que no puede cumplir
- El tono vendedor mal calibrado aleja en vez de atraer
- No forzar la captura de datos demasiado temprano — primero valor, después datos

---

## Arquetipo 4 — Soporte & Postventa

### Qué hace
Accede a múltiples sistemas para resolver problemas: estado de pedido, historial de compras, políticas de devolución. Cuando no puede resolver, escala con todo el contexto al agente humano.

### Señales que lo identifican
- Alto volumen de consultas de estado de pedido
- Agentes humanos repiten siempre los mismos pasos para resolver
- Reclamos que tardan mucho en resolverse
- Clientes frustrados por tener que repetir su problema cada vez que contactan

### Industrias típicas
Ecommerce · Logística · Telecomunicaciones · Bancos · Seguros · Servicios de streaming

### Flujo de conversación
```
Usuario reporta problema
    └─→ identificar_usuario(datos de contacto)
            └─→ consultar_historial(pedido_id o cuenta)
                    └─→ evaluar situación
                            ├─→ puede resolver → ejecutar solución → confirmar
                            └─→ no puede → preparar contexto completo → escalar
                                    └─→ el agente humano recibe TODO el contexto
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Claude Sonnet |
| Temperatura | 0.2 – 0.4 |
| Historial | 10 turnos |
| Max tokens salida | 250 |
| Function calling | Sí — múltiples sistemas |

### Tools típicas
```typescript
obtener_cliente(email_o_telefono)
consultar_pedido(pedido_id)
consultar_historial_compras(cliente_id)
iniciar_devolucion(pedido_id, motivo)
escalar_a_humano(conversacion_id, resumen, prioridad)
```

### Precios
- Setup: $800 – $1500
- Mensualidad: $200 – $400
- Costo IA estimado: $12 – $25/mes

### Riesgos de diseño
- **El escalado tiene que preservar TODO el contexto** — si el usuario repite su problema, el bot falló
- Si accede a datos incorrectos, el daño a la relación con el cliente es grande
- Siempre confirmar la identidad del usuario antes de mostrar datos sensibles

---

## Arquetipo 5 — Asistente Interno

### Qué hace
El usuario no es el cliente final — es el empleado. Centraliza el conocimiento organizacional: políticas, procedimientos, documentos, respuestas a preguntas frecuentes del equipo.

### Señales que lo identifican
- Empleados nuevos que preguntan siempre lo mismo
- Conocimiento que vive en la cabeza de pocas personas clave
- Procesos aplicados de forma inconsistente entre sucursales o equipos
- RRHH o legales pierden tiempo respondiendo consultas simples

### Industrias típicas
Empresas medianas y grandes · Franquicias · Cadenas de locales · Instituciones educativas · Organizaciones con muchos empleados

### Flujo de conversación
```
Empleado pregunta sobre proceso o política
    └─→ buscar_en_base_conocimiento(query)
            ├─→ encontró → responder citando la fuente
            └─→ no encontró → escalar al área responsable
                    └─→ registrar la pregunta sin respuesta (para mejorar la base)
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Claude Sonnet |
| Temperatura | 0.2 – 0.3 |
| Historial | 8–10 turnos |
| Max tokens salida | 300 |
| Function calling | Sí — búsqueda en documentos (RAG) |

### Tools típicas
```typescript
buscar_documento(query: string, area?: string)
buscar_politica(tema: string)
obtener_procedimiento(nombre: string)
escalar_a_rrhh(pregunta: string, empleado_id: string)
```

### Tecnología adicional requerida
Este arquetipo generalmente requiere **RAG** (Retrieval Augmented Generation): indexar los documentos de la empresa en una base vectorial y buscar en ella antes de responder.

### Precios
- Setup: $600 – $1200 (incluye indexación de documentos)
- Mensualidad: $150 – $350
- Costo IA estimado: $8 – $20/mes

### Riesgos de diseño
- La base de conocimiento debe estar actualizada — información incorrecta a empleados puede tener consecuencias graves
- Sensibilidad de datos internos requiere control de acceso por rol
- Definir proceso claro para actualizar la base cuando cambian políticas

---

## Arquetipo 6 — Transaccional

### Qué hace
El bot más complejo. No solo consulta — también ejecuta acciones reales: crea registros, procesa pagos, genera documentos, coordina entre sistemas. Reemplaza flujos de trabajo completos.

### Señales que lo identifican
- Procesos que hoy requieren intervención humana pero son repetitivos y predecibles
- Trámites simples que igual tienen mucha fricción para el usuario
- Alto volumen de operaciones repetibles (pagos, solicitudes, altas/bajas)
- El costo de procesar cada operación manualmente es significativo

### Industrias típicas
Banca · Salud · Logística · Ecommerce avanzado · Gobierno · Telecomunicaciones

### Flujo de conversación
```
Usuario solicita una acción
    └─→ verificar identidad
            └─→ consultar estado/opciones
                    └─→ presentar al usuario y pedir confirmación explícita
                            └─→ usuario confirma
                                    └─→ ejecutar la acción en el sistema
                                            └─→ confirmar resultado + registrar log
```

### Parámetros recomendados
| Variable | Valor |
|---------|-------|
| Modelo | Claude Sonnet u Opus |
| Temperatura | 0.1 – 0.2 |
| Historial | 20+ con resumen |
| Max tokens salida | 300 |
| Function calling | Sí — encadenado y con escritura |

### Tools típicas
```typescript
verificar_identidad(documento, fecha_nac?)
obtener_cuenta(usuario_id)
consultar_opciones(tipo_operacion, monto?)
ejecutar_operacion(tipo, parametros, confirmacion_usuario)
generar_comprobante(operacion_id)
registrar_log(operacion_id, resultado, timestamp)
```

### Regla crítica de diseño

> **Siempre pedir confirmación explícita antes de ejecutar cualquier acción.**
> El usuario debe decir "sí, confirmo" antes de que el bot escriba en cualquier sistema.
> Sin esto, un error de interpretación tiene consecuencias reales.

### Precios
- Setup: $1000 – $3000
- Mensualidad: $300 – $600
- Costo IA estimado: $20 – $50/mes

### Riesgos de diseño
- **El mayor riesgo:** ejecutar una acción incorrecta — siempre confirmación explícita
- Necesitás manejo exhaustivo de errores y rollback si algo falla a mitad del proceso
- Los logs de cada operación son obligatorios para auditoría

---

## Cuándo un cliente necesita más de un arquetipo

Es común que un cliente combine dos arquetipos. La regla:

**Identificá el arquetipo principal** (el que resuelve el 80% del valor) y arrancá por ahí. Los demás se agregan después cuando el primero está funcionando bien.

### Combinaciones frecuentes

| Combinación | Ejemplo |
|------------|---------|
| FAQ + Turnos | Clínica que informa servicios Y agenda citas |
| FAQ + Ventas | Inmobiliaria que informa propiedades Y captura leads |
| Turnos + Soporte | Gimnasio que agenda clases Y resuelve consultas de socios |
| Soporte + Transaccional | Banco que resuelve consultas Y procesa operaciones simples |

### Cómo cotizar combinaciones

El precio base es el del arquetipo de mayor complejidad, más un incremento por el segundo:
- Arquetipo adicional simple: +30% de la mensualidad
- Arquetipo adicional con integraciones: +50% de la mensualidad
