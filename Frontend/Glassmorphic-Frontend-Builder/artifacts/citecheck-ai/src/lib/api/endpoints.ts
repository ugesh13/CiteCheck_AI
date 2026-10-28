import { audit, brandKit, demoUsers, dropped, drafts, findings, versions } from './fixtures';
import type { ApiError, AuditItem, BrandKit, Comment, Draft, Dropped, Finding, Role, User, Version } from './types';
import { useSession } from '@/store/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = API_BASE;
const fixturesEnabled = import.meta.env.VITE_USE_FIXTURES === 'true';
const fixtureComments: Comment[] = [];
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
    if (response.status === 401) { useSession.getState().logout(); window.location.assign('/login'); }
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
    if (method === 'PATCH' && id) { const index = rows.findIndex((item) => item.id === id); if (index >= 0) rows[index] = { ...rows[index], ...body }; return rows[index] || {}; }
    if (method === 'POST') { const created = { ...body, id: `${bucket.slice(0,-1).toUpperCase()}-${Date.now()}` }; rows.unshift(created); return created; }
  }
  if (path.startsWith('/findings/') && path.endsWith('/decision')) {
    const id = path.split('/')[2];
    const entry = findings.find((item) => item.id === id);
    if (entry) entry.status = body.action === 'dismiss' ? 'dismissed' : 'resolved';
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
  if (path === '/gap-radar') return [{ rule: 'Claims need proof', flagged: 8, dismissed: 3, reasons: ['The approved source is unclear', 'This is descriptive, not a claim'], status: 'Possibly unclear', guideline_id: 'GUIDE-01' }, { rule: 'Plainspoken confidence', flagged: 5, dismissed: 1, reasons: ['Needs clearer examples'], status: 'Review pattern', guideline_id: 'GUIDE-02' }];
  if (path === '/audit-log') return structuredClone(audit);
  return [];
}
export const api = {
  login: (data: { email: string; password: string; role: Role }) => request<{ token: string; user: User }>('/auth/login', 'POST', data),
  brandKit: () => request<BrandKit>('/brand-kit'),
  saveKitItem: (kind: 'guidelines' | 'facts' | 'terms', data: unknown, id?: string) => request(`/${kind}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', data),
  deleteKitItem: (kind: 'guidelines' | 'facts' | 'terms', id: string) => request(`/${kind}/${id}`, 'DELETE'),
  drafts: () => request<Draft[]>('/drafts'),
  draft: (id: string) => request<Draft>(`/drafts/${id}`),
  createDraft: (data: { title: string; text: string }) => request<Draft>('/drafts', 'POST', data),
  versions: (id: string) => request<Version[]>(`/drafts/${id}/versions`),
  createVersion: (id: string, data: { text?: string }) => request<Version>(`/drafts/${id}/versions`, 'POST', data),
  diff: (id: string, from: number, to: number) => request<any>(`/drafts/${id}/diff?from=${from}&to=${to}`),
  review: (id: string) => request<{ findings: Finding[]; dropped: Dropped[] }>(`/drafts/${id}/review`, 'POST', {}),
  findings: (id: string) => request<Finding[]>(`/drafts/${id}/findings`),
  decision: (id: string, data: { action: 'accept' | 'edit' | 'dismiss'; reason?: string; edited_fix?: string }) => request(`/findings/${id}/decision`, 'POST', data),
  comments: (id: string) => request<Comment[]>(`/drafts/${id}/comments`),
  addComment: (id: string, data: { text: string }) => request<Comment>(`/drafts/${id}/comments`, 'POST', data),
  approve: (id: string) => request(`/drafts/${id}/approve`, 'POST', {}),
  requestChanges: (id: string, data: { reason: string }) => request(`/drafts/${id}/request-changes`, 'POST', data),
  gapRadar: () => request<any[]>('/gap-radar'),
  auditLog: () => request<AuditItem[]>('/audit-log'),
};
