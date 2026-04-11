import 'dotenv/config'
import express from 'express'
import { chatRouter } from './routes/chat'

const app = express()
app.use(express.json())

// TODO: montar chatRouter en la ruta '/chat'
app.use('/chat', chatRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})