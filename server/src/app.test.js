import 'dotenv/config'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import app from './app.js'

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('auth', () => {
  it('rejects POST /api/tasks without a token', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', status: 'todo', order: 0 })
    expect(res.status).toBe(401)
  })
})

describe('errors', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{bad')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'Malformed JSON body' })
  })
})
