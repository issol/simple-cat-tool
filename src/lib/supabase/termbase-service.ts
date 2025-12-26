import { createClient } from './client';
import type { TermbaseEntry } from '@/types';

export interface DBTermbaseEntry {
  id: string;
  user_id: string;
  source: string;
  target: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all Termbase entries for the current user
 */
export async function fetchUserTermbase(): Promise<TermbaseEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('termbases')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching Termbase:', error);
    return [];
  }

  return (data || []).map((entry: DBTermbaseEntry) => ({
    source: entry.source,
    target: entry.target,
    note: entry.note || '',
  }));
}

/**
 * Add a new Termbase entry for the current user
 */
export async function addTermbaseEntry(entry: TermbaseEntry): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if entry already exists
  const { data: existing } = await supabase
    .from('termbases')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', entry.source)
    .single();

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('termbases')
      .update({
        target: entry.target,
        note: entry.note || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating Termbase:', error);
      return false;
    }
  } else {
    // Insert new entry
    const { error } = await supabase
      .from('termbases')
      .insert({
        user_id: user.id,
        source: entry.source,
        target: entry.target,
        note: entry.note || null,
      });

    if (error) {
      console.error('Error adding Termbase:', error);
      return false;
    }
  }

  return true;
}

/**
 * Delete a Termbase entry
 */
export async function deleteTermbaseEntry(source: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('termbases')
    .delete()
    .eq('user_id', user.id)
    .eq('source', source);

  if (error) {
    console.error('Error deleting Termbase:', error);
    return false;
  }

  return true;
}
