import { PrismaClient } from '@prisma/client'
import { fillCropDetails } from './src/services/aifiller.service.js'

const prisma = new PrismaClient()

// Find all crops with missing details
const emptyCrops = await prisma.crop.findMany({
  where: {
    OR: [
      { description: null },
      { daysToHarvest: null },
      { plantingMonths: { equals: [] } },
    ]
  }
})

console.log(`Found ${emptyCrops.length} crops with missing details`)

for (const crop of emptyCrops) {
  await fillCropDetails(crop)
}

console.log('Done filling all empty crops')
await prisma.$disconnect()