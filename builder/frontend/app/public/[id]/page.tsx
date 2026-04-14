import { notFound } from "next/navigation"
import { api } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

export default async function PublicPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let cliente
  try {
    cliente = await api.clientes.get(id)
  } catch {
    notFound()
  }

  return (
    <div style={{ margin: 0, fontFamily: "sans-serif", background: "#f8fafc", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#94a3b8", fontSize: "14px" }}>
        Hacé click en el botón 💬 para chatear con {cliente.nombre}
      </p>
      <script
        src={`${API_URL}/public/widget.js`}
        data-client-id={cliente.id}
        data-api-url={API_URL}
      />
    </div>
  )
}
