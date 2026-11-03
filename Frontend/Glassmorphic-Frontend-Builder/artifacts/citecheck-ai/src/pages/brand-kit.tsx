import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Settings2, X, Layers3, ArrowRight } from 'lucide-react';

import { api } from '@/lib/api/endpoints';
import { useBrandKit, keys } from '@/hooks/use-product-data';
import { useSession } from '@/store/session';
import { kitItemSchema } from '@/lib/schemas';
import {
  PageHead,
  Tag,
  Glass,
  Button,
  Field,
  TextArea,
  LoadingCards,
  ApiFailure,
  Eyebrow,
  roleName,
} from '@/components/ui-atoms';
import { BrandKitFacts } from '@/components/brand-kit-facts';

export function BrandKitPage() {
  const { data, isLoading, isError, error, refetch } = useBrandKit();
  const user = useSession((s) => s.user);
  const client = useQueryClient();
  const [tab, setTab] = useState<'guidelines' | 'facts' | 'terms'>('facts');
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const kitForm = useForm<any>({
    resolver: zodResolver(kitItemSchema),
    defaultValues: {
      kind: tab,
      title: '',
      text: '',
      source: '',
      review_date: '',
      banned: '',
      preferred: '',
      allow_ai: true,
    },
  });

  const canEdit = user?.role === 'brand_manager';

  const kit = {
    guidelines: Array.isArray(data?.guidelines) ? data.guidelines : [],
    facts: Array.isArray(data?.facts) ? data.facts : [],
    terms: Array.isArray(data?.terms) ? data.terms : [],
  };

  const add = kitForm.handleSubmit(async (values) => {
    const { kind: _kind, ...payload } = values;
    try {
      await api.saveKitItem(tab, payload, editingId || undefined);
      await client.invalidateQueries({ queryKey: keys.kit });
      setAddOpen(false);
      setEditingId(null);
      kitForm.reset({
        kind: tab,
        title: '',
        text: '',
        source: '',
        review_date: '',
        banned: '',
        preferred: '',
        allow_ai: true,
      });
      toast.success(editingId ? 'Brand kit entry updated' : 'Brand kit entry saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save item');
    }
  });

  const editItem = (id: string, item: any) => {
    setEditingId(id);
    kitForm.reset({
      kind: tab,
      title: item.title || '',
      text: item.text || '',
      source: item.source || '',
      review_date: item.review_date || '',
      banned: item.banned || '',
      preferred: item.preferred || '',
      allow_ai: item.allow_ai ?? true,
    });
    setAddOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete ${id} from the brand kit?`)) return;
    try {
      await api.deleteKitItem(tab, id);
      await client.invalidateQueries({ queryKey: keys.kit });
      toast.success('Entry deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="page-enter">
      <PageHead
        eyebrow="Lumen Pay · Ground Truth Evidence"
        title="Brand kit"
        sub="The approved ground truth behind every finding. Managers own changes; everyone else can read."
        action={
          canEdit ? (
            <Button
              onClick={() => {
                kitForm.reset({
                  kind: tab,
                  title: '',
                  text: '',
                  source: '',
                  review_date: '',
                  banned: '',
                  preferred: '',
                  allow_ai: true,
                });
                setAddOpen(true);
              }}
              data-testid="button-add-kit-item"
            >
              <Plus size={15} />
              Add {tab === 'facts' ? 'fact' : tab === 'terms' ? 'term' : 'guideline'}
            </Button>
          ) : (
            <Tag>Read only · {roleName(user?.role)}</Tag>
          )
        }
      />

      {/* Tabs Switcher */}
      <Glass className="mb-5 flex flex-wrap items-center justify-between gap-4 p-3 sm:p-4">
        <div className="flex rounded-xl bg-background/45 p-1">
          {(['guidelines', 'facts', 'terms'] as const).map((t) => (
            <button
              onClick={() => setTab(t)}
              key={t}
              className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition ${
                tab === t ? 'bg-teal-300 text-slate-950 shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`tab-${t}`}
            >
              {t} · {kit[t]?.length ?? 0}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          Deterministic Evidence Baseline
        </div>
      </Glass>

      {isLoading ? (
        <LoadingCards />
      ) : isError ? (
        <ApiFailure error={error} retry={() => refetch()} />
      ) : (
        <div className="grid gap-3">
          {/* TAB 1: GUIDELINES */}
          {tab === 'guidelines' &&
            kit.guidelines.map((item) => (
              <Glass
                key={item.id}
                className="glass-hover flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
                data-testid={`card-guideline-${item.id}`}
              >
                <div className="flex items-start gap-4">
                  <span className="mono mt-1 text-[10px] text-violet-500 font-bold">{item.id}</span>
                  <div>
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit ? (
                    <>
                      <Button variant="quiet" onClick={() => editItem(item.id, item)} className="px-3 py-2 text-xs">
                        Edit
                      </Button>
                      <Button variant="quiet" onClick={() => remove(item.id)} className="px-3 py-2 text-xs">
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Tag>Manager owned</Tag>
                  )}
                </div>
              </Glass>
            ))}

          {/* TAB 2: FACTS (Governed with Fact Expiry, Renewals, History, Sorting) */}
          {tab === 'facts' && (
            <BrandKitFacts
              facts={kit.facts}
              canEdit={canEdit}
              onEditFact={editItem}
              onRemoveFact={remove}
            />
          )}

          {/* TAB 3: TERMS */}
          {tab === 'terms' &&
            kit.terms.map((item) => (
              <Glass
                key={item.id}
                className="glass-hover grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr_auto_auto] sm:items-center"
                data-testid={`card-term-${item.id}`}
              >
                <div>
                  <Eyebrow>Don't say</Eyebrow>
                  <p className="mt-1 font-bold text-rose-500">{item.banned}</p>
                </div>
                <ArrowRight size={17} className="hidden text-muted-foreground sm:block" />
                <div>
                  <Eyebrow>Say instead</Eyebrow>
                  <p className="mt-1 font-bold text-teal-600 dark:text-teal-200">{item.preferred}</p>
                </div>
                {canEdit && (
                  <>
                    <button
                      onClick={() => editItem(item.id, item)}
                      aria-label={`Edit ${item.id}`}
                      className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-teal-400/10 hover:text-teal-500"
                    >
                      <Settings2 size={14} />
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      aria-label={`Delete ${item.id}`}
                      className="justify-self-end rounded-lg p-2 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-500"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
              </Glass>
            ))}

          {!kit[tab]?.length && (
            <Glass className="p-8 text-center">
              <Layers3 className="mx-auto text-muted-foreground" />
              <h3 className="display mt-3 font-bold">No entries in this section yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">A manager can add approved material here.</p>
            </Glass>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onClick={() => {
            setAddOpen(false);
            setEditingId(null);
          }}
        >
          <Glass className="w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="display text-xl font-bold">
                {editingId ? 'Edit' : 'Add'} {tab === 'facts' ? 'approved fact' : tab === 'terms' ? 'term pair' : 'guideline'}
              </h2>
              <button
                onClick={() => {
                  setAddOpen(false);
                  setEditingId(null);
                }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={add} className="mt-5 grid gap-3" noValidate>
              {tab === 'guidelines' && (
                <Field
                  label="Title"
                  {...kitForm.register('title')}
                  error={kitForm.formState.errors.title?.message as string}
                />
              )}
              {tab === 'terms' ? (
                <>
                  <Field
                    label="Banned wording"
                    {...kitForm.register('banned')}
                    error={kitForm.formState.errors.banned?.message as string}
                  />
                  <Field
                    label="Preferred wording"
                    {...kitForm.register('preferred')}
                    error={kitForm.formState.errors.preferred?.message as string}
                  />
                </>
              ) : (
                <TextArea
                  label={tab === 'facts' ? 'Approved fact' : 'Guideline text'}
                  rows={3}
                  {...kitForm.register('text')}
                  error={kitForm.formState.errors.text?.message as string}
                />
              )}
              {tab === 'facts' && (
                <>
                  <Field
                    label="Source document"
                    {...kitForm.register('source')}
                    error={kitForm.formState.errors.source?.message as string}
                  />
                  <Field
                    label="Review expiration date"
                    type="date"
                    {...kitForm.register('review_date')}
                    error={kitForm.formState.errors.review_date?.message as string}
                  />
                  <label className="flex gap-2 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" {...kitForm.register('allow_ai')} className="accent-teal-400" />
                    Allow AI to use this fact
                  </label>
                </>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">{editingId ? 'Save changes' : 'Save to brand kit'}</Button>
              </div>
            </form>
          </Glass>
        </div>
      )}
    </div>
  );
}

