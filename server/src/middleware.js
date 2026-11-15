import { clientForToken, verifyToken } from './db.js'

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(({ path, message }) => ({
          path: path.join('.'),
          message,
        })),
      })
    }
    req.body = result.data
    next()
  }
}

export async function requireAuth(req, res, next) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') ?? '')
  if (!match) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  const token = match[1]
  const user = await verifyToken(token)
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = user
  req.db = clientForToken(token)
  next()
}

export function notifyBoardChanged(req) {
  const io = req.app.get('io')
  if (!io) return
  const originSocketId = req.get('X-Socket-Id')
  const target = originSocketId ? io.except(originSocketId) : io
  target.emit('board:changed')
}
