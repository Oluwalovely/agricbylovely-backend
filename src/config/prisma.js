import { PrismaClient } from '@prisma/client'

// Single shared Prisma instance across the whole app
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export default prisma