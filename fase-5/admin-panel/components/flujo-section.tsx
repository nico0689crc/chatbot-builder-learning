"use client"

import { useState } from "react"
import {
  api,
  type FlujoDef,
  type NodoDef,
  type AristaDef,
  type CampoDef,
  type TipoNodo,
  type TipoCampo,
  type ReducerCampo,
} from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { FlujoCanvas } from "@/components/flujo-canvas"
import { ConfigForm } from "@/components/config-form"

const TIPOS_NODO: TipoNodo[] = [
  "llm_call",
  "tool_executor",
  "classifier",
  "condition",
  "http_request",
  "human_handoff",
]
const TIPOS_CAMPO: TipoCampo[] = ["string", "number", "boolean", "object", "array"]
const REDUCERS: ReducerCampo[] = ["last_wins", "append"]

// ── NodoRow ───────────────────────────────────────────────────────────────────

function NodoRow({
  nodo,
  clienteId,
  onUpdate,
  onDelete,
}: {
  nodo: NodoDef
  clienteId: string
  onUpdate: (updated: NodoDef) => void
  onDelete: (nombre: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [tipo, setTipo] = useState<TipoNodo>(nodo.tipo as TipoNodo)
  const [config, setConfig] = useState<Record<string, unknown>>(nodo.config)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  function handleCancelar() {
    setEditing(false)
    setError("")
    setTipo(nodo.tipo as TipoNodo)
    setConfig(nodo.config)
  }

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setSaving(true)
    const form = new FormData(e.currentTarget)
    try {
      const updated = await api.flujo.updateNodo(clienteId, nodo.nombre, {
        tipo,
        orden: Number(form.get("orden")),
        config,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar() {
    setDeleting(true)
    try {
      await api.flujo.deleteNodo(clienteId, nodo.nombre)
      onDelete(nodo.nombre)
    } catch {
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 text-sm bg-gray-50 rounded-md px-3 py-2">
        <span className="font-mono font-medium w-28 shrink-0">{nodo.nombre}</span>
        <Badge variant="secondary" className="text-xs shrink-0">{nodo.tipo}</Badge>
        <span className="text-muted-foreground text-xs shrink-0">orden: {nodo.orden}</span>
        <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
          {Object.keys(nodo.config).length > 0 ? JSON.stringify(nodo.config) : "—"}
        </span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 transition-colors shrink-0">
          Editar
        </button>
        <button onClick={handleEliminar} disabled={deleting} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors shrink-0">
          {deleting ? "..." : "Eliminar"}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleGuardar} className="border rounded-md p-4 space-y-3 bg-blue-50/30">
      <p className="text-sm font-medium font-mono">{nodo.nombre}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <div className="flex flex-wrap gap-1">
            {TIPOS_NODO.map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn("px-2 py-1 rounded border text-xs font-mono transition-colors",
                  tipo === t ? "border-black bg-white font-medium" : "border-gray-200 hover:border-gray-300")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`orden-${nodo.nombre}`} className="text-xs">Orden</Label>
          <Input id={`orden-${nodo.nombre}`} name="orden" type="number" defaultValue={nodo.orden} min={0} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Config</Label>
        <ConfigForm tipo={tipo} value={config} onChange={setConfig} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── AristaRow ─────────────────────────────────────────────────────────────────

function AristaRow({
  arista,
  clienteId,
  nodos,
  onUpdate,
  onDelete,
}: {
  arista: AristaDef
  clienteId: string
  nodos: { nombre: string }[]
  onUpdate: (updated: AristaDef) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const condicion = (form.get("condicion") as string).trim() || null
    try {
      const updated = await api.flujo.updateArista(clienteId, arista.id, {
        origen: form.get("origen") as string,
        destino: form.get("destino") as string,
        condicion,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar() {
    setDeleting(true)
    try {
      await api.flujo.deleteArista(clienteId, arista.id)
      onDelete(arista.id)
    } catch {
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 text-sm bg-gray-50 rounded-md px-3 py-2">
        <span className="font-mono text-xs">{arista.origen}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-xs">{arista.destino}</span>
        {arista.condicion && <Badge variant="outline" className="text-xs font-mono">{arista.condicion}</Badge>}
        <span className="flex-1" />
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 transition-colors shrink-0">
          Editar
        </button>
        <button onClick={handleEliminar} disabled={deleting} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors shrink-0">
          {deleting ? "..." : "Eliminar"}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleGuardar} className="border rounded-md p-4 space-y-3 bg-blue-50/30">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Origen</Label>
          <select name="origen" defaultValue={arista.origen} required
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="__start__">__start__</option>
            {nodos.map((n) => <option key={n.nombre} value={n.nombre}>{n.nombre}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Destino</Label>
          <select name="destino" defaultValue={arista.destino} required
            className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {nodos.map((n) => <option key={n.nombre} value={n.nombre}>{n.nombre}</option>)}
            <option value="__end__">__end__</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Condición</Label>
          <Input name="condicion" defaultValue={arista.condicion ?? ""} placeholder="consulta (opcional)" className="h-8 text-xs" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setError("") }}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── CampoRow ──────────────────────────────────────────────────────────────────

function CampoRow({
  campo,
  clienteId,
  onUpdate,
  onDelete,
}: {
  campo: CampoDef
  clienteId: string
  onUpdate: (updated: CampoDef) => void
  onDelete: (nombre: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [tipo, setTipo] = useState<TipoCampo>(campo.tipo as TipoCampo)
  const [reducer, setReducer] = useState<ReducerCampo>(campo.reducer as ReducerCampo)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setSaving(true)
    const form = new FormData(e.currentTarget)
    try {
      const updated = await api.flujo.updateCampo(clienteId, campo.nombre, {
        tipo,
        reducer,
        default: (form.get("default") as string).trim() || undefined,
      })
      onUpdate(updated)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar() {
    setDeleting(true)
    try {
      await api.flujo.deleteCampo(clienteId, campo.nombre)
      onDelete(campo.nombre)
    } catch {
      setDeleting(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 text-sm bg-gray-50 rounded-md px-3 py-2">
        <span className="font-mono font-medium w-28 shrink-0">{campo.nombre}</span>
        <Badge variant="secondary" className="text-xs shrink-0">{campo.tipo}</Badge>
        <Badge variant="outline" className="text-xs shrink-0">{campo.reducer}</Badge>
        <span className="text-muted-foreground text-xs font-mono flex-1">default: {campo.default}</span>
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-800 transition-colors shrink-0">
          Editar
        </button>
        <button onClick={handleEliminar} disabled={deleting} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors shrink-0">
          {deleting ? "..." : "Eliminar"}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleGuardar} className="border rounded-md p-4 space-y-3 bg-blue-50/30">
      <p className="text-sm font-medium font-mono">{campo.nombre}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <div className="flex flex-wrap gap-1">
            {TIPOS_CAMPO.map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={cn("px-2 py-1 rounded border text-xs font-mono transition-colors",
                  tipo === t ? "border-black bg-white font-medium" : "border-gray-200 hover:border-gray-300")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reducer</Label>
          <div className="flex gap-2">
            {REDUCERS.map((r) => (
              <button key={r} type="button" onClick={() => setReducer(r)}
                className={cn("flex-1 py-1 rounded border text-xs font-mono transition-colors",
                  reducer === r ? "border-black bg-white font-medium" : "border-gray-200 hover:border-gray-300")}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`default-${campo.nombre}`} className="text-xs">Default (JSON)</Label>
        <Input id={`default-${campo.nombre}`} name="default" defaultValue={campo.default} className="font-mono text-xs h-8" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(false); setError("") }}>Cancelar</Button>
      </div>
    </form>
  )
}

// ── FlujoSection (export principal) ──────────────────────────────────────────

export function FlujoSection({
  clienteId,
  initialFlujo,
}: {
  clienteId: string
  initialFlujo: FlujoDef | null
}) {
  const [flujo, setFlujo] = useState<FlujoDef | null>(initialFlujo)

  // Crear flujo
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState("")

  // Eliminar flujo
  const [eliminando, setEliminando] = useState(false)

  // Nodo form
  const [tipoNodo, setTipoNodo] = useState<TipoNodo>("llm_call")
  const [configNodo, setConfigNodo] = useState<Record<string, unknown>>({})
  const [savingNodo, setSavingNodo] = useState(false)
  const [errorNodo, setErrorNodo] = useState("")

  // Arista form
  const [savingArista, setSavingArista] = useState(false)
  const [errorArista, setErrorArista] = useState("")

  // Campo form
  const [tipoCampo, setTipoCampo] = useState<TipoCampo>("string")
  const [reducerCampo, setReducerCampo] = useState<ReducerCampo>("last_wins")
  const [savingCampo, setSavingCampo] = useState(false)
  const [errorCampo, setErrorCampo] = useState("")

  async function handleCrearFlujo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorCrear("")
    setCreando(true)
    const form = new FormData(e.currentTarget)
    try {
      const f = await api.flujo.create(clienteId, {
        nombre: form.get("nombre") as string,
        descripcion: form.get("descripcion") as string,
      })
      setFlujo(f)
    } catch (e) {
      setErrorCrear(e instanceof Error ? e.message : "Error al crear el flujo")
    } finally {
      setCreando(false)
    }
  }

  async function handleEliminarFlujo() {
    if (!confirm("¿Eliminar el flujo completo? Esta acción es irreversible.")) return
    setEliminando(true)
    try {
      await api.flujo.delete(clienteId)
      setFlujo(null)
    } catch {
      setEliminando(false)
    }
  }

  async function handleAgregarNodo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorNodo("")
    setSavingNodo(true)
    const form = new FormData(e.currentTarget)
    try {
      const nodo = await api.flujo.addNodo(clienteId, {
        nombre: form.get("nombre") as string,
        tipo: tipoNodo,
        orden: Number(form.get("orden") || 0),
        config: configNodo,
      })
      setFlujo((prev) =>
        prev ? { ...prev, nodos: [...prev.nodos, nodo].sort((a, b) => a.orden - b.orden) } : prev
      )
      ;(e.target as HTMLFormElement).reset()
      setTipoNodo("llm_call")
      setConfigNodo({})
    } catch (e) {
      setErrorNodo(e instanceof Error ? e.message : "Error al agregar nodo")
    } finally {
      setSavingNodo(false)
    }
  }

  async function handleAgregarArista(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorArista("")
    setSavingArista(true)
    const form = new FormData(e.currentTarget)
    const condicion = (form.get("condicion") as string).trim() || undefined
    try {
      const arista = await api.flujo.addArista(clienteId, {
        origen: form.get("origen") as string,
        destino: form.get("destino") as string,
        condicion,
      })
      setFlujo((prev) => prev ? { ...prev, aristas: [...prev.aristas, arista] } : prev)
      ;(e.target as HTMLFormElement).reset()
    } catch (e) {
      setErrorArista(e instanceof Error ? e.message : "Error al agregar arista")
    } finally {
      setSavingArista(false)
    }
  }

  async function handleAgregarCampo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorCampo("")
    setSavingCampo(true)
    const form = new FormData(e.currentTarget)
    try {
      const campo = await api.flujo.addCampo(clienteId, {
        nombre: form.get("nombre") as string,
        tipo: tipoCampo,
        reducer: reducerCampo,
        default: (form.get("default") as string).trim() || undefined,
      })
      setFlujo((prev) => prev ? { ...prev, campos: [...prev.campos, campo] } : prev)
      ;(e.target as HTMLFormElement).reset()
      setTipoCampo("string")
      setReducerCampo("last_wins")
    } catch (e) {
      setErrorCampo(e instanceof Error ? e.message : "Error al agregar campo")
    } finally {
      setSavingCampo(false)
    }
  }

  // ── Sin flujo: form de creación ─────────────────────────────────────────────

  if (!flujo) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Flujo de ejecución</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCrearFlujo} className="space-y-4 max-w-sm">
            <div className="space-y-1">
              <Label htmlFor="flujo-nombre">Nombre</Label>
              <Input id="flujo-nombre" name="nombre" placeholder="Bot Clínica" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flujo-descripcion">Descripción</Label>
              <Input id="flujo-descripcion" name="descripcion" placeholder="Flujo de atención al cliente" />
            </div>
            {errorCrear && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">{errorCrear}</p>
            )}
            <Button type="submit" disabled={creando}>{creando ? "Creando..." : "Crear flujo"}</Button>
          </form>
        </CardContent>
      </Card>
    )
  }

  // ── Con flujo: editor completo ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header de la sección */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{flujo.nombre}</h2>
          {flujo.descripcion && <p className="text-sm text-muted-foreground">{flujo.descripcion}</p>}
        </div>
        <Button variant="destructive" size="sm" onClick={handleEliminarFlujo} disabled={eliminando}>
          {eliminando ? "Eliminando..." : "Eliminar flujo"}
        </Button>
      </div>

      {/* Canvas */}
      <FlujoCanvas nodos={flujo.nodos} aristas={flujo.aristas} />

      {/* Nodos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Nodos <span className="text-muted-foreground font-normal text-sm">({flujo.nodos.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {flujo.nodos.length > 0 && (
            <div className="space-y-2">
              {flujo.nodos.map((n) => (
                <NodoRow key={n.id} nodo={n} clienteId={clienteId}
                  onUpdate={(updated) =>
                    setFlujo((prev) => prev
                      ? { ...prev, nodos: prev.nodos.map((x) => x.id === updated.id ? updated : x).sort((a, b) => a.orden - b.orden) }
                      : prev)
                  }
                  onDelete={(nombre) =>
                    setFlujo((prev) => prev ? { ...prev, nodos: prev.nodos.filter((x) => x.nombre !== nombre) } : prev)
                  }
                />
              ))}
            </div>
          )}

          <form onSubmit={handleAgregarNodo} className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Agregar nodo</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="n-nombre">Nombre</Label>
                <Input id="n-nombre" name="nombre" placeholder="clasificador" required pattern="[a-z_]+" title="Solo minúsculas y guiones bajos" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="n-orden">Orden</Label>
                <Input id="n-orden" name="orden" type="number" defaultValue={0} min={0} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-1">
                {TIPOS_NODO.map((t) => (
                  <button key={t} type="button" onClick={() => { setTipoNodo(t); setConfigNodo({}) }}
                    className={cn("px-2.5 py-1.5 rounded-md border text-xs font-mono transition-colors",
                      tipoNodo === t ? "border-black bg-gray-50 font-medium" : "border-gray-200 hover:border-gray-300")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Config</Label>
              <ConfigForm tipo={tipoNodo} value={configNodo} onChange={setConfigNodo} />
            </div>
            {errorNodo && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">{errorNodo}</p>}
            <Button type="submit" variant="outline" size="sm" disabled={savingNodo}>
              {savingNodo ? "Agregando..." : "+ Agregar nodo"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Aristas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aristas <span className="text-muted-foreground font-normal text-sm">({flujo.aristas.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {flujo.aristas.length > 0 && (
            <div className="space-y-2">
              {flujo.aristas.map((a) => (
                <AristaRow key={a.id} arista={a} clienteId={clienteId} nodos={flujo.nodos}
                  onUpdate={(updated) =>
                    setFlujo((prev) => prev ? { ...prev, aristas: prev.aristas.map((x) => x.id === updated.id ? updated : x) } : prev)
                  }
                  onDelete={(id) =>
                    setFlujo((prev) => prev ? { ...prev, aristas: prev.aristas.filter((x) => x.id !== id) } : prev)
                  }
                />
              ))}
            </div>
          )}

          <form onSubmit={handleAgregarArista} className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Agregar arista</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="a-origen">Origen</Label>
                <select id="a-origen" name="origen" required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="__start__">__start__</option>
                  {flujo.nodos.map((n) => <option key={n.nombre} value={n.nombre}>{n.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-destino">Destino</Label>
                <select id="a-destino" name="destino" required
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {flujo.nodos.map((n) => <option key={n.nombre} value={n.nombre}>{n.nombre}</option>)}
                  <option value="__end__">__end__</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="a-condicion">Condición</Label>
                <Input id="a-condicion" name="condicion" placeholder="consulta (opcional)" />
              </div>
            </div>
            {errorArista && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">{errorArista}</p>}
            <Button type="submit" variant="outline" size="sm" disabled={savingArista}>
              {savingArista ? "Agregando..." : "+ Agregar arista"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Campos de estado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Campos de estado <span className="text-muted-foreground font-normal text-sm">({flujo.campos.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {flujo.campos.length > 0 && (
            <div className="space-y-2">
              {flujo.campos.map((c) => (
                <CampoRow key={c.id} campo={c} clienteId={clienteId}
                  onUpdate={(updated) =>
                    setFlujo((prev) => prev ? { ...prev, campos: prev.campos.map((x) => x.id === updated.id ? updated : x) } : prev)
                  }
                  onDelete={(nombre) =>
                    setFlujo((prev) => prev ? { ...prev, campos: prev.campos.filter((x) => x.nombre !== nombre) } : prev)
                  }
                />
              ))}
            </div>
          )}

          <form onSubmit={handleAgregarCampo} className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Agregar campo</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="c-nombre">Nombre</Label>
                <Input id="c-nombre" name="nombre" placeholder="categoria" required pattern="[a-z_]+" title="Solo minúsculas y guiones bajos" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-default">Default (JSON)</Label>
                <Input id="c-default" name="default" placeholder='"sin_clasificar"' className="font-mono text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <div className="flex flex-wrap gap-1">
                  {TIPOS_CAMPO.map((t) => (
                    <button key={t} type="button" onClick={() => setTipoCampo(t)}
                      className={cn("px-2 py-1 rounded border text-xs font-mono transition-colors",
                        tipoCampo === t ? "border-black bg-gray-50 font-medium" : "border-gray-200 hover:border-gray-300")}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reducer</Label>
                <div className="flex gap-2">
                  {REDUCERS.map((r) => (
                    <button key={r} type="button" onClick={() => setReducerCampo(r)}
                      className={cn("flex-1 py-1.5 rounded border text-xs font-mono transition-colors",
                        reducerCampo === r ? "border-black bg-gray-50 font-medium" : "border-gray-200 hover:border-gray-300")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {errorCampo && <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">{errorCampo}</p>}
            <Button type="submit" variant="outline" size="sm" disabled={savingCampo}>
              {savingCampo ? "Agregando..." : "+ Agregar campo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
