import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { PrismaService } from '../prisma/prisma.service';
import { ToolExecutorService } from './tool-executor.service';
import { GraphInterpreterService } from './graph-interpreter.service';
import { FlowDefinition, NodeType, ReducerType } from './graph-types';

@Injectable()
export class IAService implements OnModuleInit {
  private checkpointer: PostgresSaver;
  private graphCache = new Map<string, any>();

  constructor(
    private prisma: PrismaService,
    private toolExecutor: ToolExecutorService,
    private graphInterpreter: GraphInterpreterService,
  ) {
    this.checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL!);
  }

  async onModuleInit() {
    await this.checkpointer.setup();
  }

  async buildGraph(clienteId: string, systemPrompt: string) {
    // if (this.graphCache.has(clienteId)) {
    //   return this.graphCache.get(clienteId);
    // }

    const [tools, flowDef] = await Promise.all([
      this.toolExecutor.loadToolsForCliente(clienteId),
      this.prisma.flujoDef.findUnique({
        where: { clienteId },
        include: { campos: true, nodos: true, aristas: true },
      }),
    ]);

    if (!flowDef || !flowDef.activo) {
      throw new NotFoundException(`Cliente ${clienteId} no tiene un flujo activo configurado`);
    }

    const flow: FlowDefinition = {
      id: flowDef.id,
      clienteId: flowDef.clienteId,
      campos: flowDef.campos.map(c => ({
        nombre: c.nombre,
        tipo: c.tipo,
        reducer: c.reducer as ReducerType,
        default: c.default,
      })),
      nodes: flowDef.nodos.map(n => ({
        nombre: n.nombre,
        tipo: n.tipo as NodeType,
        config: n.config as Record<string, unknown>,
      })),
      edges: flowDef.aristas.map(a => ({
        origen: a.origen,
        destino: a.destino,
        condicion: a.condicion,
      })),
    };

    const graph = this.graphInterpreter.buildFromDefinition(
      flow,
      systemPrompt,
      tools,
      this.checkpointer,
    );

    this.graphCache.set(clienteId, graph);
    return graph;
  }

  invalidateCache(clienteId: string) {
    this.graphCache.delete(clienteId);
  }
}
