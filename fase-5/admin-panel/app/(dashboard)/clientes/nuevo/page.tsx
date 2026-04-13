"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, type Arquetipo } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ARQUETIPOS: { value: Arquetipo; label: string; descripcion: string }[] = [
  { value: "faq", label: "FAQ", descripcion: "Responde preguntas frecuentes con información estática" },
  { value: "soporte", label: "Soporte", descripcion: "Gestiona tickets, escalaciones y resolución de problemas" },
  { value: "turnos", label: "Turnos", descripcion: "Reserva y gestión de citas o reservas" },
  { value: "ventas", label: "Ventas", descripcion: "Califica leads y cierra ventas conversacionales" },
  { value: "transaccional", label: "Transaccional", descripcion: "Opera sobre sistemas externos (pagos, pedidos, stock)" },
  { value: "interno", label: "Asistente interno", descripcion: "Consulta manuales, políticas y documentación interna" },
]

export default function NuevoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [arquetipo, setArquetipo] = useState<Arquetipo>("faq")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)

    try {
      const cliente = await api.clientes.create({
        nombre: form.get("nombre") as string,
        arquetipo,
        systemPrompt: form.get("systemPrompt") as string,
      })
      router.push(`/clientes/${cliente.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurá el bot antes de entregar el widget
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos básicos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nombre">Nombre del cliente</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ej: Clínica San Martín"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Arquetipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {ARQUETIPOS.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setArquetipo(a.value)}
                    className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                      arquetipo === a.value
                        ? "border-black bg-gray-50 font-medium"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium">{a.label}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">{a.descripcion}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              name="systemPrompt"
              required
              rows={10}
              placeholder="Sos un asistente de [nombre del cliente]. Tu rol es..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creando..." : "Crear cliente"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/clientes")}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
