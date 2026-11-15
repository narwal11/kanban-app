import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'

// Fake Supabase layer: every query builder is thenable and resolves to the next queued result.
const state = vi.hoisted(() => ({ queue: [], calls: [] }))

vi.mock('../src/db.js', () => {
  const METHODS = ['select', 'insert', 'update', 'delete', 'eq', 'ilike', 'not', 'order', 'single', 'maybeSingle']

  function createBuilder(table) {
    const call = { table, ops: [] }
    const builder = {
      then(resolve, reject) {
        state.calls.push(call)
        const result = state.queue.length ? state.queue.shift() : { data: null, error: null }
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    for (const method of METHODS) {
      builder[method] = (...args) => {
        call.ops.push([method, ...args])
        return builder
      }
    }
    return builder
  }

  const fakeClient = { from: (table) => createBuilder(table) }

  return {
    publicClient: fakeClient,
    clientForToken: () => fakeClient,
    verifyToken: async (token) => (token === 'good-token' ? { id: 'user-1' } : null),
  }
})

const { default: app } = await import('../src/app.js')

const AUTH = { Authorization: 'Bearer good-token' }
const queueResult = (data, error = null) => state.queue.push({ data, error })
const findOp = (call, method) => call.ops.find(([name]) => name === method)

beforeEach(() => {
  state.queue.length = 0
  state.calls.length = 0
})

afterEach(() => {
  app.set('io', undefined)
  vi.restoreAllMocks()
})

describe('basics', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(AUTH)
      .set('Content-Type', 'application/json')
      .send('{bad')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Malformed JSON body' })
  })
})

describe('GET /api/board', () => {
  it('returns categories and tasks', async () => {
    const categories = [{ id: 1, name: 'Work', color: '#112233' }]
    const tasks = [{ id: 7, title: 'A', status: 'todo', order: 0 }]
    queueResult(categories)
    queueResult(tasks)

    const res = await request(app).get('/api/board')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ categories, tasks })
    expect(state.calls.map((c) => c.table).sort()).toEqual(['categories', 'tasks'])
  })

  it('returns 500 without leaking the database error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    queueResult(null, { message: 'secret db detail: relation "categories" broke' })
    queueResult([])

    const res = await request(app).get('/api/board')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Internal server error' })
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
})

describe('authentication', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', status: 'todo', order: 0 })
    expect(res.status).toBe(401)
  })

  it('returns 401 with a bad token', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer bad-token')
      .send({ title: 'x', status: 'todo', order: 0 })
    expect(res.status).toBe(401)
    expect(state.calls).toHaveLength(0)
  })
})

describe('POST /api/tasks', () => {
  it('applies defaults and trims the title', async () => {
    const created = { id: 1, title: 'Write tests', description: '', tag: '', status: 'todo', order: 0 }
    queueResult(created)

    const res = await request(app)
      .post('/api/tasks')
      .set(AUTH)
      .send({ title: '  Write tests  ', status: 'todo', order: 0 })

    expect(res.status).toBe(201)
    expect(res.body).toEqual(created)
    const insert = findOp(state.calls[0], 'insert')
    expect(insert[1]).toEqual({
      title: 'Write tests',
      description: '',
      tag: '',
      status: 'todo',
      order: 0,
    })
  })

  it.each([
    ['a missing title', { status: 'todo', order: 0 }],
    ['a blank title', { title: '   ', status: 'todo', order: 0 }],
    ['a bad status', { title: 'x', status: 'blocked', order: 0 }],
    ['a negative order', { title: 'x', status: 'todo', order: -1 }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).post('/api/tasks').set(AUTH).send(body)
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
    expect(res.body.details.length).toBeGreaterThan(0)
    expect(state.calls).toHaveLength(0)
  })
})

describe('PATCH /api/tasks/:id', () => {
  it('returns 404 when the task does not exist', async () => {
    queueResult(null)

    const res = await request(app).patch('/api/tasks/999').set(AUTH).send({ title: 'New' })

    expect(res.status).toBe(404)
  })

  it('returns 400 for an empty edit', async () => {
    const res = await request(app).patch('/api/tasks/1').set(AUTH).send({})
    expect(res.status).toBe(400)
    expect(state.calls).toHaveLength(0)
  })
})

