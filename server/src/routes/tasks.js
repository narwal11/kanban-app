import { Router } from 'express'
import { notifyBoardChanged, requireAuth, validate } from '../middleware.js'
import { createTask, reorder, updateTask } from '../schemas.js'

const router = Router()

router.use(requireAuth)

router.post('/', validate(createTask), async (req, res) => {
  const { data, error } = await req.db.from('tasks').insert(req.body).select().single()
  if (error) throw error

  notifyBoardChanged(req)
  res.status(201).json(data)
})

// Registered before /:id so "reorder" is not captured as an id.
router.patch('/reorder', validate(reorder), async (req, res) => {
  const results = await Promise.all(
    req.body.map(({ id, status, order }) =>
      req.db.from('tasks').update({ status, order }).eq('id', id)
    )
  )
  const failed = results.find(({ error }) => error)
  if (failed) throw failed.error

  notifyBoardChanged(req)
  res.status(204).end()
})

router.patch('/:id', validate(updateTask), async (req, res) => {
  const { data, error } = await req.db
    .from('tasks')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: 'Task not found' })

  notifyBoardChanged(req)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  const { error } = await req.db.from('tasks').delete().eq('id', req.params.id)
  if (error) throw error

  notifyBoardChanged(req)
  res.status(204).end()
})

export default router
