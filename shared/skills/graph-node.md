# SKILL: graph-node

## Cuándo leer este archivo

Leé este archivo antes de agregar o modificar nodos en un grafo LangGraph.
Aplica cuando el usuario pide:
- "Agregá un nodo para [comportamiento nuevo]"
- "El bot tiene que hacer [cosa] antes de responder"
- "Necesito que el bot tome una decisión sobre [condición]"
- "Modificá el flujo del arquetipo [X]"

---

## Modelo mental: el grafo como flujo de estados

Cada conversación es un objeto de estado que viaja por nodos.
Cada nodo recibe el estado, hace algo, y devuelve el estado modificado.
Las aristas definen a qué nodo ir según el resultado.

```
EstadoBot viaja por:
  [nodo A] → transforma estado → [arista decide] → [nodo B o C]
```

Lo que el estado contiene define lo que los nodos pueden hacer.
Si un nodo necesita saber algo, tiene que estar en el estado.

---

## Estructura de archivos del grafo

```
src/
  ia/
    grafos/
      base.graph.ts           ← tipos de estado compartidos
      faq.graph.ts            ← grafo del arquetipo FAQ
      turnos.graph.ts         ← grafo del arquetipo Turnos
      soporte.graph.ts        ← grafo del arquetipo Soporte
      [arquetipo].graph.ts    ← un archivo por arquetipo
    graph-builder.service.ts  ← selecciona qué grafo usar según el cliente
```

---

## Plantilla de estado — extender según el arquetipo

```typescript
// src/ia/grafos/base.graph.ts
import { BaseMessage } from '@langchain/core/messages'

// Estado base — todos los grafos lo tienen
export interface EstadoBase {
  mensajes:   BaseMessage[]  // historial de la conversación
  clienteId:  string         // qué cliente es — para cargar config
  usuarioId:  string         // quién está chateando
  canal:      string         // web | whatsapp
}

// Estado extendido para arquetipos con decisiones
export interface EstadoConDecision extends EstadoBase {
  intencion:        string | null    // qué quiere el usuario
  requiereEscalado: boolean          // ¿necesita un humano?
  contextoEscalado: string | null    // resumen para el agente humano
  iteraciones:      number           // evitar loops infinitos
}

// Estado extendido para arquetipos transaccionales
export interface EstadoTransaccional extends EstadoConDecision {
  usuarioVerificado:    boolean       // pasó la verificación de identidad
  accionPendiente:      string | null // qué operación está por ejecutar
  confirmacionRecibida: boolean       // el usuario confirmó la acción
  resultadoOperacion:   string | null // resultado de la última operación
}
```

---

## Plantilla de nodo — seguir siempre este patrón

```typescript
// Un nodo es una función pura: recibe estado → devuelve estado parcial
async function [nombreNodo](
  estado: [TipoDeEstado]
): Promise<Partial<[TipoDeEstado]>> {

  // 1. Leer lo que necesitás del estado
  const { mensajes, clienteId } = estado

  try {
    // 2. Hacer la operación del nodo
    // Puede ser: llamar al modelo, ejecutar una tool, tomar una decisión, etc.
    const resultado = await [operacion]()

    // 3. Devolver solo los campos del estado que este nodo modifica
    // NO devolver el estado completo — solo el delta
    return {
      [campoModificado]: resultado,
      iteraciones: (estado.iteraciones || 0) + 1,
    }

  } catch (error) {
    console.error(`Error en nodo [nombreNodo]:`, error)

    // En caso de error, siempre devolver un estado válido
    // Nunca dejar que el grafo quede en estado inconsistente
    return {
      requiereEscalado: true,
      contextoEscalado: `Error en el sistema: ${error.message}`,
    }
  }
}
```

---

## Tipos de nodos y cuándo usar cada uno

