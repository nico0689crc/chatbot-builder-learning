/**
 * Seed: Bot de soporte postventa
 * Arquetipo 4 — Soporte & Postventa: TiendaMax
 *
 * Caso real: el 70% de los mensajes al soporte son "¿dónde está mi pedido?".
 * El bot consulta estados reales y procesa devoluciones. Para reclamos complejos
 * escala con todo el contexto ya recopilado — el agente humano no repregunta nada.
 *
 * Flujo: clasificador 3 ramas (estado_pedido / devolucion / reclamo)
 *   - reclamo → handoff directo
 *   - resto → agente_soporte → tools (ciclo ReAct)
 *
 * Uso:
 *   npx ts-node prisma/seed-ecommerce.ts
 *   npx ts-node prisma/seed-ecommerce.ts --clean
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const API_BASE = process.env.FRONTEND_API_URL ?? 'http://localhost:3001';

async function main() {
  const clean = process.argv.includes('--clean');

  if (clean) {
    const existing = await prisma.cliente.findFirst({
      where: { nombre: 'TiendaMax' },
    });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'TiendaMax',
      slug: 'tiendamax',
      arquetipo: 'soporte',
      systemPrompt:
        'Sos el asistente de soporte de TiendaMax. ' +
        'Antes de consultar un pedido, siempre pedile al usuario el número de pedido (formato TM-XXXXX). ' +
        'Para devoluciones: verificá que el pedido existe con consultar_pedido y preguntá el motivo antes de iniciar_devolucion. ' +
        'Para reclamos complejos que no podés resolver (producto dañado, error de cobro, etc.): usá escalar_a_humano con un resumen claro que incluya el número de pedido, el problema y lo ya intentado. ' +
        'Nunca inventes estados de pedidos — usá solo lo que devuelva consultar_pedido. ' +
        'Si el número no existe, pedile al usuario que lo verifique. ' +
        'Tono: preciso y empático. Sin floreos.',
      widgetNombre: 'Soporte TiendaMax',
      widgetColor: '#16a34a',
      widgetBienvenida: 'Hola, soy el asistente de TiendaMax. ¿En qué te puedo ayudar hoy?',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Tools ───────────────────────────────────────────────────────────────

  const toolPedido = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'consultar_pedido',
      descripcion:
        'Consulta el estado y detalle de un pedido por su número (ej: TM-00123). ' +
        'Devuelve estado, items, total y fecha estimada de entrega.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/ecommerce/pedidos`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'numero_pedido',
              tipo: 'string',
              descripcion: 'Número de pedido en formato TM-XXXXX',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolDevolucion = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'iniciar_devolucion',
      descripcion:
        'Inicia una devolución para un pedido entregado. ' +
        'Requiere el número de pedido y el motivo de devolución. ' +
        'Devuelve el ID de la devolución y el plazo de acreditación.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/ecommerce/devoluciones`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'numero_pedido',
              tipo: 'string',
              descripcion: 'Número de pedido en formato TM-XXXXX',
              requerido: true,
            },
            {
              nombre: 'motivo',
              tipo: 'string',
              descripcion: 'Motivo de la devolución (producto defectuoso, no era lo esperado, etc.)',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  const toolEscalar = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'escalar_a_humano',
      descripcion:
        'Escala el caso a un agente humano de TiendaMax con todo el contexto. ' +
        'Usá esta tool para reclamos complejos: producto dañado, error en cobro, situaciones que no podés resolver. ' +
        'El resumen debe incluir: número de pedido, problema específico y lo que ya se intentó.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/ecommerce/escalados`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'resumen',
              tipo: 'string',
              descripcion: 'Resumen completo del caso: número de pedido, problema y contexto relevante',
              requerido: true,
            },
            {
              nombre: 'prioridad',
              tipo: 'string',
              descripcion: 'Prioridad del caso: "baja", "media", "alta" o "critica"',
              requerido: true,
            },
          ],
        },
      },
    },
  });

  console.log(`✓ Tool creada: ${toolPedido.id} — consultar_pedido`);
  console.log(`✓ Tool creada: ${toolDevolucion.id} — iniciar_devolucion`);
  console.log(`✓ Tool creada: ${toolEscalar.id} — escalar_a_humano`);

  // ── 3. Flujo ───────────────────────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'Bot Soporte Ecommerce',
      descripcion: 'Clasificador 3 ramas: estado_pedido/devolucion → agente+tools; reclamo → handoff directo',
      campos: {
        createMany: {
          data: [
            { nombre: 'categoria',     tipo: 'string',  reducer: 'last_wins', default: '"sin_clasificar"' },
            { nombre: 'pedido_numero', tipo: 'string',  reducer: 'last_wins', default: 'null' },
            { nombre: 'escalated',     tipo: 'boolean', reducer: 'last_wins', default: 'false' },
          ],
        },
      },
      nodos: {
        createMany: {
          data: [
            {
              nombre: 'clasificador',
              tipo: 'classifier',
              orden: 0,
              config: {
                field: 'categoria',
                categories: ['estado_pedido', 'devolucion', 'reclamo'],
                prompt:
                  'Clasificá la intención del usuario en exactamente una categoría:\n' +
                  '"estado_pedido": quiere saber dónde está su pedido, cuándo llega o cuál es el estado.\n' +
                  '"devolucion": quiere devolver un producto o solicitar reembolso.\n' +
                  '"reclamo": producto dañado, error en el pedido, cobro incorrecto o situación que requiere intervención humana.',
              },
            },
            {
              nombre: 'agente_soporte',
              tipo: 'llm_call',
              orden: 1,
              config: { temperature: 0.3, maxTokens: 250 },
            },
            {
              nombre: 'tools',
              tipo: 'tool_executor',
              orden: 2,
              config: {},
            },
            {
              nombre: 'handoff',
              tipo: 'human_handoff',
              orden: 3,
              config: {
                message:
                  'Entiendo la situación. Voy a escalar tu caso a un agente de TiendaMax ' +
                  'que va a tener todo el contexto y te va a contactar en las próximas 2 horas.',
                escalatedField: 'escalated',
              },
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__',      destino: 'clasificador',   condicion: null },
            { origen: 'clasificador',   destino: 'agente_soporte', condicion: 'estado_pedido' },
            { origen: 'clasificador',   destino: 'agente_soporte', condicion: 'devolucion' },
            { origen: 'clasificador',   destino: 'handoff',        condicion: 'reclamo' },
            { origen: 'agente_soporte', destino: 'tools',          condicion: 'tools' },
            { origen: 'agente_soporte', destino: '__end__',        condicion: '__end__' },
            { origen: 'tools',          destino: 'agente_soporte', condicion: null },
            { origen: 'handoff',        destino: '__end__',        condicion: null },
          ],
        },
      },
    },
    include: {
      campos: true,
      nodos: { orderBy: { orden: 'asc' } },
      aristas: true,
    },
  });

  console.log(`✓ Flujo creado: ${flujo.id} — ${flujo.nombre}`);
  console.log(`  Campos:  ${flujo.campos.length}`);
  console.log(`  Nodos:   ${flujo.nodos.length} → ${flujo.nodos.map(n => n.nombre).join(', ')}`);
  console.log(`  Aristas: ${flujo.aristas.length}`);

  console.log('\n─────────────────────────────────────────────');
  console.log('Seed completado. Para testear:');
  console.log('');
  console.log(`  CLIENT_ID="${cliente.id}"`);
  console.log('');
  console.log('  # Estado de pedido (llama consultar_pedido)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"¿Dónde está mi pedido TM-00123?","sessionId":"s1"}' | jq`);
  console.log('');
  console.log('  # Devolución (consultar_pedido → iniciar_devolucion)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Quiero devolver el pedido TM-00125, llegó roto","sessionId":"s2"}' | jq`);
  console.log('');
  console.log('  # Reclamo (handoff directo)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Me cobraron dos veces el pedido TM-00124","sessionId":"s3"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
