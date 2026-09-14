// Return and cancel options shared by the forms (client) and app/actions/orders.ts (server). Pure data, no imports.

export const CANCEL_REASONS = [
  'Order Created by Mistake',
  'Item(s) Would Not Arrive on Time',
  'Shipping Cost Too High',
  'Item Price Too High',
  'Found Cheaper Somewhere Else',
  'Need to Change Shipping Address',
  'Need to Change Payment Method',
  'Other',
]

export const RETURN_REASONS = [
  'No longer needed',
  'Bought by mistake',
  'Better price available',
  "Item defective or doesn't work",
  'Wrong item was sent',
  'Item arrived damaged',
]

// these need a comment, never pay a return fee, and can be replaced instead of refunded
export const PROBLEM_REASONS = new Set(RETURN_REASONS.slice(3))

export const RETURN_METHODS = {
  'ups-store': { label: 'The UPS Store Drop off', note: 'No box, no label needed', feeCents: 0 },
  'ups-pickup': { label: 'UPS Pickup', note: 'Pack the item in any box. The driver brings the label.', feeCents: 699 },
} as const
export type ReturnMethod = keyof typeof RETURN_METHODS

export const COMMENT_MAX = 500
export const DROP_OFF_DAYS = 14

// the pickup fee is waived when the item was faulty or wrong; replacements never cost anything
export const returnFeeCents = (reason: string, method: ReturnMethod, replacement: boolean) =>
  replacement || PROBLEM_REASONS.has(reason) ? 0 : RETURN_METHODS[method].feeCents
