# Tool Executor y Schema de Tools

## El problema que resuelve

En las fases anteriores las tools estaban hardcodeadas en el código:

```typescript
// Fase 3 — tools fijas en el código
const obtenerPedido = tool(async ({ pedidoId }) => { ... }, { name: "obtener_pedido" });
const escalarAHumano = tool(async ({ motivo }) => { ... }, { name: "escalar_a_humano" });
```

Para agregar una tool a un cliente habría que tocar el código y hacer un nuevo deploy.

**Con el Tool Executor**, las tools se configuran en la DB por cliente. Agregar una tool nueva es un `INSERT` — sin tocar código, sin deploy.

---

## Schema de Prisma

Tres tablas nuevas en sesión 11:

```prisma
model Tool {
  id          String  @id @default(cuid())
  clienteId   String
  nombre      String  // nombre de la función que el LLM puede llamar
  descripcion String
  activa      Boolean @default(true)

  conector   Conector?   // cómo ejecutar la tool (1:1)
  parametros Parametro[] // qué argumentos acepta (1:N)

  @@unique([clienteId, nombre]) // un cliente no puede tener dos tools con el mismo nombre
}

model Conector {
  id     String @id @default(cuid())
  toolId String @unique
  tipo   String // "API_REST" | "GOOGLE_SHEETS"
  url    String // endpoint de la API o spreadsheetId
  metodo String @default("GET")
  headers Json   @default("{}")

  tool Tool @relation(fields: [toolId], references: [id])
}

model Parametro {
  id          String  @id @default(cuid())
  toolId      String
  nombre      String
  tipo        String  // "string" | "number" | "boolean"
  descripcion String
  requerido   Boolean @default(true)

  tool Tool @relation(fields: [toolId], references: [id])
}
```

### Ejemplo de datos para un cliente de e-commerce

```sql
-- Tool: consultar estado de pedido
INSERT INTO "Tool" (id, clienteId, nombre, descripcion)
VALUES ('t1', 'cliente-abc', 'consultar_pedido', 'Consulta el estado de un pedido por su número');

-- Conector: llama a una API REST
INSERT INTO "Conector" (id, toolId, tipo, url, metodo)
VALUES ('c1', 't1', 'API_REST', 'https://api.tienda.com/pedidos', 'GET');

-- Parámetro: numeroPedido
INSERT INTO "Parametro" (id, toolId, nombre, tipo, descripcion, requerido)
VALUES ('p1', 't1', 'numeroPedido', 'string', 'Número del pedido a consultar', true);
```

---

## ToolExecutorService

Carga las tools de un cliente desde la DB y las convierte en `DynamicStructuredTool[]` listos para `bindTools()`:

```typescript
async loadToolsForCliente(clienteId: string) {
  const tools = await this.prisma.tool.findMany({
    where: { clienteId, activa: true },
    include: { conector: true, parametros: true },
  });

  return tools.map((t) => {
    const schema = this.buildZodSchema(t.parametros);   // schema dinámico

    return tool(
      async (args) => {
        if (!t.conector) return { error: 'Tool sin conector' };
        return this.executeConector(t.conector, args);  // ejecuta el conector
      },
      { name: t.nombre, description: t.descripcion, schema },
    );
  });
}
```

### Schema Zod dinámico

Los parámetros de la DB se convierten a un schema Zod en runtime:

```typescript
private buildZodSchema(parametros: Parametro[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const p of parametros) {
    let field = p.tipo === 'number'  ? z.number()
              : p.tipo === 'boolean' ? z.boolean()
              :                        z.string();

    field = field.describe(p.descripcion);
    shape[p.nombre] = p.requerido ? field : field.optional();
  }

  return z.object(shape);
}
```

El LLM usa este schema para saber qué argumentos pasar a la tool.

---

## Ejecución de conectores

### API_REST

```typescript
private async executeApiRest(conector, args): Promise<ConectorResult> {
  // GET → parámetros en la URL
  // POST/PUT → parámetros en el body
  if (conector.metodo === 'GET') {
    const params = new URLSearchParams(Object.entries(args).map(([k, v]) => [k, String(v)]));
    url = `${conector.url}?${params}`;
  } else {
    body = JSON.stringify(args);
  }

  const response = await fetch(url, { method: conector.metodo, headers, body });
  return response.json() as Promise<ConectorResult>;
}
```

### GOOGLE_SHEETS

Pendiente de implementación completa con `googleapis`. Por ahora retorna un placeholder para no bloquear el flujo del bot.

---

## Cómo IAService usa el executor

```typescript
async buildGraph(arquetipo: string, systemPrompt: string, clienteId: string) {
  const tools = await this.toolExecutor.loadToolsForCliente(clienteId);

  // Si el cliente tiene tools → grafo con bifurcaciones
  // Si no tiene tools → grafo simple (FAQ)
  if (arquetipo !== 'faq' && tools.length > 0) {
    return this.buildGraphWithTools(systemPrompt, tools);
  }
  return this.buildFaqGraph(systemPrompt);
}
```

Esto significa que el mismo arquetipo "soporte" puede funcionar con o sin tools — depende de lo que esté configurado en la DB para ese cliente.

---

## Agregar una tool nueva a un cliente — flujo operativo

Sin tocar código ni hacer deploy:

```
1. POST /admin/clientes/:id/tools
   { nombre: "verificar_stock", descripcion: "...", tipo: "API_REST", url: "...", metodo: "GET" }

2. POST /admin/clientes/:id/tools/:toolId/parametros
   { nombre: "productoId", tipo: "string", descripcion: "ID del producto", requerido: true }

3. El próximo chat del cliente ya incluye la tool nueva.
   IAService.loadToolsForCliente() la carga en cada request.
```

Esto es lo que hace al builder un producto — la lógica de IA está separada de la configuración por cliente.
