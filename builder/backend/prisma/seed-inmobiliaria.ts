/**
 * Seed: Bot de ventas inmobiliarias
 * Arquetipo 3 — Ventas & Captación: PropNorte Inmobiliaria
 *
 * Caso real: el sitio recibe consultas fuera del horario laboral.
 * El bot actúa como primer filtro: entiende qué busca el usuario,
 * filtra propiedades reales y registra el lead con score de calidad.
 *
 * Flujo: clasificador (consultar / calificar / registrar) → agente_ventas → tools
 * Temperatura alta (0.6) para tono consultivo y persuasivo.
 *
 * Uso:
 *   npx ts-node prisma/seed-inmobiliaria.ts
 *   npx ts-node prisma/seed-inmobiliaria.ts --clean
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
      where: { nombre: 'PropNorte Inmobiliaria' },
    });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'PropNorte Inmobiliaria',
      slug: 'propnorte',
      arquetipo: 'ventas',
      systemPrompt:
        'Sos el asistente virtual de PropNorte Inmobiliaria. ' +
        'Tu rol es actuar como asesor consultivo: entender qué busca el usuario antes de mostrar propiedades. ' +
        'Siempre preguntá al menos el tipo de propiedad y el presupuesto antes de llamar buscar_propiedades. ' +
        'No presiones para pedir datos personales: esperá a que el usuario muestre interés concreto. ' +
        'Cuando el usuario elija una propiedad o quiera que lo contacten, ofrecé registrar sus datos con registrar_lead. ' +
        'Nunca inventes propiedades ni precios — usá solo lo que devuelva buscar_propiedades. ' +
        'Tono: amigable, cálido y profesional. Sin tecnicismos.',
      widgetNombre: 'Asesor PropNorte',
      widgetColor: '#1d4ed8',
      widgetBienvenida: '¡Hola! Soy el asistente de PropNorte. ¿Estás buscando tu próxima propiedad?',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Tools ───────────────────────────────────────────────────────────────

  const toolBuscar = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'buscar_propiedades',
      descripcion:
        'Busca propiedades disponibles según los criterios del usuario. ' +
        'Todos los parámetros son opcionales — enviá solo los que el usuario especificó.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/inmobiliaria/propiedades`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'tipo',
              tipo: 'string',
              descripcion: 'Tipo de propiedad: "departamento", "casa", "local" o "ph"',
              requerido: false,
            },
            {
              nombre: 'zona',
              tipo: 'string',
              descripcion: 'Barrio o zona (ej: "Nueva Córdoba", "Güemes", "Argüello")',
              requerido: false,
            },
            {
              nombre: 'presupuesto_max',
              tipo: 'number',
              descripcion: 'Presupuesto máximo en USD',
              requerido: false,
            },
          ],
        },
      },
    },
  });

  const toolLead = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'registrar_lead',
      descripcion:
        'Registra los datos de contacto del usuario para que un asesor de PropNorte lo contacte. ' +
        'Usá esta tool cuando el usuario quiera que lo llamen o muestre interés concreto en una propiedad.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/inmobiliaria/leads`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            {
              nombre: 'nombre',
              tipo: 'string',
              descripcion: 'Nombre completo del usuario',
              requerido: true,
            },
            {
              nombre: 'email',
              tipo: 'string',
              descripcion: 'Email de contacto',
              requerido: true,
            },
            {
              nombre: 'telefono',
              tipo: 'string',
              descripcion: 'Teléfono de contacto (opcional pero recomendado)',
              requerido: false,
            },
            {
              nombre: 'interes',
              tipo: 'string',
              descripcion: 'Resumen de lo que busca el usuario (tipo, zona, presupuesto, etc.)',
              requerido: false,
            },
            {
              nombre: 'presupuesto',
              tipo: 'number',
              descripcion: 'Presupuesto en USD que mencionó el usuario',
              requerido: false,
            },
          ],
        },
      },
    },
  });

  console.log(`✓ Tool creada: ${toolBuscar.id} — buscar_propiedades`);
  console.log(`✓ Tool creada: ${toolLead.id} — registrar_lead`);

  // ── 3. Flujo ───────────────────────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'Bot Ventas Inmobiliaria',
      descripcion: 'Clasificador 3 ramas + agente consultivo con ciclo ReAct',
      campos: {
        createMany: {
          data: [
            { nombre: 'etapa',   tipo: 'string', reducer: 'last_wins', default: '"explorar"' },
            { nombre: 'lead_id', tipo: 'string', reducer: 'last_wins', default: 'null' },
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
                field: 'etapa',
                categories: ['consultar', 'calificar', 'registrar'],
                prompt:
                  'Clasificá la intención del usuario en exactamente una categoría:\n' +
                  '"consultar": pregunta por propiedades, zonas, precios o características en general.\n' +
                  '"calificar": ya expresó su necesidad y está listo para ver opciones concretas.\n' +
                  '"registrar": quiere que lo contacten o está dejando sus datos de contacto.',
              },
            },
            {
              nombre: 'agente_ventas',
              tipo: 'llm_call',
              orden: 1,
              config: { temperature: 0.6, maxTokens: 250 },
            },
            {
              nombre: 'tools',
              tipo: 'tool_executor',
              orden: 2,
              config: {},
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__',      destino: 'clasificador',  condicion: null },
            { origen: 'clasificador',   destino: 'agente_ventas', condicion: 'consultar' },
            { origen: 'clasificador',   destino: 'agente_ventas', condicion: 'calificar' },
            { origen: 'clasificador',   destino: 'agente_ventas', condicion: 'registrar' },
            { origen: 'agente_ventas',  destino: 'tools',         condicion: 'tools' },
            { origen: 'agente_ventas',  destino: '__end__',       condicion: '__end__' },
            { origen: 'tools',          destino: 'agente_ventas', condicion: null },
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
  console.log('  # Consulta genérica');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Busco un departamento en Nueva Córdoba","sessionId":"v1"}' | jq`);
  console.log('');
  console.log('  # Búsqueda con criterios (debe llamar buscar_propiedades)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Necesito algo hasta $120.000 en Güemes, 2 ambientes","sessionId":"v2"}' | jq`);
  console.log('');
  console.log('  # Registro de lead (debe llamar registrar_lead)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Me interesa, soy Juan López, juan@email.com, 351-4567890","sessionId":"v3"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
