const passwordFields = new Set(['password', 'currentPassword', 'newPassword'])

const trimStrings = (value) => {
  if (Array.isArray(value)) return value.map(trimStrings)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    typeof item === 'string' && !passwordFields.has(key) ? item.trim()
      : typeof item === 'object' ? trimStrings(item) : item,
  ]))
}

export const sanitize = (req, res, next) => {
  if (req.body) req.body = trimStrings(req.body)
  next()
}
