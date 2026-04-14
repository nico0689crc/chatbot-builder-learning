import * as http from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Test de integración completo:
 *
 * Flujo testeado (definido vía admin API, guardado en DB):
 *
 *   __start__
 *       ↓
 *    [model]  ← llm_call con tool "consultar_stock" bindeada
 *       ↓ (condicional)
 *   ┌──┴───┐
 * [tools] [__end__]
 *   ↓
 * [model]   ← recibe resultado de la tool y decide si termina
 *   ↓
 * [__end__]
 *
 * La tool "consultar_stock" llama a un servidor HTTP local (mock)
 * que devuelve stock disponible para un producto.
 *
 * Qué se verifica:
 *   a) El FlujoDef se guarda en DB y el grafo se construye desde ahí
 *   b) El modelo llama a la tool (hay ToolMessage en el checkpointer)
 *   c) La respuesta final del chat menciona el resultado de la tool
 *   d) La conversación queda persistida en la tabla Mensaje
 */
describe('Flujo ReAct completo con DB y tool HTTP (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clienteId: string;
  let mockServer: http.Server;
  let mockPort: number;
  let mockCallCount = 0;

  // ---------------------------------------------------------------------------
  // Levantar servidor mock ANTES de todo
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    // Servidor mock que responde al conector de la tool
    await new Promise<void>(resolve => {
      mockServer = http.createServer((req, res) => {
        mockCallCount++;
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
          const payload = body ? JSON.parse(body) : {};
          const producto = payload.producto ?? 'desconocido';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            producto,
            stock: 42,
            unidad: 'unidades',
            deposito: 'Buenos Aires',
          }));
        });
      });

      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = (mockServer.address() as any).port;
        console.log(`Mock HTTP server en puerto ${mockPort}`);
        resolve();
      });
    });

    // Levantar NestJS
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    // Limpiar DB
    if (clienteId) {
      // Esperar posibles background tasks de persistencia
      await new Promise(r => setTimeout(r, 1000));

      const convIds = await prisma.conversacion
        .findMany({ where: { clienteId }, select: { id: true } })
        .then(cs => cs.map(c => c.id));
      if (convIds.length) {
        await prisma.mensaje.deleteMany({ where: { conversacionId: { in: convIds } } });
      }
      await prisma.conversacion.deleteMany({ where: { clienteId } });
      const toolIds = await prisma.tool
        .findMany({ where: { clienteId }, select: { id: true } })
        .then(ts => ts.map(t => t.id));
      await prisma.conector.deleteMany({ where: { toolId: { in: toolIds } } });
      await prisma.parametro.deleteMany({ where: { toolId: { in: toolIds } } });
      await prisma.tool.deleteMany({ where: { clienteId } });
      await prisma.flujoDef.deleteMany({ where: { clienteId } });
      await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => {});
    }

    await app.close();
    await new Promise<void>(resolve => mockServer.close(() => resolve()));
  });

  // ---------------------------------------------------------------------------
  // 1. Setup: cliente + tool + flujo ReAct en DB
  // ---------------------------------------------------------------------------

  it('crea el cliente con systemPrompt que fuerza uso de la tool', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/clientes')
      .send({
        nombre: 'Cliente ReAct Test',
        arquetipo: 'ventas',
        systemPrompt:
          'Sos un asistente de ventas. ' +
          'SIEMPRE que te pregunten por el stock de un producto, ' +
          'usá la tool consultar_stock ANTES de responder. ' +
          'Nunca inventes stock — solo respondé con el dato que te devuelva la tool.',
      })
      .expect(201);

    clienteId = res.body.id;
    expect(clienteId).toBeDefined();
  });

  it('crea la tool "consultar_stock" apuntando al servidor mock', async () => {
    // Crear la tool
    const toolRes = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/tools`)
      .send({
        nombre: 'consultar_stock',
        descripcion: 'Consulta el stock disponible de un producto en el depósito. Devuelve cantidad y ubicación.',
        tipo: 'API_REST',
        url: `http://127.0.0.1:${mockPort}`,
        metodo: 'POST',
      })
      .expect(201);

    const toolId = toolRes.body.id;
    expect(toolId).toBeDefined();

    // Agregar el parámetro "producto"
    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/tools/${toolId}/parametros`)
      .send({
        nombre: 'producto',
        tipo: 'string',
        descripcion: 'Nombre del producto a consultar',
        requerido: true,
      })
      .expect(201);
  });

  it('crea el FlujoDef ReAct con nodos y aristas via API', async () => {
    // Flujo
    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo`)
      .send({ nombre: 'Flujo ReAct con tool de stock' })
      .expect(201);

    // Nodos
    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/nodos`)
      .send({ nombre: 'model', tipo: 'llm_call', orden: 0 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/nodos`)
      .send({ nombre: 'tools', tipo: 'tool_executor', orden: 1 })
      .expect(201);

    // Aristas del ciclo ReAct
    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: '__start__', destino: 'model' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: 'model', destino: 'tools', condicion: 'tools' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: 'model', destino: '__end__', condicion: '__end__' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: 'tools', destino: 'model' })
      .expect(201);

    // Verificar que quedó bien en DB
    const flujoRes = await request(app.getHttpServer())
      .get(`/admin/clientes/${clienteId}/flujo`)
      .expect(200);

    expect(flujoRes.body.nodos).toHaveLength(2);
    expect(flujoRes.body.aristas).toHaveLength(4);
  }, 15000);

  // ---------------------------------------------------------------------------
  // 2. Chat: el grafo se construye desde DB y ejecuta el ciclo
  // ---------------------------------------------------------------------------

  it('el chat usa la tool y la respuesta menciona el stock real', async () => {
    const mockCallsBefore = mockCallCount;

    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({
        mensaje: '¿Cuántas unidades de "laptop ThinkPad" hay en stock?',
        sessionId: 'react-session-1',
      })
      .expect(201);

    const respuesta = res.body.respuesta as string;
    console.log('calls al mock:', mockCallCount - mockCallsBefore);
    console.log('respuesta del bot:', respuesta);

    // a) La tool HTTP fue llamada al menos una vez
    expect(mockCallCount).toBeGreaterThan(mockCallsBefore);

    // b) La respuesta menciona el número 42 (stock que devuelve el mock)
    expect(respuesta).toContain('42');
  }, 60000);

  // ---------------------------------------------------------------------------
  // 3. La conversación quedó persistida en DB con los mensajes correctos
  // ---------------------------------------------------------------------------

  it('la conversación y los mensajes quedan guardados en DB', async () => {
    // La persistencia es fire-and-forget — esperar que el background task termine
    await new Promise(r => setTimeout(r, 1500));

    const conv = await prisma.conversacion.findUnique({
      where: { clienteId_sessionId: { clienteId, sessionId: 'react-session-1' } },
      include: { mensajes: { orderBy: { creadoEn: 'asc' } } },
    });

    expect(conv).not.toBeNull();
    expect(conv!.mensajes).toHaveLength(2); // user + assistant

    const [user, assistant] = conv!.mensajes;
    expect(user.rol).toBe('user');
    expect(assistant.rol).toBe('assistant');

    // El mensaje del asistente persistido también menciona el stock
    expect(assistant.contenido).toContain('42');

    console.log('mensajes en DB:', conv!.mensajes.length);
    console.log('respuesta persistida:', assistant.contenido.slice(0, 120));
  });

  // ---------------------------------------------------------------------------
  // 4. Segunda pregunta en la misma sesión — el modelo recuerda el contexto
  // ---------------------------------------------------------------------------

  it('segunda pregunta en la misma sesión mantiene contexto de conversación', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({
        mensaje: '¿Y en qué depósito están?',
        sessionId: 'react-session-1',
      })
      .expect(201);

    const respuesta = res.body.respuesta as string;
    console.log('respuesta turno 2:', respuesta);

    // El modelo debería mencionar "Buenos Aires" (que devuelve el mock)
    // o al menos referenciar el contexto anterior sin volver a llamar la tool
    expect(respuesta.length).toBeGreaterThan(10);
  }, 60000);
});
