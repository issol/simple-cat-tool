import { createClient } from './client';
import type { TMEntry } from '@/types';

// TM Container (the TM itself with metadata)
export interface TranslationMemory {
  id: string;
  user_id: string;
  client_id: string | null;
  name: string;
  source_lang: string;
  target_langs: string[];
  note: string | null;
  entry_count: number;
  created_at: string;
  updated_at: string;
}

// TM Entry (individual translation pairs inside a TM)
export interface DBTMEntry {
  id: string;
  tm_id: string;
  source: string;
  target: string;
  target_lang: string;
  prev_source: string | null;
  next_source: string | null;
  created_at: string;
  updated_at: string;
}

// ============ TM Container Functions ============

/**
 * Fetch all TMs for the current user (optionally filtered by client)
 */
export async function fetchUserTMs(clientId?: string | null): Promise<TranslationMemory[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from('translation_memories')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching TMs:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new TM container
 */
export async function createTM(
  name: string,
  sourceLang: string,
  targetLangs: string[],
  clientId?: string | null,
  note?: string
): Promise<TranslationMemory | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('translation_memories')
    .insert({
      user_id: user.id,
      client_id: clientId || null,
      name,
      source_lang: sourceLang,
      target_langs: targetLangs,
      note: note || null,
      entry_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating TM:', error);
    return null;
  }

  return data;
}

/**
 * Update a TM container
 */
export async function updateTM(
  id: string,
  updates: Partial<{ name: string; source_lang: string; target_langs: string[]; note: string }>
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('translation_memories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error updating TM:', error);
    return false;
  }

  return true;
}

/**
 * Delete a TM container (and all its entries)
 */
export async function deleteTM(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // Entries will be deleted automatically via ON DELETE CASCADE
  const { error } = await supabase
    .from('translation_memories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting TM:', error);
    return false;
  }

  return true;
}

// ============ TM Entry Functions ============

/**
 * Fetch all entries for a specific TM
 */
export async function fetchTMEntries(tmId: string): Promise<DBTMEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tm_entries')
    .select('*')
    .eq('tm_id', tmId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching TM entries:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch entries from a TM as TMEntry format (for matching)
 */
export async function fetchTMEntriesForMatching(tmId: string): Promise<TMEntry[]> {
  const entries = await fetchTMEntries(tmId);
  return entries.map(entry => ({
    source: entry.source,
    target: entry.target,
    prevSource: entry.prev_source || undefined,
    nextSource: entry.next_source || undefined,
  }));
}

/**
 * Fetch all entries from multiple TMs (for matching across TMs)
 */
export async function fetchAllTMEntriesForMatching(tmIds: string[]): Promise<TMEntry[]> {
  if (tmIds.length === 0) return [];

  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('tm_entries')
    .select('*')
    .in('tm_id', tmIds);

  if (error) {
    console.error('Error fetching TM entries:', error);
    return [];
  }

  return (data || []).map(entry => ({
    source: entry.source,
    target: entry.target,
    prevSource: entry.prev_source || undefined,
    nextSource: entry.next_source || undefined,
  }));
}

/**
 * Add a new entry to a TM
 */
export async function addTMEntry(
  tmId: string,
  entry: TMEntry,
  targetLang: string
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  // Check if entry already exists in this TM
  const { data: existing } = await supabase
    .from('tm_entries')
    .select('id')
    .eq('tm_id', tmId)
    .eq('source', entry.source)
    .eq('target_lang', targetLang)
    .single();

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('tm_entries')
      .update({
        target: entry.target,
        prev_source: entry.prevSource || null,
        next_source: entry.nextSource || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating TM entry:', error);
      return false;
    }
  } else {
    // Insert new entry
    const { error } = await supabase
      .from('tm_entries')
      .insert({
        tm_id: tmId,
        source: entry.source,
        target: entry.target,
        target_lang: targetLang,
        prev_source: entry.prevSource || null,
        next_source: entry.nextSource || null,
      });

    if (error) {
      console.error('Error adding TM entry:', error);
      return false;
    }

    // Update entry count
    await updateTMEntryCount(tmId);
  }

  return true;
}

/**
 * Delete a TM entry by ID
 */
export async function deleteTMEntryById(entryId: string, tmId: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('tm_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting TM entry:', error);
    return false;
  }

  // Update entry count
  await updateTMEntryCount(tmId);

  return true;
}

/**
 * Update entry count for a TM
 */
async function updateTMEntryCount(tmId: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const { count } = await supabase
    .from('tm_entries')
    .select('*', { count: 'exact', head: true })
    .eq('tm_id', tmId);

  await supabase
    .from('translation_memories')
    .update({ entry_count: count || 0, updated_at: new Date().toISOString() })
    .eq('id', tmId);
}

/**
 * Import multiple TM entries (from TMX file) - Batch insert
 */
export async function importTMEntries(
  tmId: string,
  entries: TMEntry[],
  targetLang: string
): Promise<number> {
  const supabase = createClient();
  if (!supabase || entries.length === 0) return 0;

  // Prepare batch data
  const batchData = entries.map(entry => ({
    tm_id: tmId,
    source: entry.source,
    target: entry.target,
    target_lang: targetLang,
    prev_source: entry.prevSource || null,
    next_source: entry.nextSource || null,
  }));

  // Batch insert in chunks of 500 (Supabase limit)
  const chunkSize = 500;
  let totalImported = 0;

  for (let i = 0; i < batchData.length; i += chunkSize) {
    const chunk = batchData.slice(i, i + chunkSize);

    const { data, error } = await supabase
      .from('tm_entries')
      .insert(chunk)
      .select();

    if (error) {
      console.error('Error batch importing TM entries:', error);
      continue;
    }

    totalImported += data?.length || 0;
  }

  // Update entry count once at the end
  await updateTMEntryCount(tmId);

  return totalImported;
}

// ============ Legacy Support (for backward compatibility) ============

/**
 * @deprecated Use fetchUserTMs instead
 */
export async function fetchUserTM(clientId?: string | null): Promise<TMEntry[]> {
  const tms = await fetchUserTMs(clientId);
  if (tms.length === 0) return [];

  // Get entries from all TMs
  const allEntries: TMEntry[] = [];
  for (const tm of tms) {
    const entries = await fetchTMEntriesForMatching(tm.id);
    allEntries.push(...entries);
  }
  return allEntries;
}

/**
 * @deprecated Use fetchTMEntries instead
 */
export async function fetchUserTMWithDetails(clientId?: string | null): Promise<DBTMEntry[]> {
  const tms = await fetchUserTMs(clientId);
  if (tms.length === 0) return [];

  const allEntries: DBTMEntry[] = [];
  for (const tm of tms) {
    const entries = await fetchTMEntries(tm.id);
    allEntries.push(...entries);
  }
  return allEntries;
}
