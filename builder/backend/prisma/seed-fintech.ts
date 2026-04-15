/**
 * Seed: Bot transaccional de billetera digital
 * Arquetipo 6 — Transaccional: CuentaYa
 *
 * Caso real: los usuarios quieren consultar saldo, ver movimientos y transferir
 * desde el chat sin abrir la app. El bot verifica identidad primero, luego opera.
 *
 * Regla de oro: ejecutar_transferencia con confirmado=false siempre primero (preview).
 * Solo pasar confirmado=true con confirmación explícita del usuario.
 *
 * Flujo: dos fases — auth (agente_auth → tools_auth) → transaccional (agente → tools)
 *
 * Usuarios de prueba (seed-demos.sql):
 *   mario.garcia / PIN 1234 / saldo $45.230
 *   ana.lopez    / PIN 5678 / saldo $12.800
 *
 * Uso:
 *   npx ts-node prisma/seed-fintech.ts
 *   npx ts-node prisma/seed-fintech.ts --clean
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
    const existing = await prisma.cliente.findFirst({ where: { nombre: 'CuentaYa' } });
    if (existing) {
      console.log(`Eliminando cliente existente: ${existing.id}`);
      await prisma.cliente.delete({ where: { id: existing.id } });
    }
  }

  // ── 1. Cliente ─────────────────────────────────────────────────────────────
  const cliente = await prisma.cliente.create({
    data: {
      nombre: 'CuentaYa',
      slug: 'cuentaya',
      arquetipo: 'transaccional',
      systemPrompt: [
        'Sos el asistente de CuentaYa, una billetera digital. INSTRUCCIONES CRÍTICAS:',
        '',
        '1. SIEMPRE verificar identidad con verificar_pin ANTES de mostrar cualquier dato o ejecutar operaciones.',
        '   Pedirle al usuario su ID (alias) y PIN. Nunca mostrar el PIN en ninguna respuesta.',
        '2. Para transferencias: SIEMPRE llamar ejecutar_transferencia con confirmado=false primero.',
        '   Mostrar el resumen al usuario y esperar confirmación explícita ("sí", "confirmo", "adelante").',
        '   Solo pasar confirmado=true con esa confirmación. Si dice "no", "espera" o no confirma → cancelar.',
        '3. Si verificar_pin retorna valido=false → informar credenciales incorrectas y ofrecer soporte.',
        '   No reintentar más de 2 veces.',
        '',
        'Flujo estándar:',
        '  - Pedir ID y PIN → verificar_pin',
        '  - Si válido: preguntar qué quiere hacer',
        '  - Saldo: consultar_cuenta',
        '  - Movimientos: consultar_movimientos',
        '  - Transferencia: pedir destino y monto → ejecutar_transferencia(confirmado=false) → mostrar preview → confirmar → ejecutar_transferencia(confirmado=true)',
        '  - Comprobante: generar_comprobante con el operacion_id',
      ].join('\n'),
      widgetNombre: 'Asistente CuentaYa',
      widgetColor: '#0891b2',
      widgetBienvenida: 'Hola, soy el asistente de CuentaYa. Para empezar, necesito verificar tu identidad.',
    },
  });
  console.log(`\n✓ Cliente creado: ${cliente.id} — ${cliente.nombre}`);

  // ── 2. Tools ───────────────────────────────────────────────────────────────

  const toolVerificar = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'verificar_pin',
      descripcion:
        'Verifica la identidad del usuario con su ID y PIN. ' +
        'Devuelve { valido: true, nombre, alias } si las credenciales son correctas, o { valido: false }. ' +
        'SIEMPRE llamar esta tool antes de cualquier operación.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/cuentaya/verificar`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            { nombre: 'usuario_id', tipo: 'string', descripcion: 'ID o alias del usuario (ej: mario.garcia)', requerido: true },
            { nombre: 'pin',        tipo: 'string', descripcion: 'PIN de 4 dígitos del usuario', requerido: true },
          ],
        },
      },
    },
  });

  const toolCuenta = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'consultar_cuenta',
      descripcion: 'Consulta el saldo y CVU de la cuenta del usuario. Solo usar después de verificar identidad.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/cuentaya/cuenta`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            { nombre: 'usuario_id', tipo: 'string', descripcion: 'ID del usuario autenticado', requerido: true },
          ],
        },
      },
    },
  });

  const toolMovimientos = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'consultar_movimientos',
      descripcion: 'Consulta los últimos movimientos de la cuenta (créditos y débitos). Solo usar después de verificar identidad.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/cuentaya/movimientos`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            { nombre: 'usuario_id', tipo: 'string', descripcion: 'ID del usuario autenticado', requerido: true },
          ],
        },
      },
    },
  });

  const toolTransferencia = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'ejecutar_transferencia',
      descripcion:
        'Ejecuta o previsualiza una transferencia. ' +
        'IMPORTANTE: llamar SIEMPRE con confirmado=false primero para mostrar el preview. ' +
        'Solo pasar confirmado=true cuando el usuario confirme explícitamente.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/cuentaya/transferencias`,
          metodo: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            { nombre: 'origen_id',     tipo: 'string',  descripcion: 'ID del usuario que transfiere', requerido: true },
            { nombre: 'destino_alias', tipo: 'string',  descripcion: 'Alias del destinatario (ej: ana.lopez)', requerido: true },
            { nombre: 'monto',         tipo: 'number',  descripcion: 'Monto a transferir (mayor a 0)', requerido: true },
            { nombre: 'confirmado',    tipo: 'boolean', descripcion: 'false = preview sin ejecutar | true = ejecutar la transferencia', requerido: true },
          ],
        },
      },
    },
  });

  const toolComprobante = await prisma.tool.create({
    data: {
      clienteId: cliente.id,
      nombre: 'generar_comprobante',
      descripcion: 'Obtiene el comprobante de una transferencia ejecutada. Usar con el operacion_id devuelto por ejecutar_transferencia.',
      conector: {
        create: {
          tipo: 'API_REST',
          url: `${API_BASE}/api/cuentaya/comprobante`,
          metodo: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      },
      parametros: {
        createMany: {
          data: [
            { nombre: 'operacion_id', tipo: 'string', descripcion: 'ID de la operación devuelto por ejecutar_transferencia', requerido: true },
          ],
        },
      },
    },
  });

  console.log(`✓ Tool creada: ${toolVerificar.id}    — verificar_pin`);
  console.log(`✓ Tool creada: ${toolCuenta.id}       — consultar_cuenta`);
  console.log(`✓ Tool creada: ${toolMovimientos.id}  — consultar_movimientos`);
  console.log(`✓ Tool creada: ${toolTransferencia.id} — ejecutar_transferencia`);
  console.log(`✓ Tool creada: ${toolComprobante.id}  — generar_comprobante`);

  // ── 3. Flujo ───────────────────────────────────────────────────────────────
  const flujo = await prisma.flujoDef.create({
    data: {
      clienteId: cliente.id,
      nombre: 'Bot Transaccional CuentaYa',
      descripcion: 'Dos fases: auth (agente_auth+tools_auth) → transaccional (agente+tools)',
      campos: {
        createMany: {
          data: [
            { nombre: 'autenticado',        tipo: 'boolean', reducer: 'last_wins', default: 'false' },
            { nombre: 'usuario_id',         tipo: 'string',  reducer: 'last_wins', default: 'null' },
            { nombre: 'operacion_pendiente',tipo: 'object',  reducer: 'last_wins', default: 'null' },
            { nombre: 'operacion_id',       tipo: 'string',  reducer: 'last_wins', default: 'null' },
          ],
        },
      },
      nodos: {
        createMany: {
          data: [
            {
              nombre: 'agente_auth',
              tipo: 'llm_call',
              orden: 0,
              config: { temperature: 0.15, maxTokens: 200 },
            },
            {
              nombre: 'tools_auth',
              tipo: 'tool_executor',
              orden: 1,
              config: {},
            },
            {
              nombre: 'agente_transaccional',
              tipo: 'llm_call',
              orden: 2,
              config: { temperature: 0.15, maxTokens: 300 },
            },
            {
              nombre: 'tools',
              tipo: 'tool_executor',
              orden: 3,
              config: {},
            },
          ],
        },
      },
      aristas: {
        createMany: {
          data: [
            { origen: '__start__',           destino: 'agente_auth',         condicion: null },
            { origen: 'agente_auth',         destino: 'tools_auth',          condicion: 'tools' },
            { origen: 'agente_auth',         destino: 'agente_transaccional',condicion: 'autenticado' },
            { origen: 'agente_auth',         destino: '__end__',             condicion: '__end__' },
            { origen: 'tools_auth',          destino: 'agente_auth',         condicion: null },
            { origen: 'agente_transaccional',destino: 'tools',               condicion: 'tools' },
            { origen: 'agente_transaccional',destino: '__end__',             condicion: '__end__' },
            { origen: 'tools',               destino: 'agente_transaccional',condicion: null },
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
  console.log('  # Paso 1: iniciar sesión');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Hola, quiero ver mi saldo","sessionId":"f1"}' | jq`);
  console.log('');
  console.log('  # Paso 2: proveer credenciales');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"mi id es mario.garcia y mi PIN es 1234","sessionId":"f1"}' | jq`);
  console.log('');
  console.log('  # Paso 3: transferencia (preview)');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Quiero transferirle $5000 a ana.lopez","sessionId":"f1"}' | jq`);
  console.log('');
  console.log('  # Paso 4: confirmar');
  console.log(`  curl -s -X POST http://localhost:3000/chat \\`);
  console.log(`    -H "x-client-id: ${cliente.id}" \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"mensaje":"Sí, confirmo","sessionId":"f1"}' | jq`);
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
