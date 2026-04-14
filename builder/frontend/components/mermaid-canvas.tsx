"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

interface MermaidCanvasProps {
  clienteId: string
}

export function MermaidCanvas({ clienteId }: MermaidCanvasProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setSvg(null)

      try {
        const { diagram } = await api.flujo.getMermaid(clienteId)
        if (cancelled) return

        const mermaid = (await import("mermaid")).default
        mermaid.initialize({ startOnLoad: false, theme: "neutral" })

        const { svg: rendered } = await mermaid.render(
          "mermaid-diagram-" + clienteId + "-" + refreshKey,
          diagram,
        )
        if (!cancelled) setSvg(rendered)
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error al renderizar el diagrama")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clienteId, refreshKey])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Diagrama compilado</span>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="text-sm px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Cargando..." : "Actualizar diagrama"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {svg && (
        <div
          className="rounded-lg border bg-white p-4 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {!svg && !error && !loading && (
        <div className="h-48 flex items-center justify-center rounded-lg border bg-gray-50 text-sm text-gray-400">
          Sin diagrama disponible
        </div>
      )}

      {loading && !svg && (
        <div className="h-48 flex items-center justify-center rounded-lg border bg-gray-50 text-sm text-gray-400">
          Cargando diagrama...
        </div>
      )}
    </div>
  )
}
