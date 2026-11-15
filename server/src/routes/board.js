import { Router } from 'express'
import { publicClient } from '../db.js'
import { notifyBoardChanged, requireAuth } from '../middleware.js'

const router = Router()

router.get('/', async (_req, res) => {
  const [categoriesResult, tasksResult] = await Promise.all([
    publicClient.from('categories').select('*').order('created_at', { ascending: true }),
    publicClient.from('tasks').select('*').order('order', { ascending: true }),
  ])
  if (categoriesResult.error) throw categoriesResult.error
  if (tasksResult.error) throw tasksResult.error

  res.json({ categories: categoriesResult.data, tasks: tasksResult.data })
})

router.delete('/', requireAuth, async (req, res) => {
  const tasksResult = await req.db.from('tasks').delete().not('id', 'is', null)
  if (tasksResult.error) throw tasksResult.error

  const categoriesResult = await req.db.from('categories').delete().not('id', 'is', null)
  if (categoriesResult.error) throw categoriesResult.error

  notifyBoardChanged(req)
  res.status(204).end()
})

export default router
