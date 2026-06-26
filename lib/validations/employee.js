import { z } from 'zod'

export const employeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  team_id: z.string().uuid('Please select a team'),
  role: z.enum(['employee', 'admin', 'owner']),
  is_paid_ads_member: z.boolean().default(false),
})

export const teamSchema = z.object({
  team_name: z.string().min(1, 'Team name is required').max(100),
})
