import { Router } from 'express'
import { notifyBoardChanged, requireAuth, validate } from '../middleware.js'
import { createCategory, updateCategory } from '../schemas.js'

const router = Router()

router.use(requireAuth)

// ilike treats % and _ as wildcards; escape them (and the escape char) for an exact match.
const escapeLike = (value) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`)

async function findByNameInsensitive(db, name) {
  const { data, error } = await db
    .from('categories')
    .select('*')
    .ilike('name', escapeLike(name))
  if (error) throw error
  return data
}

router.post('/', validate(createCategory), async (req, res) => {
  const existing = await findByNameInsensitive(req.db, req.body.name)
  if (existing.length > 0) {
    return res.status(409).json({ error: 'A category with that name already exists' })
  }

  const { data, error } = await req.db.from('categories').insert(req.body).select().single()
  if (error) throw error

  notifyBoardChanged(req)
  res.status(201).json(data)
})

router.patch('/:name', validate(updateCategory), async (req, res) => {
  const oldName = req.params.name
  const { name: newName, color } = req.body

  const { data: current, error: findError } = await req.db
    .from('categories')
    .select('*')
    .eq('name', oldName)
    .maybeSingle()
  if (findError) throw findError
  if (!current) return res.status(404).json({ error: 'Category not found' })

  const isRename = newName !== undefined && newName !== oldName
  if (isRename) {
    const clashes = await findByNameInsensitive(req.db, newName)
    if (clashes.some((category) => category.id !== current.id)) {
      return res.status(409).json({ error: 'A category with that name already exists' })
    }
  }

  const fields = {}
  if (newName !== undefined) fields.name = newName
  if (color !== undefined) fields.color = color

  const { data, error } = await req.db
    .from('categories')
    .update(fields)
    .eq('id', current.id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: 'Category not found' })

  if (isRename) {
    const { error: cascadeError } = await req.db
      .from('tasks')
      .update({ tag: newName })
      .eq('tag', oldName)
    if (cascadeError) throw cascadeError
  }

  notifyBoardChanged(req)
  res.json(data)
})

router.delete('/:name', async (req, res) => {
  const { error } = await req.db.from('categories').delete().eq('name', req.params.name)
  if (error) throw error

  notifyBoardChanged(req)
  res.status(204).end()
})

export default router
