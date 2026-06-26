import { z } from 'zod'

export const kraTemplateSchema = z.object({
  title: z.string().min(1, 'KRA title is required').max(300),
  kra_type: z.enum(['quantitative', 'qualitative']),
  target_value: z.number().min(0).nullable().optional(),
  description: z.string().max(1000).optional(),
  is_recurring: z.boolean().default(false),
})

export const kraLogSchema = z.object({
  achieved_value: z.number().min(0).nullable().optional(),
  status: z.enum(['done', 'in_progress', 'blocked'], {
    required_error: 'Please select a status',
  }),
  comments: z.string().max(500).optional(),
})

export const kraAssignmentSchema = z.object({
  target_type: z.enum(['individual', 'team']),
  user_id: z.string().uuid().optional(),
  team_id: z.string().uuid().optional(),
  assigned_date: z.string().min(1, 'Date is required'),
  kras: z.array(kraTemplateSchema).min(1, 'Add at least one KRA'),
})
