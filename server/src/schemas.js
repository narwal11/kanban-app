import { z } from 'zod'

const status = z.enum(['todo', 'inprogress', 'done'])
const title = z.string().trim().min(1).max(200)
const categoryName = z.string().trim().min(1).max(50)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #1a2b3c')

const atLeastOneField = (obj) => Object.values(obj).some((v) => v !== undefined)
const atLeastOneFieldMessage = { message: 'At least one field must be provided' }

export const createTask = z.object({
  title,
  description: z.string().default(''),
  tag: z.string().default(''),
  status,
  order: z.number().int().min(0),
})

export const updateTask = z
  .object({
    title: title.optional(),
    description: z.string().optional(),
    tag: z.string().optional(),
  })
  .refine(atLeastOneField, atLeastOneFieldMessage)

export const reorder = z
  .array(
    z.object({
      id: z.union([z.string().min(1), z.number().int()]),
      status,
      order: z.number().int().min(0),
    })
  )
  .min(1)
  .max(500)

export const createCategory = z.object({
  name: categoryName,
  color,
})

export const updateCategory = z
  .object({
    name: categoryName.optional(),
    color: color.optional(),
  })
  .refine(atLeastOneField, atLeastOneFieldMessage)
