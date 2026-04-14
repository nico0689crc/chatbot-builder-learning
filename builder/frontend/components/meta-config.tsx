"use client"

import { useState } from "react"
import { api, type Cliente } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  cliente: Cliente
}

export function MetaConfig({ cliente }: Props) {
  const [phoneNumberId, setPhoneNumberId] = useState(cliente.metaPhoneNumberId ?? "")
  const [accessToken, setAccessToken] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenConfigurado = Boolean(cliente.metaPhoneNumberId)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.clientes.updateMeta(cliente.id, {
        metaPhoneNumberId: phoneNumberId || undefined,
        // Solo enviar el token si el usuario escribió algo nuevo
        metaAccessToken: accessToken || undefined,
      })
      setSaved(true)
      setAccessToken("") // limpiar campo sensible tras guardar
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
        <CardTitle className="text-base flex items-center gap-2">
          Meta / WhatsApp
          {tokenConfigurado && (
            <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              Configurado
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="phoneNumberId">Phone Number ID</Label>
            <Input
              id="phoneNumberId"
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="123456789012345"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Se encuentra en Meta for Developers → WhatsApp → API Setup
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="accessToken">
              Access Token
              {tokenConfigurado && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  (ya configurado — dejá vacío para no modificarlo)
                </span>
              )}
            </Label>
            <Input
              id="accessToken"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={tokenConfigurado ? "••••••••••••••••" : "EAAxxxxxxx..."}
              className="font-mono"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Se encripta antes de guardarse en la base de datos
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar configuración"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