### Nodo de modelo — llama a la IA para generar respuesta
```typescript
async function generarRespuesta(estado: EstadoBase) {
  const config = await cargarConfigCliente(estado.clienteId)
  const modelo = new ChatAnthropic({ model: config.modelo, temperature: config.temperatura })
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', config.systemPrompt],
    new MessagesPlaceholder('mensajes'),
  ])
  const chain = prompt | modelo
  const respuesta = await chain.invoke({ mensajes: estado.mensajes })
  return { mensajes: [...estado.mensajes, respuesta] }
}
```

### Nodo de decisión — evalúa el estado y decide el camino
```typescript
async function evaluarIntencion(estado: EstadoConDecision) {
  // Usar el modelo para clasificar la intención
  // O usar lógica determinista si el criterio es claro
  const intencion = await clasificarIntencion(estado.mensajes.at(-1))
  const requiereEscalado = intencion === 'queja_formal' || intencion === 'urgencia'
  return { intencion, requiereEscalado }
}
```

### Nodo de tool — ejecuta una función externa
```typescript
// Para tools en LangGraph, usar ToolNode de LangGraph directamente
import { ToolNode } from '@langchain/langgraph/prebuilt'
const toolNode = new ToolNode([verificarDisponibilidad, crearTurno])
// toolNode es un nodo que se agrega al grafo como cualquier otro
```

### Nodo de escalado — prepara el contexto para el humano
```typescript
async function prepararEscalado(estado: EstadoConDecision) {
  const resumen = await generarResumenConversacion(estado.mensajes)
  await notificarEquipo(estado.clienteId, resumen, estado.intencion)
  return {
    contextoEscalado: resumen,
    mensajes: [...estado.mensajes, new AIMessage(
      'Te estoy conectando con uno de nuestros asesores. ' +
      'Ya le pasé el contexto de tu consulta para que no tengas que repetir todo.'
    )]
  }
}
```

---

## Proceso para agregar un nodo nuevo

1. **Definir qué hace el nodo** — una sola responsabilidad
2. **Definir qué necesita del estado** — qué campos lee
3. **Definir qué modifica en el estado** — qué campos devuelve
4. **Actualizar el tipo de estado** si el nodo necesita campos nuevos
5. **Escribir el nodo** siguiendo la plantilla
6. **Agregar al grafo:**

```typescript
// En [arquetipo].graph.ts
graph.addNode('nombre_nodo', nombreNodo)

// Conectar con aristas
graph.addEdge('nodo_anterior', 'nombre_nodo')

// O con arista condicional
graph.addConditionalEdges(
  'nodo_anterior',
  (estado) => estado.condicion ? 'nombre_nodo' : 'otro_nodo'
)
```

7. **Probar el nuevo camino** con un mensaje que lo active

---

## Reglas para aristas condicionales

```typescript
// La función de condición recibe el estado y devuelve un string
// que identifica el siguiente nodo
graph.addConditionalEdges(
  'nodo_origen',
  (estado: EstadoConDecision): string => {
    // Retornar el nombre del nodo destino como string
    if (estado.requiereEscalado) return 'preparar_escalado'
    if (estado.intencion === 'consulta_datos') return 'ejecutar_tool'
    if (estado.iteraciones > 5) return 'responder_final'  // evitar loops
    return 'generar_respuesta'
  },
  // Mapa de posibles destinos — ayuda a LangGraph a construir el grafo
  {
    preparar_escalado:  'preparar_escalado',
    ejecutar_tool:      'ejecutar_tool',
    responder_final:    'responder_final',
    generar_respuesta:  'generar_respuesta',
  }
)
```

**Siempre incluir un caso de salida para iteraciones excesivas.**
Sin esto, un loop mal diseñado puede correr indefinidamente.

---

## Checklist antes de publicar un grafo modificado

- [ ] El nuevo nodo tiene try/catch y maneja errores gracefully
- [ ] El estado está tipado correctamente — sin `any`
- [ ] Las aristas condicionales tienen todos los casos cubiertos
- [ ] Hay un límite de iteraciones para evitar loops
- [ ] El checkpointer sigue funcionando con el estado extendido
- [ ] Se probaron los caminos nuevos con mensajes reales
- [ ] El grafo se compila sin errores: `.compile()` no tira excepciones
