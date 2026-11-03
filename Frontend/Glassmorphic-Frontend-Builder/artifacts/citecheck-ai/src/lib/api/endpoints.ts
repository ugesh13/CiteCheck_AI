import type { ApiError, AuditItem, BrandKit, Comment, Draft, Dropped, Finding, ReviewSummary, Role, SelftestResponse, User, VerifierTryResponse, Version } from './types';
import { useSession } from '@/store/session';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const API_BASE_URL = API_BASE;

const headers = () => {
  const token = useSession.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
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
  } else if (typeof p?.detail === 'string') {
    message = p.detail;
  }
  const err = new Error(message) as ApiError;
  err.status = status;
  err.fields = fields;
  return err;
}

function isTokenExpired(token: string | null): boolean {
  if (!token || token.startsWith('preview-token')) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = useSession.getState().token;
  if (isTokenExpired(token)) {
    useSession.getState().setSessionExpired(true);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 401) {
    useSession.getState().setSessionExpired(true);
  }

  if (response.ok) {
    const payload = response.status === 204 ? undefined : await response.json().catch(() => ({}));
    return payload as T;
  }

  const payload = await response.json().catch(() => ({}));
  throw normalizeError(payload, response.status);
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

  saveKitItem: (kind: 'guidelines' | 'facts' | 'terms', data: unknown, id?: string) =>
    request(`/${kind}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', data),

  deleteKitItem: (kind: 'guidelines' | 'facts' | 'terms', id: string) =>
    request(`/${kind}/${id}`, 'DELETE'),

  dashboardMetrics: () =>
    request<{
      draft_pulse: Record<string, number>;
      total_drafts: number;
      open_findings: number;
      resolved_findings: number;
      total_findings: number;
      review_queue_size: number;
      facts_health: { expired: number; expiring: number; active: number };
      audit_events_count: number;
      audit_chain_valid: boolean;
      timestamp: string;
    }>('/dashboard/metrics', 'GET'),

  drafts: async () => {
    const res = await request<Draft[]>('/drafts');
    return Array.isArray(res) ? res : [];
  },

  draft: (id: string) => request<Draft>(`/drafts/${id}`),

  createDraft: (data: { title: string; text: string }) =>
    request<Draft>('/drafts', 'POST', data),

  versions: async (id: string) => {
    const res = await request<Version[]>(`/drafts/${id}/versions`);
    return Array.isArray(res) ? res : [];
  },

  createVersion: (id: string, data: { text?: string }) =>
    request<Version>(`/drafts/${id}/versions`, 'POST', data),

  diff: (id: string, from: number, to: number) =>
    request<any>(`/drafts/${id}/diff?from=${from}&to=${to}`),

  review: (id: string) =>
    request<{ draft_id: string; findings: Finding[]; dropped: Dropped[]; summary?: ReviewSummary }>(
      `/drafts/${id}/review`,
      'POST',
      {}
    ),

  verifierSelftest: () => request<SelftestResponse>('/v1/verifier/selftest', 'GET'),

  verifierTry: (data: { draft_text: string; candidate: Record<string, any> }) =>
    request<VerifierTryResponse>('/v1/verifier/try', 'POST', data),

  factsHealth: () => request<any>('/facts/health', 'GET'),

  renewFact: (id: string, payload?: number | { new_expires_on: string; reason: string }) => {
    if (typeof payload === 'number') {
      return request<any>(`/facts/${id}/renew?days=${payload}`, 'POST', {});
    }
    return request<any>(`/facts/${id}/renew`, 'POST', payload || {});
  },

  archiveFact: (id: string) =>
    request<any>(`/facts/${id}/archive`, 'POST', {}),

  factHistory: (id: string) =>
    request<any[]>(`/facts/${id}/history`, 'GET'),

  notifications: () => request<any[]>('/notifications', 'GET'),

  markNotificationRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, 'POST', {}),

  markAllNotificationsRead: () =>
    request<any>('/notifications/read-all', 'POST', {}),

  scanNotifications: () =>
    request<any>('/notifications/scan', 'POST', {}),

  verifyAuditLog: () =>
    request<{ verified: boolean; message: string; [key: string]: any }>('/audit-log/verify', 'GET'),

  resetDemo: () =>
    request<{ status: string; message: string; timestamp: string }>('/v1/demo/reset', 'POST', {}),

  findings: async (id: string) => {
    const res = await request<Finding[]>(`/drafts/${id}/findings`);
    return Array.isArray(res) ? res : [];
  },

  decision: (id: string, data: { action: 'accept' | 'edit' | 'dismiss'; reason?: string; edited_fix?: string }) =>
    request(`/findings/${id}/decision`, 'POST', data),

  comments: async (id: string) => {
    const res = await request<Comment[]>(`/drafts/${id}/comments`);
    return Array.isArray(res) ? res : [];
  },

  addComment: (id: string, data: { text: string; anchor_finding_id?: string }) =>
    request<Comment>(`/drafts/${id}/comments`, 'POST', data),

  approve: (id: string) =>
    request(`/drafts/${id}/approve`, 'POST', {}),

  requestChanges: (id: string, data: { reason: string }) =>
    request(`/drafts/${id}/request-changes`, 'POST', data),

  gapRadar: async () => {
    const res = await request<any[]>('/gap-radar');
    return Array.isArray(res) ? res : [];
  },

  gapRadarAction: (guidelineId: string, data: { action: string; new_text?: string; reason: string; details?: string }) =>
    request<{ success: boolean; action: string; guideline_id: string; new_text: string }>(
      `/gap-radar/${guidelineId}/action`,
      'POST',
      data
    ),

  auditLog: async () => {
    const res = await request<AuditItem[]>('/audit-log');
    return Array.isArray(res) ? res : [];
  },

  authConfig: () =>
    request<{ supabase_url: string; supabase_anon_key: string }>('/auth/config'),

  parseDocx: async (
    file: File
  ): Promise<{ filename: string; text: string; char_count: number; word_count: number; paragraph_count: number; table_count: number }> => {
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
    } catch {
      // Backend unavailable; proceed to client-side parsing
    }

    // 2. Client-side extraction using mammoth
    try {
      const mammothMod = await import('mammoth/mammoth.browser');
      const mammoth = mammothMod.default || mammothMod;
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = (result.value || '').trim();
      if (text) {
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
      }
    } catch (err: any) {
      console.warn('[CiteCheck] Client mammoth extraction error:', err);
    }

    // 3. Fallback: plain text / markdown read
    try {
      const rawText = await file.text();
      if (rawText && !rawText.includes('\x00') && rawText.length > 0) {
        const words = rawText.split(/\s+/).filter(Boolean).length;
        const paragraphs = rawText.split(/\n+/).filter(Boolean).length;
        return {
          filename: file.name,
          text: rawText.trim(),
          char_count: rawText.length,
          word_count: words,
          paragraph_count: paragraphs,
          table_count: 0,
        };
      }
    } catch {}

    throw new Error('Could not parse document structure. Please ensure the file is an uncorrupted .docx document.');
  },
};
