import { ZodError } from 'zod'

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    })
    next()
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.slice(1).join('.'),
        message: e.message,
      }))
      return res.status(400).json({ success: false, message: 'Validation failed', errors })
    }
    next(err)
  }
}