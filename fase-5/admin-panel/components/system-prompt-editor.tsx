"use client"

import { useState } from "react"
import { api, type Cliente } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  cliente: Cliente
}

export function SystemPromptEditor({ cliente }: Props) {
  const [value, setValue] = useState(cliente.systemPrompt)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.clientes.updateSystemPrompt(cliente.id, value)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">System prompt</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-3">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-input bg-gray-50 px-3 py-3 text-sm font-sans text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
