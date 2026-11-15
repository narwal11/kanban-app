import express from 'express'
import cors from 'cors'
import boardRouter from './routes/board.js'
import tasksRouter from './routes/tasks.js'
import categoriesRouter from './routes/categories.js'

export const allowedOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const app = express()

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/board', boardRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/categories', categoriesRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
