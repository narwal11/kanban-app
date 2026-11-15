import 'dotenv/config'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import app, { allowedOrigins } from './app.js'

const port = Number(process.env.PORT) || 3001

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: allowedOrigins } })
app.set('io', io)

httpServer.on('error', (error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

httpServer.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
