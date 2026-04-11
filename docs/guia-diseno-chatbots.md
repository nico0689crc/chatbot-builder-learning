# Guía de Diseño de Chatbots
### Desde el Discovery hasta la Medición

> Marco metodológico para el diseño, parametrización y evaluación
> de chatbots inteligentes con IA generativa.

---

## Índice

1. [Qué es un chatbot con IA generativa](#1-qué-es-un-chatbot-con-ia-generativa)
2. [Los 6 arquetipos de chatbots](#2-los-6-arquetipos-de-chatbots)
3. [Las 9 variables que determinan calidad y costo](#3-las-9-variables-que-determinan-calidad-y-costo)
4. [Function Calling — cómo el bot accede a datos externos](#4-function-calling)
5. [Metodología: Design Thinking aplicado a chatbots](#5-metodología-design-thinking)
6. [Estimación de costos de IA](#6-estimación-de-costos)
7. [Tabla de decisión por arquetipo](#7-tabla-de-decisión-por-arquetipo)
8. [Checklist de diseño por etapa](#8-checklist-de-diseño)
9. [Principios que no cambian con la tecnología](#9-principios-fundamentales)

---

## 1. Qué es un chatbot con IA generativa

Un chatbot con IA generativa mantiene conversaciones en lenguaje natural usando un modelo de lenguaje (LLM) como motor. A diferencia de los chatbots tradicionales basados en reglas, comprende contexto, maneja variaciones del lenguaje y responde preguntas que no fueron explícitamente programadas.

### El principio fundamental

**La IA no tiene memoria entre conversaciones.** En cada turno, el sistema construye un paquete de contexto con tres elementos:

| Componente | Qué es | Quién lo controla |
|-----------|--------|-------------------|
| **System prompt** | Identidad, personalidad y reglas del bot. Se define una vez por cliente. | Vos (el diseñador) |
| **Historial reciente** | Los últimos N mensajes del intercambio actual. Crea la ilusión de memoria. | Tu backend |
| **Mensaje nuevo** | Lo que el usuario acaba de escribir. Se agrega al final del historial. | El usuario |

Este paquete completo se envía al modelo en **cada llamada**. La IA genera una respuesta y el sistema guarda ambos turnos para que formen parte del historial en los próximos mensajes.

### Componentes del sistema

| Componente | Función |
|-----------|---------|
| Motor de IA (LLM) | Genera respuestas en lenguaje natural |
| System prompt | Define personalidad, reglas y conocimiento del negocio |
| Historial de conversación | Provee memoria temporal dentro de la sesión |
| Base de datos | Guarda conversaciones, configuración y analytics |
| Caché (Redis) | Acelera el acceso al historial reciente |
| Canales | Web, WhatsApp, Instagram — puntos de contacto |
| Function calling | Permite consultar datos externos en tiempo real |

---

## 2. Los 6 arquetipos de chatbots

Los clientes presentan problemas distintos que se agrupan en patrones reconocibles. Identificar el arquetipo en los primeros 15 minutos de una reunión permite aplicar un marco probado.

> Ver [`arquetipos.md`](arquetipos.md) para el detalle completo de cada uno.

### Resumen comparativo

| Arquetipo | Función principal | Function calling | Complejidad | Precio mensual |
|-----------|------------------|-----------------|-------------|----------------|
| **FAQ & Info** | Responde preguntas con info estática | No | Básica | $50–100 |
| **Agenda & Turnos** | Consulta disponibilidad y gestiona reservas | Sí | Media | $100–200 |
| **Ventas & Captación** | Califica leads y captura intención de compra | Sí | Media | $120–250 |
| **Soporte & Postventa** | Resuelve problemas y consulta estado de pedidos | Sí | Alta | $200–400 |
| **Asistente Interno** | Ayuda a empleados con conocimiento organizacional | Sí | Alta | $150–350 |
| **Transaccional** | Ejecuta acciones reales en sistemas del negocio | Sí | Muy alta | $300–600 |

### Señales para identificar el arquetipo en la reunión

**FAQ & Info:** El equipo responde siempre las mismas preguntas. No necesitan consultar un sistema para hacerlo. Alto volumen de consultas repetidas.

**Agenda & Turnos:** Muchas consultas de disponibilidad por WhatsApp. Reservas que se hacen por teléfono o mensaje manual. Cancelaciones de último momento sin aviso.

**Ventas & Captación:** Muchos visitantes web que no convierten. Equipo comercial pierde tiempo con leads no calificados. Consultas fuera del horario comercial.

**Soporte & Postventa:** Alto volumen de consultas de estado de pedido. Agentes humanos repiten siempre los mismos pasos. Reclamos que tardan en resolverse.

**Asistente Interno:** Empleados nuevos preguntan siempre lo mismo. Conocimiento que vive en pocas personas clave. Procesos aplicados de forma inconsistente.

**Transaccional:** Procesos que hoy requieren intervención humana pero son repetitivos y predecibles. Trámites simples con mucha fricción. Alto volumen de operaciones repetibles.

---

## 3. Las 9 variables que determinan calidad y costo

Estas variables son las que permiten diseñar planes diferenciados y justificar distintos precios.

### Variable 1 — Modelo de IA

El motor que genera las respuestas. La decisión de mayor impacto porque multiplica el efecto de todas las demás.

| Modelo | Costo input /M tokens | Costo output /M tokens | Cuándo usarlo |
|--------|----------------------|----------------------|---------------|
| Claude Haiku | $0.80 | $4.00 | Preguntas simples, dominio cerrado, FAQ, turnos básicos |
| Claude Sonnet | $3.00 | $15.00 | Contexto ambiguo, ventas, soporte, múltiples intenciones |
| Claude Opus | $15.00+ | $75.00+ | Razonamiento complejo, decisiones críticas, transaccional |
| GPT-4o mini | $0.15 | $0.60 | Alternativa económica para flujos simples |

### Variable 2 — Temperatura

Controla qué tan predecibles o creativas son las respuestas. **No afecta el costo.**

| Rango | Comportamiento | Casos de uso |
|-------|---------------|-------------|
| 0.0 – 0.3 | Estricto y predecible. Nunca improvisa. | Turnos, precios, info exacta, bots transaccionales |
| 0.4 – 0.6 | Natural pero confiable. El punto medio ideal. | Atención general, soporte, asistente interno |
| 0.7 – 1.0 | Creativo y variado. Más "humano". | Ventas, engagement de marca, bots conversacionales |

> ⚠️ **No usar temperatura alta (>0.7) en bots que ejecutan acciones.** El riesgo de respuestas imprecisas aumenta significativamente.

### Variable 3 — Tamaño del historial

La cantidad de turnos anteriores enviados en cada llamada. **Es la variable que más impacta el costo real** porque se paga en cada mensaje.

- Cada turno del historial = tokens de entrada adicionales en cada llamada
- Con 10 turnos de ~50 palabras cada uno = ~500 palabras extra por llamada
- **Recomendación inicial:** 6 a 10 turnos
- **Para planes premium:** implementar memoria con resumen (comprime turnos antiguos)

### Variable 4 — Largo del system prompt

El system prompt se envía **completo en cada llamada**. Un prompt de 800 palabras se paga multiplicado por cada mensaje de cada usuario.

- Un prompt bien escrito de 200 palabras supera a uno descuidado de 800
- Incluir solo lo que el bot necesita saber
- Evitar redundancias e instrucciones que no aplican al caso real

### Variable 5 — Max tokens de salida

Límite máximo de tokens que puede generar la IA en cada respuesta.

- Para la mayoría de bots de negocio: **150–250 tokens** es el rango ideal
- Respuestas largas en WhatsApp generan abandono
- Bots de asesoramiento pueden necesitar 500–1000 tokens

### Variable 6 — Top-P (nucleus sampling)

Controla el vocabulario disponible para el modelo. Complementa a la temperatura.

- **Top-P 0.85–0.90:** respuestas más enfocadas y predecibles
- **Top-P 1.0:** máxima expresividad
- Regla práctica: ajustar temperatura **o** Top-P — no los dos al mismo tiempo

### Variable 7 — Prompt caching

Funcionalidad de Anthropic que cachea el system prompt. Las llamadas siguientes pagan solo el **10% del costo original**.

> 💡 **Ejemplo de ahorro:** System prompt de 500 palabras · 10.000 mensajes/mes → Sin caching: $4.00. Con caching: $0.40. A 20 clientes: $72/mes de ahorro.

### Variable 8 — Volumen de conversaciones

El costo escala linealmente con el uso. Define el modelo de precios por plan:

- Plan básico: hasta 500 conversaciones/mes
- Plan estándar: hasta 2.000 conversaciones/mes
- Plan premium: ilimitado (con costo variable transparente)

### Variable 9 — Tipo y cantidad de integraciones

Determina si el bot puede consultar datos externos. **Es la variable que más impacta en el valor percibido.**

| Tipo de conector | Complejidad | Cuándo usarlo |
|-----------------|-------------|---------------|
| Sin integración | Ninguna | FAQ, info estática |
| Google Sheets | Baja | Clientes sin sistema propio |
| API REST | Media | Cliente con sistema moderno |
| BD directa | Media-Alta | Sin API, solo acceso a datos |
| CRM/ERP | Alta | Integración con sistema central |
| Múltiples encadenadas | Muy Alta | Bots transaccionales |

---

## 4. Function Calling

Function calling es el mecanismo que permite al bot consultar información en tiempo real antes de responder.

**Principio fundamental:** La IA nunca accede directamente a ninguna base de datos. El flujo siempre es:

```
1. El bot detecta que necesita datos externos
2. La IA devuelve el nombre de la función y los parámetros
3. Tu backend ejecuta la función
4. El resultado vuelve a la IA
5. La IA formula la respuesta con el dato real
```

### Los tres patrones de function calling

#### Patrón 1 — Consulta simple
```
Usuario:  "¿Qué stock tienen del producto X?"
Bot llama: consultar_stock(producto_id: "X")
BD devuelve: { stock: 14, precio: 2500 }
Bot responde: "Tenemos 14 unidades disponibles a $2.500."
```

#### Patrón 2 — Consulta con decisión
```
Usuario:  "Quiero reservar mesa para 6 personas mañana a las 9pm"
Bot llama: verificar_disponibilidad(fecha, hora, personas)
BD devuelve: { disponible: false, proximos: ["20:00", "21:30"] }
Bot responde: "No tenemos mesa para 6 a las 21hs, pero sí a las 20hs o 21:30.
              ¿Alguna te viene bien?"
```

#### Patrón 3 — Múltiples funciones encadenadas
```
Usuario:  "¿Puedo pagar mi deuda en cuotas?"
Bot llama: obtener_cuenta(usuario_id) → { deuda: 45000, estado: "activo" }
Bot llama: planes_cuotas(monto: 45000) → [{ cuotas: 3, valor: 15300 }, ...]
Bot responde: "Tu deuda es $45.000. Podés pagarlo en 3 cuotas de $15.300
              o 6 de $8.100. ¿Cuál preferís?"
```

### Diseño del catálogo de funciones

Cada función tiene tres componentes. **La descripción es la más crítica** — es lo que la IA lee para decidir cuándo usarla.

```
nombre:      consultar_turno
descripción: "Usa cuando el usuario pregunte si tiene turno agendado,
              cuándo es su próxima cita, o quiera ver sus reservas.
              NO la uses si el usuario quiere crear un turno nuevo."
parámetros:  { usuario_id: string, fecha_desde: date, fecha_hasta: date }
```

---

## 5. Metodología: Design Thinking

El proceso de diseño sigue cinco etapas. **La etapa de empatía es la más importante y la más frecuentemente salteada.**

### Etapa 1 — Empatizar (discovery)

**Duración:** 45–60 minutos. **Regla de oro:** No menciones IA ni chatbots hasta entender el problema.

#### Bloque 1 — El negocio y su operación
- ¿Cómo es un día típico de atención al cliente?
- ¿Cuántas consultas reciben por día/semana? ¿Por qué canal?
- ¿Quién responde hoy? ¿Cuánto tiempo les toma?
- ¿Qué pasa si alguien consulta a las 10 de la noche?

#### Bloque 2 — Las conversaciones reales
- **¿Pueden mostrarme los últimos 20–30 mensajes que recibieron?** ← el momento más valioso
- ¿Cuáles son las 5 preguntas que reciben siempre?
- ¿Hay preguntas que requieren consultar algo antes de responder?
- ¿Hay casos donde la respuesta depende del perfil del cliente?

#### Bloque 3 — Límites y contexto
- ¿Qué temas no quieren que responda el bot?
- ¿Qué sistemas usan hoy? (CRM, planillas, software propio)
- ¿Cómo habla su marca? ¿Hay palabras que no usarían nunca?

> **Artefacto de cierre:** Resumen de una página con volumen de consultas, top 5 preguntas, sistemas que usan y casos límite. Enviarlo por email para validar comprensión.

---

### Etapa 2 — Definir

Convertir lo escuchado en decisiones concretas de diseño.

| Decisión | Pregunta | Output |
|---------|---------|--------|
| Tipo de bot | ¿Informativo, consultivo o transaccional? | Arquetipo + plan |
| Herramientas | ¿Qué preguntas requieren datos externos? | Listado de funciones |
| Escalado | ¿Cuándo el bot deriva a un humano? | Reglas documentadas |
| Parámetros IA | ¿Qué modelo, temperatura, historial? | Estimación de costo |

> **Artefacto de cierre:** Documento de 1–2 páginas: tipo de bot, funciones (si aplica), condiciones de escalado, parámetros y estimación de costo. **Base de la propuesta comercial.**

---

### Etapa 3 — Idear

Diseñar el flujo de conversación antes de construir nada.

#### Cómo hacer el mapa de conversación
1. Listar todos los puntos de entrada posibles
2. Para cada pregunta frecuente, dibujar el flujo: ¿necesita datos? → función → respuesta
3. Marcar los puntos de escalado con el mecanismo exacto
4. Diseñar mensajes de error y casos borde

#### El system prompt como artefacto de diseño
- **Identidad:** nombre del bot, rol, a qué negocio pertenece
- **Tono:** formal/informal, ejemplos de frases que usaría y no usaría
- **Conocimiento:** datos clave, precios, horarios, servicios, FAQs
- **Límites:** qué temas no puede tocar, cuándo derivar
- **Escalado:** condiciones exactas y cómo comunicarlas

> **Artefacto de cierre:** Mapa de conversación validado + borrador de system prompt + listado de funciones con parámetros.

---

### Etapa 4 — Prototipar

Bot mínimo funcional en 1–2 semanas. **El objetivo no es perfección — es aprender lo antes posible.**

**Semana 1:** Bot básico con system prompt, sin integraciones, canal principal conectado. Sesión de prueba con el cliente.

**Semana 2:** Ajuste del system prompt con lo que apareció en las pruebas. Integración más importante si el plan la incluye. Definir grupo piloto.

> ⚠️ **El prototipo siempre tendrá imperfecciones.** Mejor descubrirlas con 10 personas que con todo el universo de clientes.

---

### Etapa 5 — Medir y ajustar

**Esta etapa es lo que justifica la mensualidad.** El bot nunca está terminado.

#### KPIs que le importan al cliente

| Métrica | Descripción | Meta inicial | Meta madura |
|---------|------------|-------------|------------|
| Tasa de resolución autónoma | % resuelto sin humano | 60% | 80%+ |
| Consultas fuera de horario | Resueltas por el bot solo | > 0 | Todas |
| Tiempo de respuesta | Bot vs humano anterior | < 5 seg | < 3 seg |
| Escalados a humano | Cuántas veces derivó | < 20% | < 10% |
| Preguntas sin respuesta | Las que el bot no manejó | Registrar | 0 conocidas |
| Satisfacción del usuario | "¿Te ayudamos?" Sí/No | > 70% | > 85% |

#### El reporte mensual al cliente

Una página. No más. Incluye:
- Total de conversaciones del mes
- Tasa de resolución autónoma
- Consultas resueltas fuera de horario
- Top 3 preguntas del mes
- Mejoras aplicadas este período

> 💡 **El reporte mensual es lo que hace que el cliente renueve sin cuestionarlo.** No es soporte — es demostración continua de valor.

---

## 6. Estimación de costos

### Fórmula de estimación mensual

| Variable | Ejemplo | Cálculo |
|---------|---------|---------|
| Conversaciones/día | 50 | Dato del cliente |
| Turnos promedio | 8 | Según arquetipo |
| Llamadas/mes | 12.000 | 50 × 8 × 30 |
| Tokens input/llamada | ~1.200 | System prompt + historial + mensaje |
| Tokens output/llamada | ~200 | Respuesta típica |
| **Costo con Haiku** | **~$2–5 USD** | **Por cliente activo/mes** |

### Margen por plan

| Plan | Precio mensual | Costo IA | Costo hosting | Margen |
|------|--------------|---------|--------------|--------|
| Básico (FAQ) | $80 | $2–5 | $3 | ~90% |
| Estándar | $150 | $8–15 | $5 | ~85% |
| Premium | $300 | $15–30 | $8 | ~82% |
| Enterprise | $500+ | $30–60 | $10 | ~80% |

### Palancas para controlar el costo

1. Reducir el tamaño del historial
2. Elegir el modelo más simple que resuelva el caso
3. Optimizar el system prompt (más conciso = menos tokens fijos)
4. Activar prompt caching (ahorra ~90% del costo del prompt)
5. Definir límites de conversaciones por plan

---

## 7. Tabla de decisión por arquetipo

Referencia rápida para configurar cada tipo de bot.

| Arquetipo | Modelo | Temp. | Historial | Max tokens | Function calling | Setup | Mensual |
|-----------|--------|-------|-----------|-----------|-----------------|-------|---------|
| FAQ & Info | Haiku | 0.2–0.4 | 4–6 turnos | 150 | No | $200–400 | $50–100 |
| Agenda & Turnos | Haiku/Sonnet | 0.2–0.3 | 6–8 turnos | 200 | Sí (lectura) | $400–800 | $100–200 |
| Ventas | Sonnet | 0.5–0.7 | 8–10 turnos | 250 | Sí (escritura) | $500–1000 | $120–250 |
| Soporte | Sonnet | 0.2–0.4 | 10 turnos | 250 | Sí (múltiple) | $800–1500 | $200–400 |
| Interno | Sonnet | 0.2–0.3 | 8–10 turnos | 300 | Sí (búsqueda) | $600–1200 | $150–350 |
| Transaccional | Sonnet/Opus | 0.1–0.2 | 20+ con resumen | 300 | Sí (encadenado) | $1000–3000 | $300–600 |

---

## 8. Checklist de diseño

### Discovery (Empatía)
- [ ] Realicé la reunión sin mencionar tecnología en la primera mitad
- [ ] Conseguí ver conversaciones reales del cliente
- [ ] Identifiqué las 5–10 preguntas más frecuentes
- [ ] Entendí qué sistemas usan hoy
- [ ] Pregunté qué NO quieren que responda el bot
- [ ] Pregunté cómo mide el cliente el éxito del proyecto
- [ ] Envié el resumen para validación

### Definición
- [ ] Identifiqué el arquetipo principal
- [ ] Definí si necesita function calling y de qué tipo
- [ ] Documenté las condiciones de escalado
- [ ] Elegí el modelo y calculé el costo estimado
- [ ] Determiné el plan y el precio

### Ideación
- [ ] Dibujé el mapa de conversación
- [ ] Incluí casos borde y mensajes de error
- [ ] Escribí el borrador del system prompt
- [ ] Validé el mapa y el prompt con el cliente
- [ ] Documenté el catálogo de funciones (si aplica)

### Prototipo
- [ ] Bot básico funcionando con el system prompt validado
- [ ] Canal principal conectado
- [ ] Sesión de prueba realizada con el cliente
- [ ] Ajustes post-prueba aplicados
- [ ] Grupo piloto definido

### Medición
- [ ] KPIs acordados antes del lanzamiento
- [ ] Dashboard o reporte mensual configurado
- [ ] Proceso de actualización del system prompt documentado
- [ ] Ciclo de revisión mensual agendado

---

## 9. Principios fundamentales

Estos principios no cambian con la tecnología ni con el cliente.

### 1. El problema primero
El chatbot es la solución, no el objetivo. Entender el problema real del cliente es lo que determina si un bot tiene sentido y qué tipo construir.

### 2. Empezar simple, escalar con evidencia
Un bot básico bien configurado entrega más valor que uno complejo mal diseñado. Agregar complejidad solo cuando el uso real lo justifique.

### 3. Los límites son tan importantes como las capacidades
Definir qué NO hace el bot es parte del diseño. Un bot que intenta responder todo y falla es peor que uno que responde poco y siempre acierta.

### 4. El ajuste continuo es el producto real
El setup inicial es el 30% del trabajo. El 70% son los ajustes mensuales basados en conversaciones reales. Eso es lo que justifica la mensualidad.

### 5. Las métricas del cliente, no las técnicas
Al cliente no le importa la latencia ni los tokens. Le importa cuántas horas libera su equipo, cuántos leads captura fuera de horario y si sus clientes quedan satisfechos.
