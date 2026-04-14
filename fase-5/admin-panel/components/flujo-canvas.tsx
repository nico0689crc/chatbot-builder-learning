"use client"

import { useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { NodoDef, AristaDef } from "@/lib/api"

// ── Colores por tipo de nodo ─────────────────────────────────────────────────

const TIPO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  llm_call:      { bg: "#eff6ff", border: "#3b82f6", text: "#1d4ed8" },
  tool_executor: { bg: "#f0fdf4", border: "#22c55e", text: "#15803d" },
  classifier:    { bg: "#fefce8", border: "#eab308", text: "#854d0e" },
  condition:     { bg: "#fff7ed", border: "#f97316", text: "#9a3412" },
  http_request:  { bg: "#fdf4ff", border: "#a855f7", text: "#7e22ce" },
  human_handoff: { bg: "#fff1f2", border: "#f43f5e", text: "#be123c" },
  __start__:     { bg: "#f0fdf4", border: "#16a34a", text: "#14532d" },
  __end__:       { bg: "#fef2f2", border: "#dc2626", text: "#991b1b" },
}

function colorFor(tipo: string) {
  return TIPO_COLORS[tipo] ?? { bg: "#f9fafb", border: "#6b7280", text: "#374151" }
}

// ── Nodo custom ──────────────────────────────────────────────────────────────

function FlowNode({ data }: { data: { label: string; tipo: string; orden?: number } }) {
  const c = colorFor(data.tipo)
  const isStart = data.tipo === "__start__"
  const isEnd = data.tipo === "__end__"

  return (
    <div
      style={{ background: c.bg, borderColor: c.border, color: c.text }}
      className="rounded-lg border-2 px-4 py-2.5 min-w-[120px] text-center shadow-sm"
    >
      {!isStart && <Handle type="target" position={Position.Top} className="!bg-gray-400" />}
      <p className="font-mono font-semibold text-sm">{data.label}</p>
      {!isStart && !isEnd && (
        <p className="text-[10px] mt-0.5 opacity-70">{data.tipo}</p>
      )}
      {data.orden !== undefined && !isStart && !isEnd && (
        <p className="text-[10px] opacity-50">#{data.orden}</p>
      )}
      {!isEnd && <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />}
    </div>
  )
}

const nodeTypes = { flowNode: FlowNode }

// ── Layout automático (columnas por orden) ───────────────────────────────────

function buildLayout(nodos: NodoDef[], aristas: AristaDef[]) {
  // Identificar nodos especiales usados en aristas
  const nombresEnAristas = new Set<string>()
  aristas.forEach((a) => {
    nombresEnAristas.add(a.origen)
    nombresEnAristas.add(a.destino)
  })

  // Nodos virtuales __start__ / __end__
  const todosNombres = new Set<string>([...nodos.map((n) => n.nombre), ...nombresEnAristas])
  const hasStart = todosNombres.has("__start__")
  const hasEnd = todosNombres.has("__end__")

  // Asignar nivel (topológico simplificado por orden)
  const ordenMap: Record<string, number> = {}
  if (hasStart) ordenMap["__start__"] = -1
  if (hasEnd) ordenMap["__end__"] = 999
  nodos.forEach((n) => { ordenMap[n.nombre] = n.orden })

  // Agrupar por nivel
  const byNivel: Record<number, string[]> = {}
  todosNombres.forEach((nombre) => {
    const nivel = ordenMap[nombre] ?? 0
    byNivel[nivel] = byNivel[nivel] ?? []
    byNivel[nivel].push(nombre)
  })

  const niveles = Object.keys(byNivel)
    .map(Number)
    .sort((a, b) => a - b)

  const STEP_Y = 130
  const STEP_X = 200
  const NODE_W = 150

  const posiciones: Record<string, { x: number; y: number }> = {}

  niveles.forEach((nivel, yi) => {
    const grupo = byNivel[nivel]
    const totalW = grupo.length * STEP_X
    const startX = -totalW / 2 + NODE_W / 2
    grupo.forEach((nombre, xi) => {
      posiciones[nombre] = { x: startX + xi * STEP_X, y: yi * STEP_Y }
    })
  })

  return posiciones
}

// ── Componente principal ─────────────────────────────────────────────────────

interface FlujoCanvasProps {
  nodos: NodoDef[]
  aristas: AristaDef[]
}

export function FlujoCanvas({ nodos, aristas }: FlujoCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const posiciones = buildLayout(nodos, aristas)

    // Nodos reales
    const realNodes: Node[] = nodos.map((n) => ({
      id: n.nombre,
      type: "flowNode",
      position: posiciones[n.nombre] ?? { x: 0, y: 0 },
      data: { label: n.nombre, tipo: n.tipo, orden: n.orden },
    }))

    // Nodos virtuales (__start__, __end__)
    const virtualNombres = new Set<string>()
    aristas.forEach((a) => {
      if (!nodos.find((n) => n.nombre === a.origen)) virtualNombres.add(a.origen)
      if (!nodos.find((n) => n.nombre === a.destino)) virtualNombres.add(a.destino)
    })

    const virtualNodes: Node[] = [...virtualNombres].map((nombre) => ({
      id: nombre,
      type: "flowNode",
      position: posiciones[nombre] ?? { x: 0, y: 0 },
      data: { label: nombre, tipo: nombre },
    }))

    // Aristas
    const edges: Edge[] = aristas.map((a, i) => ({
      id: a.id ?? `e-${i}`,
      source: a.origen,
      target: a.destino,
      label: a.condicion ?? undefined,
      labelStyle: { fontSize: 11, fontFamily: "monospace" },
      labelBgStyle: { fill: "#f9fafb", fillOpacity: 0.9 },
      animated: a.condicion === null,
      style: { strokeWidth: 1.5, stroke: "#94a3b8" },
      type: "smoothstep",
    }))

    return { nodes: [...realNodes, ...virtualNodes], edges }
  }, [nodos, aristas])

  if (nodes.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border rounded-lg bg-gray-50">
        Agregá nodos y aristas para ver el grafo
      </div>
    )
  }

  return (
    <div style={{ height: 420 }} className="border rounded-lg overflow-hidden bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const tipo = (n.data as { tipo: string }).tipo
            return colorFor(tipo).border
          }}
          maskColor="rgb(248,250,252,0.7)"
        />
      </ReactFlow>
    </div>
  )
}
