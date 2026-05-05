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

const sanitize = (req, res, next) => {
    if (req.body) {
        req.body = trimStrings(req.body)
        req.body = removeEmptyStrings(req.body)
    }
    next()
}

export { sanitize }