import { ZodError } from 'zod'

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    })
    if (parsed.body !== undefined) req.body = parsed.body
    if (parsed.query !== undefined) req.query = parsed.query
    if (parsed.params !== undefined) req.params = parsed.params
    next()
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.issues.map((e) => ({
        field: e.path.slice(1).join('.'),
        message: e.message,
      }))
      return res.status(400).json({ success: false, message: 'Validation failed', errors })
    }
    next(err)
  }
}
