import { z } from 'zod';

export const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(6, 'Use at least 6 characters'), role: z.enum(['creator', 'brand_manager', 'reviewer']) });
export const draftSchema = z.object({ title: z.string().min(1, 'Add a draft name').max(120), text: z.string().min(20, 'Add at least 20 characters').max(20000, 'Keep drafts under 20,000 characters'), acknowledge: z.literal(true, { errorMap: () => ({ message: 'Please acknowledge the external AI notice.' }) }) });
export const commentSchema = z.object({ text: z.string().min(2, 'Write a comment').max(1000) });
export const dismissSchema = z.object({ reason: z.string().min(10, 'Explain the reason in at least 10 characters').max(500) });
export const kitSchema = z.object({ title: z.string().min(2).optional(), text: z.string().min(3, 'Add a description or approved wording'), source: z.string().optional(), review_date: z.string().optional(), allow_ai: z.boolean().optional(), banned: z.string().optional(), preferred: z.string().optional() });
export const kitItemSchema = z.object({
  kind: z.enum(['guidelines', 'facts', 'terms']),
  title: z.string().optional(), text: z.string().optional(), source: z.string().optional(),
  review_date: z.string().optional(), allow_ai: z.boolean().optional(),
  banned: z.string().optional(), preferred: z.string().optional(),
}).superRefine((value, context) => {
  const requireField = (field: 'title' | 'text' | 'source' | 'review_date' | 'banned' | 'preferred', message: string) => {
    if (!value[field]?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  };
  if (value.kind === 'guidelines') { requireField('title', 'Add a guideline title'); requireField('text', 'Add guideline wording'); }
  if (value.kind === 'facts') { requireField('text', 'Add approved fact wording'); requireField('source', 'Add a source'); requireField('review_date', 'Choose a review date'); }
  if (value.kind === 'terms') { requireField('banned', 'Add the wording to avoid'); requireField('preferred', 'Add the approved alternative'); }
});
export const editSchema = z.object({ edited_fix: z.string().min(3, 'Enter a proposed fix') });
export const changesSchema = z.object({ reason: z.string().min(10, 'Add a clear note for the creator') });
