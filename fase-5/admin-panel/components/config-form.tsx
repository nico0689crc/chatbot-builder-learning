"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { TipoNodo } from "@/lib/api"

// ── Shared helpers ───────────────────────────────────────────────────────────

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>
}

function KVPairs({
  label,
  value,
  onChange,
  keyPlaceholder = "clave",
  valuePlaceholder = "valor",
  valueOptions,
}: {
  label: string
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  valueOptions?: string[]
}) {
  const entries = Object.entries(value)
  function update(i: number, k: string, v: string) {
    const next = [...entries]
    next[i] = [k, v]
    onChange(Object.fromEntries(next))
  }
  function remove(i: number) {
    onChange(Object.fromEntries(entries.filter((_, j) => j !== i)))
  }
  return (
    <FieldRow>
      {label && <Label className="text-xs">{label}</Label>}
      <div className="space-y-1">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-1 items-center">
            <Input
              className="h-7 text-xs font-mono"
              value={k}
              placeholder={keyPlaceholder}
              onChange={(e) => update(i, e.target.value, v)}
            />
            <span className="text-muted-foreground text-xs shrink-0">→</span>
            {valueOptions ? (
              <select
                className="h-7 text-xs border rounded px-1 flex-1 bg-background"
                value={v}
                onChange={(e) => update(i, k, e.target.value)}
              >
                {valueOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <Input
                className="h-7 text-xs font-mono"
                value={v}
                placeholder={valuePlaceholder}
                onChange={(e) => update(i, k, e.target.value)}
              />
            )}
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-600 w-5 shrink-0"
              onClick={() => remove(i)}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-xs text-blue-500 hover:text-blue-700"
          onClick={() => onChange({ ...value, "": valueOptions ? valueOptions[0] : "" })}
        >
          + Agregar
        </button>
      </div>
    </FieldRow>
  )
}

function TagsInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  function add() {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft("")
  }
  return (
    <FieldRow>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1 min-h-[24px]">
        {value.map((t, i) => (
          <span key={i} className="flex items-center gap-0.5 bg-gray-100 rounded px-2 py-0.5 text-xs font-mono">
            {t}
            <button
              type="button"
              className="ml-1 text-red-400 hover:text-red-600"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          className="h-7 text-xs flex-1"
          value={draft}
          placeholder="categoría (Enter para agregar)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 border"
          onClick={add}
        >
          +
        </button>
      </div>
    </FieldRow>
  )
}

// ── llm_call ─────────────────────────────────────────────────────────────────

function LlmCallForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  const modelName = (value.modelName as string) ?? ""
  const outputFields = (value.outputFields as Record<string, string>) ?? {}

  return (
    <div className="space-y-3">
      <FieldRow>
        <Label className="text-xs">Model name (opcional)</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={modelName}
          placeholder="claude-sonnet-4-6"
          onChange={(e) =>
            onChange({ ...value, modelName: e.target.value || undefined })
          }
        />
      </FieldRow>
      <KVPairs
        label="Output fields — campo del estado → tipo"
        value={outputFields}
        onChange={(v) =>
          onChange({ ...value, outputFields: Object.keys(v).length ? v : undefined })
        }
        keyPlaceholder="campo"
        valuePlaceholder="string"
        valueOptions={["string", "number", "boolean"]}
      />
    </div>
  )
}

// ── classifier ───────────────────────────────────────────────────────────────

function ClassifierSingleForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  return (
    <div className="space-y-3">
      <FieldRow>
        <Label className="text-xs">Field (campo del estado donde guardar la categoría)</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={(value.field as string) ?? ""}
          placeholder="categoria"
          onChange={(e) => onChange({ ...value, field: e.target.value })}
        />
      </FieldRow>
      <TagsInput
        label="Categorías"
        value={(value.categories as string[]) ?? []}
        onChange={(v) => onChange({ ...value, categories: v })}
      />
      <FieldRow>
        <Label className="text-xs">Prompt de clasificación</Label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={4}
          value={(value.prompt as string) ?? ""}
          placeholder="Clasificá el mensaje en exactamente una de las categorías..."
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
        />
      </FieldRow>
    </div>
  )
}

interface ClassifierField {
  field: string
  categories: string[]
  prompt: string
}

function ClassifierMultiForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  const fields = (value.fields as ClassifierField[]) ?? []

  function updateField(i: number, updated: ClassifierField) {
    const next = [...fields]
    next[i] = updated
    onChange({ ...value, fields: next })
  }
  function removeField(i: number) {
    onChange({ ...value, fields: fields.filter((_, j) => j !== i) })
  }

  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={i} className="border rounded p-3 space-y-2 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Campo {i + 1}</span>
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-600"
              onClick={() => removeField(i)}
            >
              Eliminar
            </button>
          </div>
          <FieldRow>
            <Label className="text-xs">Field</Label>
            <Input
              className="h-7 text-xs font-mono"
              value={f.field}
              placeholder="categoria"
              onChange={(e) => updateField(i, { ...f, field: e.target.value })}
            />
          </FieldRow>
          <TagsInput
            label="Categorías"
            value={f.categories}
            onChange={(v) => updateField(i, { ...f, categories: v })}
          />
          <FieldRow>
            <Label className="text-xs">Prompt</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y"
              rows={3}
              value={f.prompt}
              placeholder="Clasificá el mensaje..."
              onChange={(e) => updateField(i, { ...f, prompt: e.target.value })}
            />
          </FieldRow>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-blue-500 hover:text-blue-700"
        onClick={() =>
          onChange({ ...value, fields: [...fields, { field: "", categories: [], prompt: "" }] })
        }
      >
        + Agregar campo
      </button>
    </div>
  )
}

function ClassifierForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  const hasMulti = Array.isArray(value.fields) && (value.fields as unknown[]).length > 0
  const [mode, setMode] = useState<"single" | "multi">(hasMulti ? "multi" : "single")

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["single", "multi"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "px-2 py-1 rounded border text-xs font-mono transition-colors",
              mode === m ? "border-black bg-white font-medium" : "border-gray-200 hover:border-gray-300"
            )}
          >
            {m === "single" ? "Campo único" : "Multi-campo"}
          </button>
        ))}
      </div>
      {mode === "single" ? (
        <ClassifierSingleForm value={value} onChange={onChange} />
      ) : (
        <ClassifierMultiForm value={value} onChange={onChange} />
      )}
    </div>
  )
}

// ── condition ────────────────────────────────────────────────────────────────

function ConditionForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  return (
    <div className="space-y-3">
      <FieldRow>
        <Label className="text-xs">Field (campo del estado a evaluar)</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={(value.field as string) ?? ""}
          placeholder="categoria"
          onChange={(e) => onChange({ ...value, field: e.target.value })}
        />
      </FieldRow>
      <KVPairs
        label="Mapping — valor → nodo destino"
        value={(value.mapping as Record<string, string>) ?? {}}
        onChange={(v) => onChange({ ...value, mapping: v })}
        keyPlaceholder="consulta"
        valuePlaceholder="nodo_destino"
      />
      <FieldRow>
        <Label className="text-xs">Default (nodo si no hay match)</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={(value.default as string) ?? ""}
          placeholder="__end__"
          onChange={(e) => onChange({ ...value, default: e.target.value })}
        />
      </FieldRow>
    </div>
  )
}

// ── http_request ─────────────────────────────────────────────────────────────

function HttpRequestForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  const method = (value.method as string) ?? "GET"
  const fieldMap = (value.fieldMap as Record<string, string>) ?? {}
  const useFieldMap = Object.keys(fieldMap).length > 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2 items-end">
        <FieldRow>
          <Label className="text-xs">Método</Label>
          <div className="flex gap-1">
            {["GET", "POST", "PUT"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...value, method: m })}
                className={cn(
                  "flex-1 py-1 rounded border text-xs font-mono transition-colors",
                  method === m ? "border-black bg-white font-medium" : "border-gray-200 hover:border-gray-300"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </FieldRow>
        <div className="col-span-3 space-y-1">
          <Label className="text-xs">URL</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={(value.url as string) ?? ""}
            placeholder="https://api.ejemplo.com/endpoint"
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
        </div>
      </div>
      <KVPairs
        label="Headers (opcional)"
        value={(value.headers as Record<string, string>) ?? {}}
        onChange={(v) =>
          onChange({ ...value, headers: Object.keys(v).length ? v : undefined })
        }
        keyPlaceholder="Authorization"
        valuePlaceholder="Bearer token"
      />
      {method !== "GET" && (
        <FieldRow>
          <Label className="text-xs">Body template (opcional — usá {"{{campo}}"} para variables)</Label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y"
            rows={3}
            value={(value.bodyTemplate as string) ?? ""}
            placeholder={'{"fecha": "{{fecha}}", "hora": "{{hora}}"}'}
            onChange={(e) =>
              onChange({ ...value, bodyTemplate: e.target.value || undefined })
            }
          />
        </FieldRow>
      )}
      <div className="space-y-2">
        <Label className="text-xs">Resultado</Label>
        <div className="flex gap-2">
          {(["single", "map"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (m === "single") onChange({ ...value, fieldMap: undefined })
                else onChange({ ...value, resultField: undefined, fieldMap: {} })
              }}
              className={cn(
                "px-2 py-1 rounded border text-xs font-mono transition-colors",
                (m === "single") === !useFieldMap
                  ? "border-black bg-white font-medium"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              {m === "single" ? "Campo único" : "Field map"}
            </button>
          ))}
        </div>
        {!useFieldMap ? (
          <Input
            className="h-8 text-xs font-mono"
            value={(value.resultField as string) ?? ""}
            placeholder="resultado"
            onChange={(e) =>
              onChange({ ...value, resultField: e.target.value || undefined })
            }
          />
        ) : (
          <KVPairs
            label=""
            value={fieldMap}
            onChange={(v) =>
              onChange({ ...value, fieldMap: Object.keys(v).length ? v : undefined })
            }
            keyPlaceholder="campo_estado"
            valuePlaceholder="dot.path.respuesta"
          />
        )}
      </div>
    </div>
  )
}

// ── human_handoff ─────────────────────────────────────────────────────────────

function HumanHandoffForm({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  return (
    <div className="space-y-3">
      <FieldRow>
        <Label className="text-xs">Mensaje al usuario</Label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
          value={(value.message as string) ?? ""}
          placeholder="Un agente humano se pondrá en contacto contigo en breve."
          onChange={(e) => onChange({ ...value, message: e.target.value })}
        />
      </FieldRow>
      <FieldRow>
        <Label className="text-xs">Escalated field (opcional — campo booleano del estado)</Label>
        <Input
          className="h-8 text-xs font-mono"
          value={(value.escalatedField as string) ?? ""}
          placeholder="escalado"
          onChange={(e) =>
            onChange({ ...value, escalatedField: e.target.value || undefined })
          }
        />
      </FieldRow>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ConfigForm({
  tipo,
  value,
  onChange,
}: {
  tipo: TipoNodo
  value: Record<string, unknown>
  onChange: (v: Record<string, unknown>) => void
}) {
  switch (tipo) {
    case "llm_call":
      return <LlmCallForm value={value} onChange={onChange} />
    case "classifier":
      return <ClassifierForm value={value} onChange={onChange} />
    case "condition":
      return <ConditionForm value={value} onChange={onChange} />
    case "http_request":
      return <HttpRequestForm value={value} onChange={onChange} />
    case "human_handoff":
      return <HumanHandoffForm value={value} onChange={onChange} />
    case "tool_executor":
      return (
        <p className="text-xs text-muted-foreground italic">
          tool_executor no requiere configuración adicional.
        </p>
      )
    default:
      return null
  }
}
