export type Role = 'creator' | 'brand_manager' | 'reviewer';
export type User = { id: string; name: string; role: Role };
export type Guideline = { id: string; title: string; text: string; category?: string };
export type Fact = { id: string; text: string; source: string; review_date: string; allow_ai: boolean };
export type Term = { id: string; banned: string; preferred: string; allow_ai?: boolean };
export type Finding = {
  id: string; draft_id: string; excerpt: string; start: number; end: number; type: string;
  severity: 'high' | 'medium' | 'low'; source: 'rules' | 'ai'; source_ref_id: string;
  reason: string; suggested_fix: string; fix_needs_human: boolean; confidence: number; status: string;
};
export type Dropped = { candidate: string; failed_gate: 1 | 2 | 3 | 4 | 5; why: string };
export type Draft = { id: string; title: string; text: string; version: number; status: string; updated_at: string; findings_count?: number };
export type BrandKit = { guidelines: Guideline[]; facts: Fact[]; terms: Term[] };
export type Comment = { id: string; author: string; text: string; created_at: string };
export type AuditItem = { id: string; who: string; role: Role; action: string; target: string; timestamp: string };
export type Version = { id: string; version: number; text: string; created_at: string; status?: string };
export type ApiError = Error & { status?: number; fields?: Record<string, string> };
