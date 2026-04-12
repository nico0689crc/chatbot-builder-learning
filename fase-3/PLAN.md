# Fase 3 — Flujos con decisiones (LangGraph JS)

## Contexto del negocio

Antes de arrancar, leé:
- [`docs/arquetipos.md`](../docs/arquetipos.md) — secciones Soporte & Postventa y Asistente Interno
- [`docs/guia-diseno-chatbots.md`](../docs/guia-diseno-chatbots.md) — sección 4 (patrones de function calling)
- [`shared/prompts/system-prompts.md`](../shared/prompts/system-prompts.md) — plantillas Soporte e Interno

Esta fase habilita los arquetipos **Soporte & Postventa** y **Asistente Interno**.
La diferencia con la Fase 2: el bot ahora toma decisiones condicionales reales —
no solo "qué tool usar" sino "qué camino seguir según el resultado".

## Objetivo de la fase

Un graph builder dinámico que genera el grafo LangGraph correcto según el arquetipo.
El mismo endpoint `/chat` sirve a un cliente FAQ y a uno de Soporte sin cambiar código.

## Verificación de prerequisito

```
Mostrá el agente de Fase 2 tomando la decisión correcta entre
verificar_disponibilidad y crear_turno según el contexto.
```

---

## Sesión 7 — Modelo mental de LangGraph (90 min)

**Entregable:** Primer grafo con tres nodos y dos aristas condicionales corriendo.

### Concepto que Claude Code explica primero
```
Dibujá en texto el grafo de estados de un bot de soporte al cliente:

[INICIO] → [evaluar_intencion]
              ↓ puede resolver
           [consultar_herramienta] → [responder] → [FIN]
              ↓ necesita escalar
           [preparar_contexto] → [notificar_equipo] → [FIN]

Después explicame:
1. Qué es el "estado" que viaja por ese grafo
2. Por qué un nodo es una función pura (state) => newState
3. Qué diferencia hay entre una arista normal y una condicional
```

### Ejercicios
- [x] **7.1** Instalar `@langchain/langgraph`
- [x] **7.2** Definir `EstadoBot` con TypeScript
- [x] **7.3** Tres nodos: `evaluarIntencion`, `consultarHerramienta`, `prepararEscalado`
- [x] **7.4** Aristas condicionales según `requiereEscalado`
- [x] **7.5** Compilar y correr el grafo con un mensaje de prueba

### Pregunta de comprensión
¿Por qué el estado es tipado con TypeScript y qué problema evita
cuando tenés 6 arquetipos distintos con estados diferentes?

---

## Sesión 8 — Bot de soporte completo (2 horas)

**Entregable:** Bot que detecta correctamente cuándo escalar vs resolver.

### Concepto que Claude Code explica primero
```
¿Por qué el checkpointer es crítico para el arquetipo Soporte
y no lo era para FAQ?
¿Qué pasaría si un cliente de soporte retoma una conversación
interrumpida sin checkpointer?
```

### Ejercicios
- [x] **8.1** Checkpointer con PostgreSQL (`PostgresSaver`)
- [x] **8.2** Nodo `evaluarIntencion` usando el modelo de IA
- [x] **8.3** Tools de soporte: `obtener_pedido`, `iniciar_devolucion`, `escalar_a_humano`
- [x] **8.4** `ToolNode` integrado en el grafo

### Casos de prueba obligatorios
```
"Mi pedido no llegó"          → consulta estado → responde o escala según resultado ✓
"¿Cuál es el horario?"        → responde directo sin tool ✓
"Quiero hablar con alguien"   → escala inmediatamente ✓
"Quiero hacer una devolución" → consulta políticas → ejecuta o escala ✓
```

---

## Sesión 9 — Graph Builder dinámico (90 min)

**Entregable:** Una función que genera el grafo correcto según el arquetipo del cliente.

### Concepto que Claude Code explica primero
```
¿Cómo conecta el graph builder con el multi-tenant?
Mostrá cómo el mismo endpoint /chat sirve a un cliente FAQ
y a uno de Soporte usando el graph builder.
¿Qué pasa si se agrega un arquetipo nuevo — cuántas líneas hay que tocar?
```

### Ejercicios
- [ ] **9.1** `src/services/graph-builder.service.ts` con switch por arquetipo
- [ ] **9.2** `construirGrafoFAQ` — grafo simple de dos nodos
- [ ] **9.3** `construirGrafoSoporte` — grafo con bifurcaciones
- [ ] **9.4** Actualizar el endpoint `/chat` para usar el graph builder
- [ ] **9.5** Prueba: mismo endpoint, cliente FAQ vs cliente Soporte

---

## Checklist de la Fase 3

- [x] Primer grafo con tres nodos y aristas condicionales
- [x] Bot de soporte detectando cuándo escalar correctamente
- [x] Checkpointer guardando estado en PostgreSQL
- [ ] Human-in-the-loop pausando el grafo en acciones críticas
- [ ] Graph builder generando grafos distintos para FAQ y Soporte
- [ ] Mismo endpoint sirve a ambos arquetipos correctamente

**Con esta fase podés ofrecer arquetipos Soporte & Postventa y Asistente Interno.**
