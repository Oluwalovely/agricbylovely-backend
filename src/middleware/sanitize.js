// ─────────────────────────────────────────
// INPUT SANITIZER MIDDLEWARE
// Cleans incoming request data before it hits any route
// Prevents common attack patterns like XSS
// ─────────────────────────────────────────

// Recursively trims all string values in an object
// e.g. { name: "  Adewale  " } becomes { name: "Adewale" }
const trimStrings = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj

    return Object.keys(obj).reduce((acc, key) => {
        const value = obj[key]
        if (typeof value === 'string') {
            acc[key] = value.trim() // remove leading and trailing spaces
        } else if (typeof value === 'object') {
            acc[key] = trimStrings(value) // handle nested objects
        } else {
            acc[key] = value
        }
        return acc
    }, {})
}

// Removes any keys that have empty string values
// Prevents saving empty strings to the database
const removeEmptyStrings = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj

    return Object.keys(obj).reduce((acc, key) => {
        const value = obj[key]
        if (value !== '') {
            acc[key] = value
        }
        return acc
    }, {})
}

// The actual middleware function
const sanitize = (req, res, next) => {
    if (req.body) {
        req.body = trimStrings(req.body)
        req.body = removeEmptyStrings(req.body)
    }
    next()
}

export { sanitize }