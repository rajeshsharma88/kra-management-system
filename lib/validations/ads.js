import { z } from 'zod'

export const adAccountSchema = z.object({
  platform: z.enum(['meta', 'google'], { required_error: 'Platform is required' }),
  account_name: z.string().min(1, 'Account name is required').max(200),
  account_ref_id: z.string().max(100).optional(),
  client_name: z.string().min(1, 'Client name is required').max(200),
  monthly_budget: z.number().min(0, 'Budget must be a positive number'),
  daily_lead_target: z.number().int().min(0, 'Lead target must be a positive number'),
  assigned_user_ids: z.array(z.string().uuid()).min(1, 'Assign at least one employee'),
})

export const adsLogSchema = z.object({
  daily_budget_set: z.number().min(0),
  daily_spend_actual: z.number().min(0),
  leads_generated: z.number().int().min(0),
  conversions: z.number().int().min(0),
  conversion_value: z.number().min(0),
  campaign_status: z.enum(['running', 'paused', 'issue']),
  notes: z.string().max(1000).optional(),
  issue_description: z.string().max(500).optional(),
})
