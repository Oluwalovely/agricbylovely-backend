import { z } from 'zod'

// ─────────────────────────────────────────
// REGISTER SCHEMA
// Validates the request body for POST /api/auth/register
// ─────────────────────────────────────────
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
    phone:      z.string().optional(),
    farmSizeHa: z.number().positive().optional(),
    soilType:   z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude:   z.number().min(-90).max(90).optional(),
    longitude:  z.number().min(-180).max(180).optional(),
    state:      z.string().optional(),
  }),
})

// ─────────────────────────────────────────
// LOGIN SCHEMA
// Validates the request body for POST /api/auth/login
// ─────────────────────────────────────────
export const loginSchema = z.object({
  body: z.object({
    email:    z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
})

// ─────────────────────────────────────────
// UPDATE PROFILE SCHEMA
// Validates PUT /api/farmers/me
// All fields are optional — farmer only sends what they want to change
// ─────────────────────────────────────────
export const updateProfileSchema = z.object({
  body: z.object({
    firstName:  z.string().min(2).max(50).optional(),
    lastName:   z.string().min(2).max(50).optional(),
    phone:      z.string().optional(),
    farmName:   z.string().min(2).max(100).optional(),
    farmSizeHa: z.number().positive().optional(),
    soilType:   z.enum(['CLAY', 'SANDY', 'LOAMY', 'SILTY', 'PEATY', 'CHALKY']).optional(),
    latitude:   z.number().min(-90).max(90).optional(),
    longitude:  z.number().min(-180).max(180).optional(),
    state:      z.string().optional(),
  }),
})

// ─────────────────────────────────────────
// CHANGE PASSWORD SCHEMA
// Validates PUT /api/farmers/me/password
// ─────────────────────────────────────────
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters'),
  }),
})