describe('PATCH /api/tasks/reorder', () => {
  it('persists a valid reorder', async () => {
    queueResult(null)
    queueResult(null)
    const items = [
      { id: 1, status: 'done', order: 0 },
      { id: 'abc', status: 'todo', order: 1 },
    ]

    const res = await request(app).patch('/api/tasks/reorder').set(AUTH).send(items)

    expect(res.status).toBe(204)
    expect(state.calls).toHaveLength(2)
    expect(findOp(state.calls[0], 'update')[1]).toEqual({ status: 'done', order: 0 })
    expect(findOp(state.calls[0], 'eq')).toEqual(['eq', 'id', 1])
  })

  it.each([
    ['an empty array', []],
    ['a bad status', [{ id: 1, status: 'nope', order: 0 }]],
    ['a non-array body', { id: 1, status: 'todo', order: 0 }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await request(app).patch('/api/tasks/reorder').set(AUTH).send(body)
    expect(res.status).toBe(400)
    expect(state.calls).toHaveLength(0)
  })
})

describe('categories', () => {
  it('returns 400 for a non-hex color', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set(AUTH)
      .send({ name: 'Work', color: 'red' })
    expect(res.status).toBe(400)
    expect(state.calls).toHaveLength(0)
  })

  it('returns 409 for a duplicate name', async () => {
    queueResult([{ id: 1, name: 'work', color: '#112233' }])

    const res = await request(app)
      .post('/api/categories')
      .set(AUTH)
      .send({ name: 'Work', color: '#aabbcc' })

    expect(res.status).toBe(409)
    expect(state.calls).toHaveLength(1)
    expect(findOp(state.calls[0], 'ilike')).toEqual(['ilike', 'name', 'Work'])
  })

  it('escapes % and _ when checking for duplicates', async () => {
    queueResult([])
    queueResult({ id: 2, name: '50%_off', color: '#aabbcc' })

    const res = await request(app)
      .post('/api/categories')
      .set(AUTH)
      .send({ name: '50%_off', color: '#aabbcc' })

    expect(res.status).toBe(201)
    expect(findOp(state.calls[0], 'ilike')[2]).toBe('50\\%\\_off')
  })

  it('cascades a rename to tasks.tag', async () => {
    queueResult({ id: 1, name: 'Old', color: '#112233' }) // find current
    queueResult([]) // clash check
    queueResult({ id: 1, name: 'New', color: '#112233' }) // update category
    queueResult(null) // update tasks

    const res = await request(app).patch('/api/categories/Old').set(AUTH).send({ name: 'New' })

    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New')
    const taskUpdate = state.calls.find((c) => c.table === 'tasks')
    expect(taskUpdate).toBeDefined()
    expect(findOp(taskUpdate, 'update')[1]).toEqual({ tag: 'New' })
    expect(findOp(taskUpdate, 'eq')).toEqual(['eq', 'tag', 'Old'])
  })

  it('does not touch tasks when only the color changes', async () => {
    queueResult({ id: 1, name: 'Work', color: '#112233' })
    queueResult({ id: 1, name: 'Work', color: '#ffffff' })

    const res = await request(app).patch('/api/categories/Work').set(AUTH).send({ color: '#ffffff' })

    expect(res.status).toBe(200)
    expect(state.calls.some((c) => c.table === 'tasks')).toBe(false)
  })

  it('returns 409 when a rename clashes with another category', async () => {
    queueResult({ id: 1, name: 'Old', color: '#112233' })
    queueResult([{ id: 2, name: 'New', color: '#445566' }])

    const res = await request(app).patch('/api/categories/Old').set(AUTH).send({ name: 'New' })

    expect(res.status).toBe(409)
    expect(state.calls.some((c) => c.table === 'tasks')).toBe(false)
  })

  it('returns 404 when renaming a missing category', async () => {
    queueResult(null)
    const res = await request(app).patch('/api/categories/Ghost').set(AUTH).send({ name: 'New' })
    expect(res.status).toBe(404)
  })
})

describe('board:changed notifications', () => {
  function fakeIo() {
    const exceptEmit = vi.fn()
    return {
      emit: vi.fn(),
      except: vi.fn(() => ({ emit: exceptEmit })),
      exceptEmit,
    }
  }

  it('skips the client named in X-Socket-Id', async () => {
    const io = fakeIo()
    app.set('io', io)
    queueResult({ id: 1, title: 'x', status: 'todo', order: 0 })

    const res = await request(app)
      .post('/api/tasks')
      .set(AUTH)
      .set('X-Socket-Id', 'socket-abc')
      .send({ title: 'x', status: 'todo', order: 0 })

    expect(res.status).toBe(201)
    expect(io.except).toHaveBeenCalledWith('socket-abc')
    expect(io.exceptEmit).toHaveBeenCalledWith('board:changed')
    expect(io.emit).not.toHaveBeenCalled()
  })

  it('broadcasts to everyone when no X-Socket-Id is sent', async () => {
    const io = fakeIo()
    app.set('io', io)
    queueResult(null)

    const res = await request(app).delete('/api/tasks/1').set(AUTH)

    expect(res.status).toBe(204)
    expect(io.emit).toHaveBeenCalledWith('board:changed')
    expect(io.except).not.toHaveBeenCalled()
  })

  it('does not notify when the write is rejected', async () => {
    const io = fakeIo()
    app.set('io', io)

    await request(app).post('/api/tasks').set(AUTH).send({ title: '' })

    expect(io.emit).not.toHaveBeenCalled()
    expect(io.except).not.toHaveBeenCalled()
  })
})
