# SKILL: tool-creator

## Cuándo leer este archivo

Leé este archivo completo antes de crear cualquier tool de LangChain
en el builder. Aplica cuando el usuario pide:
- "Creá una tool para [función]"
- "Necesito que el bot pueda [acción que requiere datos externos]"
- "Agregá function calling para [caso de uso]"

---

## Qué es una tool en este proyecto

Una tool es una función que el agente LangChain puede decidir llamar
cuando necesita datos externos para responder. El agente no la llama
siempre — decide cuándo usarla en base a su descripción.

La descripción es lo más importante. Si está mal redactada, el agente
llama a la tool cuando no debe, o no la llama cuando debe.

---

## Estructura de archivos

```
src/
  services/
    tools/
      [arquetipo].tools.ts     ← tools agrupadas por arquetipo
      index.ts                 ← exporta todas las tools del proyecto
```

Ejemplos de nombres:
- `turnos.tools.ts` — tools del arquetipo Agenda & Turnos
- `ventas.tools.ts` — tools del arquetipo Ventas & Captación
- `soporte.tools.ts` — tools del arquetipo Soporte & Postventa

---

## Plantilla de tool — seguir siempre este patrón

```typescript
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const [NOMBRE_TOOL] = tool(
  async ({ [PARAM1], [PARAM2] }, runManager) => {
    try {
      // 1. Lógica de negocio — consultar DB, API externa, etc.
      const resultado = await prisma.[modelo].findMany({
        where: { /* condiciones */ }
      })

      // 2. Si no hay resultado, responder claramente
      if (!resultado.length) {
        return 'No se encontraron resultados para esa consulta.'
      }

      // 3. Formatear el resultado como texto legible para la IA
      // La IA recibe este string y lo usa para formular la respuesta
      return `Se encontró: ${JSON.stringify(resultado)}`

    } catch (error) {
      // 4. Siempre manejar errores — nunca dejar que rompan el grafo
      console.error(`Error en [NOMBRE_TOOL]:`, error)
      return 'Hubo un error al consultar la información. Por favor intentá de nuevo.'
    }
  },
  {
    name: '[nombre_snake_case]',

    // La descripción le dice a la IA CUÁNDO usar esta tool
    // Formato ideal: qué hace + cuándo usarla + cuándo NO usarla
    description: `[Qué hace esta tool en una oración].
      Usá esta función cuando el usuario [condición de uso].
      NO la uses cuando [condición de no uso].`,

    // El schema define qué parámetros extrae la IA del mensaje del usuario
    // Cada campo tiene una descripción que guía la extracción
    schema: z.object({
      [PARAM1]: z.string().describe('[qué es este parámetro y cómo extraerlo del mensaje]'),
      [PARAM2]: z.string().optional().describe('[parámetro opcional — cuándo se incluye]'),
    }),
  }
)
```

---

## Reglas críticas de diseño

### La descripción
- Siempre incluir cuándo usarla Y cuándo NO usarla
- Usar lenguaje específico, no genérico — "cuando el usuario pregunte por disponibilidad de turnos" no "cuando el usuario necesite información"
- Máximo 4 líneas — si necesitás más, la tool está haciendo demasiado

### El schema (zod)
- Cada campo necesita `.describe()` con instrucciones para la IA
- Usar `.optional()` solo cuando el parámetro genuinamente no siempre está
- Preferir `z.string()` sobre `z.enum()` — la IA extrae mejor strings libres
- Incluir ejemplos en el `.describe()` cuando el formato importa: `ej: "2024-03-15", "mañana", "el lunes"`

### El handler (la función)
- Siempre en `try/catch` — los errores nunca deben romper el grafo
- Siempre retornar strings — la IA recibe el retorno como texto
- Si no hay resultado: retornar un mensaje claro, no null ni undefined
- Formatear el resultado de forma legible — no dump de JSON crudo

### Una tool = una responsabilidad
- Cada tool hace UNA cosa
- Si una tool necesita hacer dos cosas, son dos tools
- El agente decide cuál usar — no la tool decidir internamente

---

## Proceso para crear una tool nueva

Cuando el usuario pida crear una tool:

1. **Entender el caso de uso:** ¿Qué información necesita el bot? ¿De dónde viene?
2. **Redactar la descripción primero** — antes del código. Preguntarle al usuario cómo quiere que el bot decida cuándo usarla.
3. **Definir el schema** — qué parámetros extrae la IA del lenguaje natural.
4. **Escribir el handler con datos ficticios primero** — verificar que el agente la llama correctamente.
5. **Conectar a datos reales** — reemplazar los ficticios por Prisma/API/Sheets.
6. **Probar los casos borde** — sin resultados, error de conexión, parámetros ambiguos.

---

## Ejemplos de descripciones buenas vs malas

### Tool de verificar disponibilidad de turnos

❌ **Mala:**
```
Verifica disponibilidad.
```

❌ **Mala:**
```
Usa esta función para verificar si hay turnos disponibles
cuando el usuario necesite información sobre turnos.
```

✅ **Buena:**
```
Consulta los horarios disponibles en la agenda de la clínica para una fecha específica.
Usá esta función cuando el usuario pregunte si hay turnos libres, qué horarios
tienen disponibles, o quiera saber cuándo puede sacar un turno.
NO la uses si el usuario ya eligió un horario y quiere confirmar o crear el turno.
```

---

## Cómo agregar la tool al agente del arquetipo

Después de crear la tool, agregarla en el módulo de IA correspondiente:

```typescript
// src/ia/grafos/[arquetipo].graph.ts
import { verificarDisponibilidad, crearTurno } from '../tools/turnos.tools'

// El array de tools se pasa al agente o al ToolNode del grafo
const tools = [verificarDisponibilidad, crearTurno]
```

Y registrarla en la tabla `Tool` de la DB para que el sistema multi-tenant
sepa que este cliente tiene esta tool habilitada:

```sql
INSERT INTO "Tool" (cliente_id, nombre, descripcion, habilitada)
VALUES ('[id]', 'verificar_disponibilidad', '[descripción]', true);
```
