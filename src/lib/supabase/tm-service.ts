import { createClient } from './client';
import type { TMEntry } from '@/types';

export interface DBTMEntry {
  id: string;
  user_id: string;
  source: string;
  target: string;
  prev_source: string | null;
  next_source: string | null;
  source_lang: string;
  target_lang: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all TM entries for the current user
 */
export async function fetchUserTM(): Promise<TMEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('translation_memories')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching TM:', error);
    return [];
  }

  return (data || []).map((entry: DBTMEntry) => ({
    source: entry.source,
    target: entry.target,
    prevSource: entry.prev_source || undefined,
    nextSource: entry.next_source || undefined,
  }));
}

/**
 * Add a new TM entry for the current user
 */
export async function addTMEntry(
  entry: TMEntry,
  sourceLang: string = 'EN',
  targetLang: string = 'KO'
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if entry already exists
  const { data: existing } = await supabase
    .from('translation_memories')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', entry.source)
    .single();

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('translation_memories')
      .update({
        target: entry.target,
        prev_source: entry.prevSource || null,
        next_source: entry.nextSource || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating TM:', error);
      return false;
    }
  } else {
    // Insert new entry
    const { error } = await supabase
      .from('translation_memories')
      .insert({
        user_id: user.id,
        source: entry.source,
        target: entry.target,
        prev_source: entry.prevSource || null,
        next_source: entry.nextSource || null,
        source_lang: sourceLang,
        target_lang: targetLang,
      });

    if (error) {
      console.error('Error adding TM:', error);
      return false;
    }
  }

  return true;
}

/**
 * Delete a TM entry
 */
export async function deleteTMEntry(source: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('translation_memories')
    .delete()
    .eq('user_id', user.id)
    .eq('source', source);

  if (error) {
    console.error('Error deleting TM:', error);
    return false;
  }

  return true;
}

/**
 * Import multiple TM entries (from TMX file)
 */
export async function importTMEntries(
  entries: TMEntry[],
  sourceLang: string = 'EN',
  targetLang: string = 'KO'
): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  let imported = 0;

  for (const entry of entries) {
    const success = await addTMEntry(entry, sourceLang, targetLang);
    if (success) imported++;
  }

  return imported;
}
