import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Usuario" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize(credentials) {
        if (
          credentials.username === "admin" &&
          credentials.password === "admin123"
        ) {
          return { id: "1", name: "Admin", email: "admin@builder.com" }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
})
