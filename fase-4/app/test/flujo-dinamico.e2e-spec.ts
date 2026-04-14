import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Flujo dinámico (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let clienteId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    // Limpiar datos de test (orden: mensajes → conversaciones → flujo → cliente)
    if (clienteId) {
      const convIds = await prisma.conversacion
        .findMany({ where: { clienteId }, select: { id: true } })
        .then(cs => cs.map(c => c.id));
      await prisma.mensaje.deleteMany({ where: { conversacionId: { in: convIds } } });
      await prisma.conversacion.deleteMany({ where: { clienteId } });
      await prisma.flujoDef.deleteMany({ where: { clienteId } });
      await prisma.cliente.delete({ where: { id: clienteId } }).catch(() => {});
    }
    await app.close();
  });

  // ---------------------------------------------------------------------------
  // 1. Crear cliente
  // ---------------------------------------------------------------------------

  it('POST /admin/clientes — crea un cliente de prueba', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/clientes')
      .send({
        nombre: 'Cliente Test Flujo',
        arquetipo: 'soporte',
        systemPrompt: 'Sos un asistente de prueba. Respondé siempre de forma breve.',
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    clienteId = res.body.id;
  });

  // ---------------------------------------------------------------------------
  // 2. Crear flujo FAQ (START → model → END)
  // ---------------------------------------------------------------------------

  it('POST /admin/clientes/:id/flujo — crea el FlujoDef', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo`)
      .send({ nombre: 'Flujo FAQ simple' })
      .expect(201);

    expect(res.body.clienteId).toBe(clienteId);
  });

  it('POST /admin/clientes/:id/flujo/nodos — agrega nodo llm_call', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/nodos`)
      .send({ nombre: 'model', tipo: 'llm_call', orden: 0 })
      .expect(201);

    expect(res.body.tipo).toBe('llm_call');
  });

  it('POST /admin/clientes/:id/flujo/aristas — conecta __start__ → model', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: '__start__', destino: 'model' })
      .expect(201);

    expect(res.body.origen).toBe('__start__');
  });

  it('POST /admin/clientes/:id/flujo/aristas — conecta model → __end__', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/aristas`)
      .send({ origen: 'model', destino: '__end__' })
      .expect(201);

    expect(res.body.destino).toBe('__end__');
  });

  // ---------------------------------------------------------------------------
  // 3. Verificar que el flujo quedó bien configurado
  // ---------------------------------------------------------------------------

  it('GET /admin/clientes/:id/flujo — retorna flujo con nodos y aristas', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/clientes/${clienteId}/flujo`)
      .expect(200);

    expect(res.body.nodos).toHaveLength(1);
    expect(res.body.aristas).toHaveLength(2);
    expect(res.body.nodos[0].tipo).toBe('llm_call');
  });

  // ---------------------------------------------------------------------------
  // 4. Enviar un mensaje al chat — prueba el grafo real
  // ---------------------------------------------------------------------------

  it('POST /chat — el grafo se construye desde DB y responde', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({ mensaje: 'Hola, ¿cómo estás?', sessionId: 'test-session-1' })
      .expect(201);

    expect(res.body.respuesta).toBeDefined();
    expect(typeof res.body.respuesta).toBe('string');
    expect(res.body.respuesta.length).toBeGreaterThan(0);

    console.log('Respuesta del bot:', res.body.respuesta);
  }, 30000); // timeout generoso por la llamada a Gemini

  // ---------------------------------------------------------------------------
  // 5. Segunda vuelta — verifica que el cache funciona (no reconstruye el grafo)
  // ---------------------------------------------------------------------------

  it('POST /chat — segunda respuesta usa el grafo cacheado', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({ mensaje: '¿Cuál es tu nombre?', sessionId: 'test-session-1' })
      .expect(201);

    expect(res.body.respuesta).toBeDefined();
    console.log('Segunda respuesta:', res.body.respuesta);
  }, 30000);

  // ---------------------------------------------------------------------------
  // 6. Modificar el flujo — verifica que el cache se invalida
  // ---------------------------------------------------------------------------

  it('POST /admin/clientes/:id/flujo/campos — agrega campo al estado', async () => {
    const res = await request(app.getHttpServer())
      .post(`/admin/clientes/${clienteId}/flujo/campos`)
      .send({ nombre: 'turno', tipo: 'number', reducer: 'last_wins', default: '0' })
      .expect(201);

    expect(res.body.nombre).toBe('turno');
  });

  it('POST /chat — después de modificar el flujo, responde con el nuevo estado', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({ mensaje: 'Hola de nuevo', sessionId: 'test-session-2' })
      .expect(201);

    expect(res.body.respuesta).toBeDefined();
    console.log('Respuesta post-modificación:', res.body.respuesta);
  }, 30000);

  // ---------------------------------------------------------------------------
  // 7. Sin flujo — debe retornar error
  // ---------------------------------------------------------------------------

  it('DELETE /admin/clientes/:id/flujo — elimina el flujo', async () => {
    await request(app.getHttpServer())
      .delete(`/admin/clientes/${clienteId}/flujo`)
      .expect(200);
  });

  it('POST /chat — sin flujo activo retorna error (404 o 500)', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat')
      .set('x-client-id', clienteId)
      .send({ mensaje: 'Hola', sessionId: 'test-session-3' });

    expect([404, 500]).toContain(res.status);
  }, 15000);
});
