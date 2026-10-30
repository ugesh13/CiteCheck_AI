import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/endpoints';
import { toast } from 'sonner';

export const keys = {
  kit: ['brand-kit'] as const, drafts: ['drafts'] as const,
  draft: (id: string) => ['draft', id] as const,
  findings: (id: string) => ['findings', id] as const,
  versions: (id: string) => ['versions', id] as const,
  comments: (id: string) => ['comments', id] as const,
  radar: ['gap-radar'] as const, audit: ['audit-log'] as const,
};
const queryOptions = { staleTime: 20_000, refetchOnWindowFocus: true };
export const useBrandKit = () => useQuery({ queryKey: keys.kit, queryFn: api.brandKit, ...queryOptions });
export const useDrafts = () => useQuery({ queryKey: keys.drafts, queryFn: api.drafts, ...queryOptions });
export const useDraft = (id: string) => useQuery({ queryKey: keys.draft(id), queryFn: () => api.draft(id), enabled: !!id, ...queryOptions });
export const useFindings = (id: string) => useQuery({ queryKey: keys.findings(id), queryFn: () => api.findings(id), enabled: !!id, ...queryOptions });
export const useVersions = (id: string) => useQuery({ queryKey: keys.versions(id), queryFn: () => api.versions(id), enabled: !!id, ...queryOptions });
export const useComments = (id: string) => useQuery({ queryKey: keys.comments(id), queryFn: () => api.comments(id), enabled: !!id, ...queryOptions });
export const useGapRadar = () => useQuery({ queryKey: keys.radar, queryFn: api.gapRadar, ...queryOptions });
export const useAuditLog = () => useQuery({ queryKey: keys.audit, queryFn: api.auditLog, ...queryOptions });
export function useDecision(draftId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: { id: string; action: 'accept' | 'edit' | 'dismiss'; reason?: string; edited_fix?: string }) => api.decision(id, data),
    onMutate: async ({ id, action }) => { await client.cancelQueries({ queryKey: keys.findings(draftId) }); const previous = client.getQueryData<any[]>(keys.findings(draftId)); client.setQueryData<any[]>(keys.findings(draftId), (old) => old?.map((f) => f.id === id ? { ...f, status: action === 'dismiss' ? 'dismissed' : 'resolved' } : f)); return { previous }; },
    onError: (_e, _v, context) => client.setQueryData(keys.findings(draftId), context?.previous),
    onSettled: () => { client.invalidateQueries({ queryKey: keys.findings(draftId) }); client.invalidateQueries({ queryKey: keys.audit }); client.invalidateQueries({ queryKey: keys.radar }); client.invalidateQueries({ queryKey: keys.drafts }); },
  });
}
export function useReviewRun(draftId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.review(draftId),
    onSuccess: (data) => { client.setQueryData(keys.findings(draftId), data.findings); client.invalidateQueries({ queryKey: keys.drafts }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Review could not complete'),
  });
}
export function useCreateDraft() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.createDraft, onSuccess: () => client.invalidateQueries({ queryKey: keys.drafts }) });
}
export function useCreateVersion(draftId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (data: { text?: string }) => api.createVersion(draftId, data), onSuccess: () => { client.invalidateQueries({ queryKey: keys.versions(draftId) }); client.invalidateQueries({ queryKey: keys.drafts }); } });
}
export function useAddComment(draftId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data: { text: string }) => api.addComment(draftId, data),
    onMutate: async (data) => {
      await client.cancelQueries({ queryKey: keys.comments(draftId) });
      const previous = client.getQueryData<any[]>(keys.comments(draftId));
      client.setQueryData<any[]>(keys.comments(draftId), (old) => [...(old || []), { id: `optimistic-${Date.now()}`, author: 'You', text: data.text, created_at: new Date().toISOString() }]);
      return { previous };
    },
    onError: (_error, _data, context) => client.setQueryData(keys.comments(draftId), context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.comments(draftId) }),
  });
}
export function useReviewDecision(draftId: string) {
  const client = useQueryClient();
  return {
    approve: useMutation({ mutationFn: () => api.approve(draftId), onSuccess: () => { client.invalidateQueries({ queryKey: keys.drafts }); client.invalidateQueries({ queryKey: keys.audit }); } }),
    requestChanges: useMutation({ mutationFn: (data: { reason: string }) => api.requestChanges(draftId, data), onSuccess: () => { client.invalidateQueries({ queryKey: keys.drafts }); client.invalidateQueries({ queryKey: keys.audit }); } }),
  };
}
