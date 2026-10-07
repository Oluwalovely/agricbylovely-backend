import { z } from 'zod'

const latitude = z.preprocess(value => value === null ? undefined : value,
  z.number().min(-90).max(90).optional())
const longitude = z.preprocess(value => value === null ? undefined : value,
  z.number().min(-180).max(180).optional())
const positiveInteger = (maximum) => z.coerce.number().int().min(1).max(maximum)
const pagination = { page: positiveInteger(1000000).optional(), limit: positiveInteger(100).optional() }
const recordId = z.string().uuid('Invalid record ID')
const date = z.union([z.iso.date(), z.iso.datetime({ offset: true })])


export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email('Please enter a valid email address'),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100),

    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(50),

    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50),

    farmName: z
      .string()
      .min(2, 'Farm name must be at least 2 characters')
      .max(100),

    // Optional fields
    phone: z.string().optional(),
    farmSizeHa: z.number().positive().optional(),
    soilType: z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude,
    longitude,
    state: z.string().optional(),
  }),
})


export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
})


export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().optional(),
    farmName: z.string().min(2).max(100).optional(),
    farmSizeHa: z.number().positive().optional(),
    soilType: z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude,
    longitude,
    state: z.string().optional(),
  }),
})


export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  }),
})


export const createFieldSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Field name is required').max(100),
    sizeHa: z.number().positive().optional(),
    soilType: z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude,
    longitude,
    notes: z.string().optional(),
  }),
})


export const updateFieldSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    sizeHa: z.number().positive().optional(),
    soilType: z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude,
    longitude,
    notes: z.string().optional(),
  }),
})


export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Please enter a valid email address'),
  }),
})


export const resetPasswordSchema = z.object({
  body: z.object({
    token:       z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
})

export const idParamsSchema = z.object({ params: z.object({ id: recordId }) })
export const refreshSchema = z.object({ body: z.object({ refreshToken: z.string().min(1).max(4096) }) })
export const paginationSchema = z.object({ query: z.object(pagination) })
export const cropQuerySchema = z.object({ query: z.object({
  ...pagination,
  q: z.string().trim().max(200).optional(),
  category: z.string().toUpperCase().pipe(z.enum(['VEGETABLE', 'GRAIN', 'FRUIT', 'FLOWER', 'HERB', 'TUBER', 'LEGUME'])).optional(),
}) })
export const plantCropSchema = z.object({
  params: z.object({ id: recordId }),
  body: z.object({
    plantedAt: date.optional(),
    fieldId: recordId.nullable().optional(),
    notes: z.string().max(5000).optional(),
    quantity: z.number().positive().optional(),
  }),
})
export const updateCropSchema = z.object({
  params: z.object({ id: recordId }),
  body: z.object({
    stage: z.enum(['GERMINATING', 'SEEDLING', 'GROWING', 'FLOWERING', 'MATURING', 'READY', 'HARVESTED']).optional(),
    notes: z.string().max(5000).optional(),
    yieldKg: z.number().nonnegative().optional(),
    harvestedAt: date.optional(),
  }).refine(body => Object.keys(body).length > 0, 'Provide at least one field to update'),
})
export const notificationQuerySchema = z.object({ query: z.object({
  ...pagination, unreadOnly: z.enum(['true', 'false']).optional(),
}) })
export const calendarQuerySchema = z.object({ query: z.object({
  month: positiveInteger(12).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
}).refine(query => query.month === undefined || query.year !== undefined, 'Provide a year when selecting a month') })
export const upcomingQuerySchema = z.object({ query: z.object({ days: positiveInteger(365).optional() }) })
export const weatherQuerySchema = z.object({ query: z.object({
  lat: z.string().min(1).pipe(z.coerce.number().min(-90).max(90)),
  lon: z.string().min(1).pipe(z.coerce.number().min(-180).max(180)),
}) })
