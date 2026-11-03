export type Role = 'creator' | 'brand_manager' | 'reviewer';
export type User = { id: string; name: string; role: Role; email?: string; [key: string]: any; };
export type Guideline = { id: string; title: string; text: string; category?: string };
export type Fact = { id: string; text: string; source: string; review_date: string; allow_ai: boolean; owner_name?: string; status_override?: string; expires_on?: string; [key: string]: any };
export type Term = { id: string; banned: string; preferred: string; allow_ai?: boolean };

export type GateTrace = {
  passed: boolean;
  message: string;
  source_id?: string;
  source_type?: string;
  warning?: boolean;
  confidence?: number;
  freshness?: string;
  [key: string]: any;
};

export type VerificationTrace = {
  gate_1_schema?: GateTrace;
  gate_2_source?: GateTrace;
  gate_3_quote?: GateTrace;
  gate_4_intent_fix?: GateTrace;
  gate_5_freshness_confidence?: GateTrace;
};

export type Finding = {
  id: string;
  draft_id: string;
  excerpt: string;
  start: number;
  end: number;
  type: string;
  severity: 'high' | 'medium' | 'low';
  source: 'rules' | 'ai' | 'llm';
  source_ref_id: string;
  reason: string;
  suggested_fix: string;
  fix_needs_human: boolean;
  confidence: number;
  status: string;
  paragraph_ref?: number;
  verification_status?: 'verified' | 'human_review_required' | 'blocked_expired_fact';
  verification_trace?: VerificationTrace;
};

export type Dropped = {
  candidate: string;
  failed_gate: 1 | 2 | 3 | 4 | 5;
  why: string;
  reason?: string;
};

export type ReviewSummary = {
  total_candidates: number;
  passed_gate_1: number;
  passed_gate_2: number;
  passed_gate_3: number;
  passed_gate_4: number;
  passed_gate_5: number;
  returned_findings: number;
  dropped_count: number;
};

export type Draft = {
  id: string;
  title: string;
  text: string;
  version: number;
  status: string;
  updated_at: string;
  findings_count?: number;
};

export type BrandKit = {
  guidelines: Guideline[];
  facts: Fact[];
  terms: Term[];
};

export type Comment = {
  id: string;
  author: string;
  text: string;
  created_at: string;
};

export type AuditItem = {
  id: string;
  who: string;
  role: Role;
  action: string;
  target: string;
  timestamp: string;
  reason?: string;
  details?: string;
  prev_hash?: string;
  entry_hash?: string;
};

export type GapRadarItem = {
  rule: string;
  guideline_id?: string;
  guideline_code?: string;
  category?: string;
  flagged: number;
  accepted: number;
  dismissed: number;
  dismissal_rate: number;
  status: string;
  reasons: string[];
  recommendation?: string;
};

export type Version = {
  id: string;
  version: number;
  text: string;
  created_at: string;
  status?: string;
  locked?: boolean;
  locked_by?: string;
  locked_at?: string;
};

export type SelftestCase = {
  id: string;
  name: string;
  description: string;
  expected_gate: number;
  expected_outcome: string;
  actual_gate: number;
  actual_outcome: string;
  passed: boolean;
  evidence: string;
  trace?: any;
};

export type SelftestResponse = {
  cases: SelftestCase[];
  summary: {
    total_cases: number;
    passed: number;
    failed: number;
    pass_rate_percent: number;
  };
  timestamp: string;
};

export type VerifierTryResponse = {
  outcome: 'verified' | 'dropped' | 'human_review_required' | 'blocked_expired_fact';
  passed: boolean;
  verification_trace?: VerificationTrace;
  finding?: Finding;
  failed_gate?: number;
  reason?: string;
};

export type ApiError = Error & { status?: number; fields?: Record<string, string> };
