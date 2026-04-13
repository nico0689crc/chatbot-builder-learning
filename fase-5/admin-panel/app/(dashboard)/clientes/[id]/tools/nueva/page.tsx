"use client"

import { useState } from "react"
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

const TIPOS_CONECTOR = ["API_REST", "GOOGLE_SHEETS"] as const
const METODOS_HTTP = ["GET", "POST", "PUT"] as const
const TIPOS_PARAM = ["string", "number", "boolean"] as const

export default function NuevaToolPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const clienteId = params.id

  // Paso 1: tool creada
  const [tool, setTool] = useState<Tool | null>(null)

  // Paso 1 form state
  const [tipoConector, setTipoConector] = useState<"API_REST" | "GOOGLE_SHEETS">("API_REST")
  const [metodo, setMetodo] = useState<"GET" | "POST" | "PUT">("GET")
  const [loadingTool, setLoadingTool] = useState(false)
  const [errorTool, setErrorTool] = useState("")

  // Paso 2: parámetros
  const [parametros, setParametros] = useState<Parametro[]>([])
  const [tipoParam, setTipoParam] = useState<"string" | "number" | "boolean">("string")
  const [loadingParam, setLoadingParam] = useState(false)
  const [errorParam, setErrorParam] = useState("")

  async function handleCrearTool(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorTool("")
    setLoadingTool(true)

    const form = new FormData(e.currentTarget)
    try {
      const creada = await api.tools.create(clienteId, {
        nombre: form.get("nombre") as string,
        descripcion: form.get("descripcion") as string,
        tipo: tipoConector,
        url: form.get("url") as string,
        metodo,
      })
      setTool(creada)
    } catch (e) {
      setErrorTool(e instanceof Error ? e.message : "Error al crear la tool")
    } finally {
      setLoadingTool(false)
    }
  }

  async function handleAgregarParametro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tool) return
    setErrorParam("")
    setLoadingParam(true)

    const form = new FormData(e.currentTarget)
    try {
      const param = await api.tools.addParametro(clienteId, tool.id, {
        nombre: form.get("nombre") as string,
        descripcion: form.get("descripcion") as string,
        tipo: tipoParam,
        requerido: form.get("requerido") === "on",
      })
      setParametros((prev) => [...prev, param])
      ;(e.target as HTMLFormElement).reset()
      setTipoParam("string")
    } catch (e) {
      setErrorParam(e instanceof Error ? e.message : "Error al agregar parámetro")
    } finally {
      setLoadingParam(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nueva tool</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configurá el conector y luego agregá los parámetros que el LLM puede usar
          </p>
        </div>
        <Link
          href={`/clientes/${clienteId}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← Volver
        </Link>
      </div>

      {/* PASO 1: Tool + Conector */}
      <Card className={tool ? "opacity-60" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">1</span>
            Tool y conector
            {tool && <Badge variant="secondary" className="ml-auto">Creada ✓</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tool ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-mono font-medium text-foreground">{tool.nombre}</span>
              {" "}— {tool.descripcion}
            </p>
          ) : (
            <form onSubmit={handleCrearTool} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="nombre">Nombre de función</Label>
                  <Input
                    id="nombre"
                    name="nombre"
                    placeholder="consultar_disponibilidad"
                    required
                    pattern="[a-z_]+"
                    title="Solo minúsculas y guiones bajos"
                  />
                  <p className="text-xs text-muted-foreground">Solo minúsculas y _</p>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de conector</Label>
                  <div className="flex gap-2">
                    {TIPOS_CONECTOR.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoConector(t)}
                        className={cn(
                          "flex-1 py-1.5 rounded-md border text-sm transition-colors",
                          tipoConector === t
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
                <Label htmlFor="descripcion">Descripción</Label>
                <Input
                  id="descripcion"
                  name="descripcion"
                  placeholder="Consulta la disponibilidad de turnos en el sistema"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El LLM usa esta descripción para saber cuándo llamar esta función
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="url">
                  {tipoConector === "GOOGLE_SHEETS" ? "Spreadsheet ID" : "URL del endpoint"}
                </Label>
                <div className="flex gap-2">
                  {tipoConector === "API_REST" && (
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
                    id="url"
                    name="url"
                    placeholder={
                      tipoConector === "GOOGLE_SHEETS"
                        ? "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                        : "https://api.ejemplo.com/turnos"
                    }
                    required
                    className="flex-1"
                  />
                </div>
              </div>

              {errorTool && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
                  {errorTool}
                </p>
              )}

              <Button type="submit" disabled={loadingTool}>
                {loadingTool ? "Creando..." : "Crear tool"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* PASO 2: Parámetros */}
      <Card className={!tool ? "opacity-40 pointer-events-none" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">2</span>
            Parámetros
            <span className="text-muted-foreground font-normal text-sm ml-1">({parametros.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {parametros.length > 0 && (
            <div className="space-y-2">
              {parametros.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 text-sm bg-gray-50 rounded-md px-3 py-2"
                >
                  <span className="font-mono font-medium">{p.nombre}</span>
                  <Badge variant="secondary" className="text-xs">{p.tipo}</Badge>
                  {p.requerido && <Badge className="text-xs">requerido</Badge>}
                  <span className="text-muted-foreground flex-1">{p.descripcion}</span>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAgregarParametro} className="space-y-4 border-t pt-4">
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

      {tool && (
        <div className="flex gap-3">
          <Button onClick={() => router.push(`/clientes/${clienteId}`)}>
            Finalizar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setTool(null)
              setParametros([])
            }}
          >
            Agregar otra tool
          </Button>
        </div>
      )}
    </div>
  )
}
