"use client"

import { useState } from "react"
import { api, type Cliente } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface Props {
  cliente: Cliente
  apiUrl: string
}

export function WidgetConfig({ cliente, apiUrl }: Props) {
  const [color, setColor] = useState(cliente.widgetColor || "#2563eb")
  const [nombre, setNombre] = useState(cliente.widgetNombre || "")
  const [bienvenida, setBienvenida] = useState(cliente.widgetBienvenida || "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const snippet = `<script src="${apiUrl}/public/widget.js" data-client-id="${cliente.id}" data-api-url="${apiUrl}"></script>`

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await api.clientes.updateWidget(cliente.id, {
        widgetNombre: nombre,
        widgetColor: color,
        widgetBienvenida: bienvenida,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Widget</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Configuración */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="widgetNombre">Nombre en el chat</Label>
              <Input
                id="widgetNombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={cliente.nombre}
              />
              <p className="text-xs text-muted-foreground">
                Por defecto usa el nombre del cliente
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="widgetColor">Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="widgetColor"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-9 rounded border border-input cursor-pointer p-0.5"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="widgetBienvenida">Mensaje de bienvenida</Label>
            <Input
              id="widgetBienvenida"
              value={bienvenida}
              onChange={(e) => setBienvenida(e.target.value)}
              placeholder="Hola, ¿en qué te puedo ayudar?"
            />
          </div>

          {/* Preview */}
          <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow"
                style={{ background: color }}
              >
                💬
              </div>
              <div className="rounded-lg px-3 py-2 text-sm max-w-xs" style={{ background: color + "1a", color: "#1e293b" }}>
                {bienvenida || "Hola, ¿en qué te puedo ayudar?"}
              </div>
            </div>
            <div
              className="inline-block text-white text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: color }}
            >
              {nombre || cliente.nombre}
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar cambios"}
          </Button>
        </form>

        {/* Snippet para copiar */}
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Código para instalar en el sitio web</p>
          <p className="text-xs text-muted-foreground">
            Pegá este script antes del cierre del <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code>
          </p>
          <div className="relative">
            <pre className="bg-gray-950 text-gray-100 text-xs rounded-lg p-4 overflow-x-auto pr-24 leading-relaxed">
              {snippet}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </Button>
          </div>
          <Link target="_blank" href={`/public/${cliente.id}`} className="text-xs text-black underline underline-offset-2 mt-2 inline-block">
            Ver página pública
          </Link>
        </div>

      </CardContent>
    </Card>
  )
}
