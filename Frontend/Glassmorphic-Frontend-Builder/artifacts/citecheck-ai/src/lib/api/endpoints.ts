import { audit, brandKit, demoUsers, dropped, drafts, findings, versions } from './fixtures';
import type { ApiError, AuditItem, BrandKit, Comment, Draft, Dropped, Finding, Role, User, Version } from './types';
import { useSession } from '@/store/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = API_BASE;
const fixturesEnabled = import.meta.env.VITE_USE_FIXTURES === 'true';
const fixtureComments: Comment[] = [];

const fixtureGapRadar: any[] = [
  {
    rule: 'Security language',
    guideline_id: 'GUIDE-04',
    guideline_code: 'GUIDE-04',
    category: 'tone',
    flagged: 10,
    accepted: 4,
    dismissed: 6,
    dismissal_rate: 60.0,
    status: 'Unclear Policy',
    reasons: [
      'Technical spec required specific cipher/TLS version',
      'Rule is too rigid for engineer-facing API docs',
      'Context was standard security control, not marketing hype',
    ],
    recommendation: 'Update guideline to clarify allowed technical descriptions (TLS 1.3, AES-256) vs marketing hype.',
  },
  {
    rule: 'Claims need proof',
    guideline_id: 'GUIDE-01',
    guideline_code: 'GUIDE-01',
    category: 'claim',
    flagged: 14,
    accepted: 7,
    dismissed: 7,
    dismissal_rate: 50.0,
    status: 'Unclear Policy',
    reasons: [
      'Pre-approved campaign exception by Legal Counsel',
      'Customer testimonial quote, not company assertion',
      'Descriptive benefit, not an absolute claim',
    ],
    recommendation: 'Add explicit guidance and exemptions for quoted customer testimonials.',
  },
  {
    rule: 'No lifetime promises',
    guideline_id: 'GUIDE-09',
    guideline_code: 'GUIDE-09',
    category: 'claim',
    flagged: 6,
    accepted: 3,
    dismissed: 3,
    dismissal_rate: 50.0,
    status: 'Unclear Policy',
    reasons: [
      'Quarterly promotional fee lock confused with lifetime guarantee',
      'Referencing historical launch terms',
    ],
    recommendation: 'Clarify boundary between temporary promotional pricing and permanent promises.',
  },
  {
    rule: 'Payments terminology',
    guideline_id: 'GUIDE-03',
    guideline_code: 'GUIDE-03',
    category: 'terminology',
    flagged: 12,
    accepted: 11,
    dismissed: 1,
    dismissal_rate: 8.3,
    status: 'Healthy / Clear',
    reasons: [
      'Context was technical banking protocol spec',
    ],
    recommendation: 'High adherence (92% acceptance rate); keep as standard.',
  },
  {
    rule: 'Numbers and dates',
    guideline_id: 'GUIDE-05',
    guideline_code: 'GUIDE-05',
    category: 'formatting',
    flagged: 9,
    accepted: 7,
    dismissed: 2,
    dismissal_rate: 22.2,
    status: 'Healthy / Clear',
    reasons: [
      'Date format specified by platform app store guideline',
    ],
    recommendation: 'Guideline is performing well with clear adherence (77.8%).',
  },
];
const headers = () => {
  const token = useSession.getState().token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
export function normalizeError(payload: unknown, status?: number): ApiError {
  const p = payload as { detail?: unknown; message?: string } | undefined;
  let message = p?.message || 'The request could not be completed.';
  const fields: Record<string, string> = {};
  if (Array.isArray(p?.detail)) {
    message = p.detail.map((item: any) => {
      const path = Array.isArray(item.loc) ? item.loc.slice(1).join('.') : '';
      if (path) fields[path] = String(item.msg || 'Invalid value');
      return `${path ? `${path}: ` : ''}${item.msg || 'Invalid value'}`;
    }).join(' · ') || message;
  } else if (typeof p?.detail === 'string') message = p.detail;
  const err = new Error(message) as ApiError;
  err.status = status; err.fields = fields;
  return err;
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (fixturesEnabled) return fixtureRequest(path, method, body) as Promise<T>;
  try {
    const response = await fetch(`${API_BASE}${path}`, { method, headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.status === 401) { useSession.getState().logout(); }
    const payload = response.status === 204 ? undefined : await response.json().catch(() => ({}));
    if (!response.ok) throw normalizeError(payload, response.status);
    return payload as T;
  } catch (error) {
    if ((error as ApiError).status) throw error;
    const err = new Error(`API unreachable at ${API_BASE}. Check the service and retry.`) as ApiError;
    throw err;
  }
}
const delay = () => new Promise((resolve) => setTimeout(resolve, 180));
async function fixtureRequest(path: string, method: string, body?: any): Promise<any> {
  await delay();
  if (path === '/auth/login') {
    const role = (body?.role || 'creator') as Role;
    return { token: `preview-token-${role}`, user: demoUsers.find((u) => u.role === role) || demoUsers[0] };
  }
  if (path === '/brand-kit') return structuredClone(brandKit);
  if (path === '/drafts' && method === 'POST') {
    const item: Draft = { ...body, id: `draft-${Date.now()}`, version: 1, status: 'Draft', updated_at: new Date().toISOString(), findings_count: 0 };
    drafts.unshift(item); return item;
  }
  if (path === '/drafts') return structuredClone(drafts);
  if (/^\/(guidelines|facts|terms)(\/[^/]+)?$/.test(path)) {
    const [, bucket, idPath] = path.match(/^\/(guidelines|facts|terms)(\/[^/]+)?$/) || [];
    const rows: any[] = (brandKit as any)[bucket] || [];
    const id = idPath?.slice(1);
    if (method === 'DELETE') { const index = rows.findIndex((item) => item.id === id); if (index >= 0) rows.splice(index, 1); return {}; }
    if (method === 'PATCH' && id) {
      const index = rows.findIndex((item) => item.id === id);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...body };
        audit.unshift({
          id: `a-${Date.now()}`,
          who: useSession.getState().user?.name || 'Arjun Mehta',
          role: useSession.getState().user?.role || 'brand_manager',
          action: 'Updated Brand Kit entry',
          target: `Brand Kit · ${id}`,
          timestamp: new Date().toISOString(),
          reason: body.review_date ? `Updated review date to ${body.review_date}` : 'Updated approved brand asset',
          details: `Content: "${body.text || body.title || ''}"`,
        });
      }
      return rows[index] || {};
    }
    if (method === 'POST') { const created = { ...body, id: `${bucket.slice(0,-1).toUpperCase()}-${Date.now()}` }; rows.unshift(created); return created; }
  }
  if (path.startsWith('/findings/') && path.endsWith('/decision')) {
    const id = path.split('/')[2];
    const entry = findings.find((item) => item.id === id);
    if (entry) {
      entry.status = body.action === 'dismiss' ? 'dismissed' : 'resolved';
      if (body.action === 'dismiss') {
        const ruleCode = entry.source_ref_id || 'GUIDE-01';
        const matched = fixtureGapRadar.find((r: any) => r.guideline_id === ruleCode || r.guideline_code === ruleCode) || fixtureGapRadar[1];
        matched.flagged += 1;
        matched.dismissed += 1;
        matched.dismissal_rate = Math.round((matched.dismissed / matched.flagged) * 1000) / 10;
        matched.status = (matched.flagged >= 4 && matched.dismissal_rate >= 50) ? 'Unclear Policy' : 'Healthy / Clear';
        if (body.reason && !matched.reasons.includes(body.reason)) {
          matched.reasons.unshift(body.reason);
        }
      }
      audit.unshift({
        id: `a-${Date.now()}`,
        who: useSession.getState().user?.name || 'Meera Nair',
        role: useSession.getState().user?.role || 'creator',
        action: body.action === 'dismiss' ? 'Dismissed finding with reason' : 'Accepted suggested fix',
        target: `${entry.draft_id} · ${entry.id}`,
        timestamp: new Date().toISOString(),
        reason: body.reason || (body.action === 'accept' ? 'Replaced claim with approved brand kit fix' : 'Finding edited'),
        details: `Rule ${entry.source_ref_id} · Excerpt: "${entry.excerpt}"`,
      });
    }
    return { ...body, status: entry?.status || 'resolved' };
  }
  if (path.startsWith('/drafts/') && path.endsWith('/comments') && method === 'POST') {
    const created = { id: `comment-${Date.now()}`, author: 'Meera Nair', text: body.text, created_at: new Date().toISOString() };
    fixtureComments.push(created); return created;
  }
  if (path.startsWith('/drafts/') && path.endsWith('/approve')) {
    const id = path.split('/')[2]; const draft = drafts.find((item) => item.id === id); if (draft) draft.status = 'Approved'; return { status: 'Approved' };
  }
  if (path.startsWith('/drafts/') && path.endsWith('/request-changes')) {
    const id = path.split('/')[2]; const draft = drafts.find((item) => item.id === id); if (draft) draft.status = 'Changes requested'; return { status: 'Changes requested' };
  }
  const match = path.match(/^\/drafts\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const id = match[1], action = match[2];
    if (!action) return drafts.find((d) => d.id === id) || drafts[0];
    if (action === 'findings') return structuredClone(findings.filter((f) => f.draft_id === id));
    if (action === 'review') return { findings: findings.filter((f) => f.draft_id === id || id === 'draft-1'), dropped };
    if (action === 'versions' && method === 'POST') {
      const draft = drafts.find((item) => item.id === id);
      const created = { id: `v-${Date.now()}`, version: (draft?.version || 1) + 1, text: body?.text || draft?.text || '', created_at: new Date().toISOString() };
      versions.push(created); if (draft) { draft.version = created.version; draft.status = 'In review'; draft.text = created.text; }
      return created;
    }
    if (action === 'versions') return structuredClone(versions);
    if (action === 'comments') return structuredClone(fixtureComments);
    if (action === 'diff') return { from: 1, to: 2, before: versions[0].text, after: versions[1].text };
  }
  if (path === '/gap-radar') {
    return structuredClone(fixtureGapRadar);
  }
  if (path === '/audit-log') return structuredClone(audit);
  return [];
}
export const api = {
  login: (data: { email: string; password: string; role: Role }) => request<{ token: string; user: User }>('/auth/login', 'POST', data),
  brandKit: async () => {
    const res = await request<BrandKit>('/brand-kit');
    return {
      guidelines: Array.isArray(res?.guidelines) ? res.guidelines : [],
      facts: Array.isArray(res?.facts) ? res.facts : [],
      terms: Array.isArray(res?.terms) ? res.terms : [],
    };
  },
  saveKitItem: (kind: 'guidelines' | 'facts' | 'terms', data: unknown, id?: string) => request(`/${kind}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', data),
  deleteKitItem: (kind: 'guidelines' | 'facts' | 'terms', id: string) => request(`/${kind}/${id}`, 'DELETE'),
  drafts: async () => {
    const res = await request<Draft[]>('/drafts');
    return Array.isArray(res) ? res : [];
  },
  draft: (id: string) => request<Draft>(`/drafts/${id}`),
  createDraft: (data: { title: string; text: string }) => request<Draft>('/drafts', 'POST', data),
  versions: async (id: string) => {
    const res = await request<Version[]>(`/drafts/${id}/versions`);
    return Array.isArray(res) ? res : [];
  },
  createVersion: (id: string, data: { text?: string }) => request<Version>(`/drafts/${id}/versions`, 'POST', data),
  diff: (id: string, from: number, to: number) => request<any>(`/drafts/${id}/diff?from=${from}&to=${to}`),
  review: (id: string) => request<{ findings: Finding[]; dropped: Dropped[] }>(`/drafts/${id}/review`, 'POST', {}),
  findings: async (id: string) => {
    const res = await request<Finding[]>(`/drafts/${id}/findings`);
    return Array.isArray(res) ? res : [];
  },
  decision: (id: string, data: { action: 'accept' | 'edit' | 'dismiss'; reason?: string; edited_fix?: string }) => request(`/findings/${id}/decision`, 'POST', data),
  comments: async (id: string) => {
    const res = await request<Comment[]>(`/drafts/${id}/comments`);
    return Array.isArray(res) ? res : [];
  },
  addComment: (id: string, data: { text: string }) => request<Comment>(`/drafts/${id}/comments`, 'POST', data),
  approve: (id: string) => request(`/drafts/${id}/approve`, 'POST', {}),
  requestChanges: (id: string, data: { reason: string }) => request(`/drafts/${id}/request-changes`, 'POST', data),
  gapRadar: async () => {
    const res = await request<any[]>('/gap-radar');
    return Array.isArray(res) ? res : [];
  },
  auditLog: async () => {
    const res = await request<AuditItem[]>('/audit-log');
    return Array.isArray(res) ? res : [];
  },
  authConfig: () => request<{ supabase_url: string; supabase_anon_key: string }>('/auth/config'),
  parseDocx: async (file: File): Promise<{ filename: string; text: string; char_count: number; word_count: number; paragraph_count: number; table_count: number }> => {
    // 1. Try backend API endpoint first
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = useSession.getState().token;
      const res = await fetch(`${API_BASE}/drafts/parse-docx`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        return await res.json();
      }
      const err = await res.json().catch(() => ({}));
      if (err?.detail) {
        throw new Error(err.detail);
      }
    } catch (e: any) {
      if (e?.message && !e.message.includes('fetch') && !e.message.includes('NetworkError') && !e.message.includes('unreachable') && !e.message.includes('Failed to fetch')) {
        throw e;
      }
    }

    // 2. Client-side fallback using mammoth for static/offline preview
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value.trim();
      if (!text) {
        throw new Error('The uploaded .docx document contains no readable text.');
      }
      const words = text.split(/\s+/).filter(Boolean).length;
      const paragraphs = text.split(/\n+/).filter(Boolean).length;
      return {
        filename: file.name,
        text,
        char_count: text.length,
        word_count: words,
        paragraph_count: paragraphs,
        table_count: 0,
      };
    } catch (err: any) {
      throw new Error(err?.message || 'Could not parse .docx document.');
    }
  },
};
