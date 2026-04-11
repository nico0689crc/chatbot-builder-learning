# SKILL: new-client

## Cuándo leer este archivo

Leé este archivo completo antes de agregar un cliente nuevo al builder.
Aplica cuando el usuario pide:
- "Agreguemos un cliente nuevo"
- "Tengo un cliente [tipo de negocio], configuralo"
- "Quiero crear el bot para [nombre del negocio]"

También leé [`../referencias/arquetipos-config.md`](../referencias/arquetipos-config.md)
para los parámetros recomendados según el arquetipo.

---

## Qué significa "agregar un cliente" en el builder

Agregar un cliente no es programar — es configurar. El motor ya existe.
Lo que cambia por cliente es:
1. Sus datos en la tabla `Cliente` de la DB
2. Su system prompt
3. Las tools que tiene habilitadas (si el arquetipo las requiere)
4. El widget configurado con su `cliente_id`

El mismo código sirve para todos. Solo cambia la configuración en la DB.

---

## Proceso completo — seguir este orden siempre

### Paso 1 — Discovery previo (prerequisito)

Antes de crear nada, verificar que se hizo el discovery del cliente.
El usuario debe tener:

- [ ] Arquetipo identificado (ver [`../referencias/arquetipos-config.md`])
- [ ] System prompt redactado (ver [`../prompts/system-prompts.md`])
- [ ] Lista de tools necesarias (si el arquetipo las requiere)
- [ ] Canales definidos (web, WhatsApp, o ambos)

Si alguno falta, hacer las preguntas del discovery antes de continuar.
No crear el cliente sin esta información — el resultado será un bot que no sirve.

---

### Paso 2 — Crear el cliente en la DB

**Etapa 1 (CLI):** Script de seed o inserción directa con Prisma Studio.

```typescript
// src/scripts/crear-cliente.ts
// Ejecutar con: ts-node src/scripts/crear-cliente.ts

import { PrismaClient } from '@prisma/client'
import { Arquetipo, Canal } from '../../shared/types/chatbot.types'

const prisma = new PrismaClient()

async function crearCliente() {
  const cliente = await prisma.cliente.create({
    data: {
      nombre:       '[NOMBRE DEL NEGOCIO]',
      arquetipo:    Arquetipo.[ARQUETIPO],    // elegir según discovery

      // Parámetros de IA — ver tabla en arquetipos-config.md
      systemPrompt: `[SYSTEM PROMPT COMPLETO]`,
      modelo:       '[claude-haiku-20240307 | claude-sonnet-4-5]',
      temperatura:  [0.2 | 0.3 | 0.5],      // según arquetipo
      maxTokens:    [150 | 200 | 250 | 300], // según arquetipo
      maxHistorial: [6 | 8 | 10],            // según arquetipo

      canales:      [Canal.WEB],             // o [Canal.WEB, Canal.WHATSAPP]
      activo:       true,
    }
  })

  console.log(`Cliente creado: ${cliente.id}`)
  console.log(`Widget snippet:`)
  console.log(`<script src="https://[TU_DOMINIO]/widget.js"`)
  console.log(`        data-client-id="${cliente.id}"></script>`)

  await prisma.$disconnect()
}

crearCliente()
```

**Etapa 2 (API):** Endpoint REST cuando el panel esté listo.

```bash
POST /admin/clientes
Content-Type: application/json

{
  "nombre": "[NOMBRE]",
  "arquetipo": "[ARQUETIPO]",
  "systemPrompt": "[PROMPT]",
  "modelo": "[MODELO]",
  "temperatura": [TEMP],
  "maxTokens": [MAX],
  "maxHistorial": [HIST],
  "canales": ["web"]
}
```

---

### Paso 3 — Configurar tools (si el arquetipo las requiere)

FAQ no necesita tools. Para los demás arquetipos:

```typescript
// Para cada tool que necesita el cliente:
await prisma.tool.create({
  data: {
    clienteId:   cliente.id,
    nombre:      '[nombre_tool]',         // snake_case
    descripcion: '[descripción para IA]', // ver SKILL tool-creator.md
    habilitada:  true,
    conector: {
      create: {
        tipo:   '[api_rest | google_sheets | bd_directa]',
        url:    '[URL del endpoint o Sheet ID]',
        credenciales: {
          // guardar cifrado en producción
          apiKey: process.env.[VARIABLE_ENV_CLIENTE],
        }
      }
    }
  }
})
```

---

### Paso 4 — Verificar que el bot responde

Siempre probar antes de entregar al cliente:

```bash
# Prueba básica — el bot responde con personalidad correcta
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "[ID_NUEVO_CLIENTE]",
    "usuarioId": "test-usuario",
    "texto": "Hola, ¿me podés ayudar?"
  }'

# Prueba de identidad — el bot sabe quién es
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "[ID_NUEVO_CLIENTE]",
    "usuarioId": "test-usuario",
    "texto": "¿Quién sos y para qué negocio trabajás?"
  }'

# Prueba de límites — el bot sabe qué no puede responder
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "[ID_NUEVO_CLIENTE]",
    "usuarioId": "test-usuario",
    "texto": "[Pregunta fuera del dominio del negocio]"
  }'
```

Si el arquetipo tiene tools, agregar prueba de function calling:
```bash
curl -X POST http://localhost:3000/chat \
  -d '{"clienteId": "[ID]", "usuarioId": "test", "texto": "[Pregunta que dispara una tool]"}'
```

---

### Paso 5 — Entregar el widget al cliente

El cliente recibe un snippet para pegar en su web:

```html
<!-- Pegar antes de </body> en el sitio del cliente -->
<script
  src="https://[TU_DOMINIO_RAILWAY].app/widget.js"
  data-client-id="[ID_DEL_CLIENTE]"
  data-position="bottom-right"
  data-color="#[COLOR_DE_MARCA]">
</script>
```

Si el cliente necesita WhatsApp, configurar el webhook de Twilio
para que apunte a `https://[TU_DOMINIO]/chat/whatsapp?clienteId=[ID]`.

---

## Checklist de alta de cliente

Antes de dar por terminada el alta, verificar:

- [ ] Cliente creado en la DB con todos los campos
- [ ] System prompt tiene los 6 bloques: identidad, tono, conocimiento, capacidades, límites, escalado
- [ ] Tools configuradas y con conectores (si el arquetipo las requiere)
- [ ] Prueba básica pasando (el bot responde con identidad correcta)
- [ ] Prueba de límites pasando (el bot sabe qué no responder)
- [ ] Prueba de tools pasando (si aplica)
- [ ] Widget snippet generado y enviado al cliente
- [ ] Variables de entorno del cliente configuradas en Railway (si usa API externa)

---

## Parámetros por arquetipo — referencia rápida

| Arquetipo | Modelo | Temp | Historial | Max tokens |
|-----------|--------|------|-----------|-----------|
| FAQ & Info | Haiku | 0.3 | 6 | 150 |
| Agenda & Turnos | Haiku | 0.2 | 8 | 200 |
| Ventas & Captación | Sonnet | 0.6 | 10 | 250 |
| Soporte & Postventa | Sonnet | 0.3 | 10 | 250 |
| Asistente Interno | Sonnet | 0.2 | 10 | 300 |
| Transaccional | Sonnet | 0.15 | 20 | 300 |

Para justificación de cada decisión ver
[`../docs/guia-diseno-chatbots.md`](../docs/guia-diseno-chatbots.md#tabla-de-decisión).
