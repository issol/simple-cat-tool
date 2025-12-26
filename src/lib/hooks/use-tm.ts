'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserTMs,
  fetchTMEntries,
  createTM,
  updateTM,
  deleteTM,
  addTMEntry,
  deleteTMEntryById,
  importTMEntries,
  type TranslationMemory,
  type DBTMEntry,
} from '@/lib/supabase/tm-service';
import type { TMEntry } from '@/types';

// Query Keys
export const tmKeys = {
  all: ['tms'] as const,
  lists: () => [...tmKeys.all, 'list'] as const,
  list: (clientId?: string | null) => [...tmKeys.lists(), clientId] as const,
  entries: (tmId: string) => [...tmKeys.all, 'entries', tmId] as const,
};

// ============ Queries ============

/**
 * Fetch all TMs for current user
 */
export function useTMList(clientId?: string | null) {
  return useQuery({
    queryKey: tmKeys.list(clientId),
    queryFn: () => fetchUserTMs(clientId),
  });
}

/**
 * Fetch entries for a specific TM
 */
export function useTMEntries(tmId: string | null) {
  return useQuery({
    queryKey: tmKeys.entries(tmId || ''),
    queryFn: () => (tmId ? fetchTMEntries(tmId) : Promise.resolve([])),
    enabled: !!tmId,
  });
}

// ============ Mutations ============

/**
 * Create a new TM
 */
export function useCreateTM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      sourceLang,
      targetLangs,
      clientId,
      note,
    }: {
      name: string;
      sourceLang: string;
      targetLangs: string[];
      clientId?: string | null;
      note?: string;
    }) => createTM(name, sourceLang, targetLangs, clientId, note),
    onSuccess: (newTM) => {
      if (newTM) {
        queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
      }
    },
  });
}

/**
 * Update a TM
 */
export function useUpdateTM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<{ name: string; source_lang: string; target_langs: string[]; note: string }>;
    }) => updateTM(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
    },
  });
}

/**
 * Delete a TM
 */
export function useDeleteTM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTM(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
    },
  });
}

/**
 * Add a single TM entry
 */
export function useAddTMEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tmId,
      entry,
      targetLang,
    }: {
      tmId: string;
      entry: TMEntry;
      targetLang: string;
    }) => addTMEntry(tmId, entry, targetLang),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tmKeys.entries(variables.tmId) });
      queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
    },
  });
}

/**
 * Delete a TM entry
 */
export function useDeleteTMEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, tmId }: { entryId: string; tmId: string }) =>
      deleteTMEntryById(entryId, tmId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tmKeys.entries(variables.tmId) });
      queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
    },
  });
}

/**
 * Import multiple TM entries (from TMX file)
 */
export function useImportTMEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tmId,
      entries,
      targetLang,
    }: {
      tmId: string;
      entries: TMEntry[];
      targetLang: string;
    }) => importTMEntries(tmId, entries, targetLang),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tmKeys.entries(variables.tmId) });
      queryClient.invalidateQueries({ queryKey: tmKeys.lists() });
    },
  });
}
