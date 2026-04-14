"use client"

import { useState, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api, type Tool, type Parametro } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"

const METODOS_HTTP = ["GET", "POST", "PUT"] as const
const TIPOS_PARAM = ["string", "number", "boolean"] as const

export default function EditarToolPage({
  params,
}: {
  params: Promise<{ id: string; toolId: string }>
}) {
  const router = useRouter()
  const { id: clienteId, toolId } = use(params)

  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorLoad, setErrorLoad] = useState("")

  // Form state — conector
  const [descripcion, setDescripcion] = useState("")
  const [url, setUrl] = useState("")
  const [metodo, setMetodo] = useState<"GET" | "POST" | "PUT">("GET")
  const [saving, setSaving] = useState(false)
  const [errorSave, setErrorSave] = useState("")
  const [savedOk, setSavedOk] = useState(false)

  // Parámetros
  const [tipoParam, setTipoParam] = useState<"string" | "number" | "boolean">("string")
  const [loadingParam, setLoadingParam] = useState(false)
  const [errorParam, setErrorParam] = useState("")
  const [deletingParamId, setDeletingParamId] = useState<string | null>(null)

  useEffect(() => {
    api.tools.get(clienteId, toolId)
      .then((t) => {
        setTool(t)
        setDescripcion(t.descripcion)
        setUrl(t.conector?.url ?? "")
        if (t.conector?.metodo) setMetodo(t.conector.metodo as "GET" | "POST" | "PUT")
      })
      .catch((e) => setErrorLoad(e instanceof Error ? e.message : "Error al cargar la tool"))
      .finally(() => setLoading(false))
  }, [clienteId, toolId])

  async function handleGuardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tool) return
    setErrorSave("")
    setSavedOk(false)
    setSaving(true)

    const form = new FormData(e.currentTarget)
    try {
      const updated = await api.tools.update(clienteId, toolId, {
        descripcion,
        activa: form.get("activa") === "on",
        url,
        metodo,
      })
      setTool(updated)
      setDescripcion(updated.descripcion)
      setUrl(updated.conector?.url ?? "")
      setSavedOk(true)
    } catch (e) {
      setErrorSave(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  async function handleAgregarParametro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tool) return
    setErrorParam("")
    setLoadingParam(true)

    const form = new FormData(e.currentTarget)
    try {
      const param = await api.tools.addParametro(clienteId, toolId, {
        nombre: form.get("nombre") as string,
        descripcion: form.get("descripcion") as string,
        tipo: tipoParam,
        requerido: form.get("requerido") === "on",
      })
      setTool((prev) => prev ? { ...prev, parametros: [...prev.parametros, param] } : prev)
      ;(e.target as HTMLFormElement).reset()
      setTipoParam("string")
    } catch (e) {
      setErrorParam(e instanceof Error ? e.message : "Error al agregar parámetro")
    } finally {
      setLoadingParam(false)
    }
  }

  async function handleEliminarParametro(parametroId: string) {
    if (!tool) return
    setDeletingParamId(parametroId)
    try {
      await api.tools.deleteParametro(clienteId, toolId, parametroId)
      setTool((prev) =>
        prev ? { ...prev, parametros: prev.parametros.filter((p) => p.id !== parametroId) } : prev
      )
    } catch {
      // silencioso — en un sistema real mostraríamos un toast
    } finally {
      setDeletingParamId(null)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Cargando tool...</div>
  }

  if (errorLoad || !tool) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
          {errorLoad || "Tool no encontrada"}
        </p>
        <Link href={`/clientes/${clienteId}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Volver
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold font-mono">{tool.nombre}</h1>
          <p className="text-sm text-muted-foreground mt-1">Editar tool y parámetros</p>
        </div>
        <Link
          href={`/clientes/${clienteId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Volver
        </Link>
      </div>

      {/* Tool + Conector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conector</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="descripcion">Descripción</Label>
              <Input
                id="descripcion"
                name="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                El LLM usa esta descripción para saber cuándo llamar esta función
              </p>
            </div>

            <div className="space-y-1">
              <Label>
                {tool.conector?.tipo === "GOOGLE_SHEETS" ? "Spreadsheet ID" : "URL del endpoint"}
              </Label>
              <div className="flex gap-2">
                {tool.conector?.tipo === "API_REST" && (
                  <div className="flex gap-1">
                    {METODOS_HTTP.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetodo(m)}
                        className={cn(
                          "px-2.5 py-1.5 rounded-md border text-xs font-mono transition-colors",
                          metodo === m
                            ? "border-black bg-gray-50 font-medium"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  name="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activa"
                name="activa"
                defaultChecked={tool.activa}
                className="rounded"
              />
              <Label htmlFor="activa" className="font-normal cursor-pointer">Tool activa</Label>
            </div>

            {errorSave && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
                {errorSave}
              </p>
            )}
            {savedOk && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
                Cambios guardados
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Parámetros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Parámetros
            <span className="text-muted-foreground font-normal text-sm">
              ({tool.parametros.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tool.parametros.length > 0 && (
            <div className="space-y-2">
              {tool.parametros.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 text-sm bg-gray-50 rounded-md px-3 py-2"
                >
                  <span className="font-mono font-medium">{p.nombre}</span>
                  <Badge variant="secondary" className="text-xs">{p.tipo}</Badge>
                  {p.requerido && <Badge className="text-xs">requerido</Badge>}
                  <span className="text-muted-foreground flex-1">{p.descripcion}</span>
                  <button
                    onClick={() => handleEliminarParametro(p.id)}
                    disabled={deletingParamId === p.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                  >
                    {deletingParamId === p.id ? "..." : "Eliminar"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAgregarParametro} className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Agregar parámetro</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="p-nombre">Nombre</Label>
                <Input
                  id="p-nombre"
                  name="nombre"
                  placeholder="fecha"
                  required
                  pattern="[a-z_]+"
                  title="Solo minúsculas y guiones bajos"
                />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  {TIPOS_PARAM.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoParam(t)}
                      className={cn(
                        "flex-1 py-1.5 rounded-md border text-xs font-mono transition-colors",
                        tipoParam === t
                          ? "border-black bg-gray-50 font-medium"
                          : "border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="p-descripcion">Descripción</Label>
              <Input
                id="p-descripcion"
                name="descripcion"
                placeholder="Fecha de la consulta en formato YYYY-MM-DD"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="requerido" name="requerido" defaultChecked className="rounded" />
              <Label htmlFor="requerido" className="font-normal cursor-pointer">Parámetro requerido</Label>
            </div>

            {errorParam && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
                {errorParam}
              </p>
            )}

            <Button type="submit" variant="outline" disabled={loadingParam}>
              {loadingParam ? "Agregando..." : "+ Agregar parámetro"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
