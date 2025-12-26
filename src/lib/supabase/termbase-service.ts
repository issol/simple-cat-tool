import { createClient } from './client';
import type { TermbaseEntry } from '@/types';

export interface DBTermbaseEntry {
  id: string;
  user_id: string;
  client_id: string | null;
  source: string;
  target: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all Termbase entries for the current user (optionally filtered by client)
 */
export async function fetchUserTermbase(clientId?: string | null): Promise<TermbaseEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from('termbases')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

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
 * Fetch Termbase entries with full DB info (for TB list view)
 */
export async function fetchUserTermbaseWithDetails(clientId?: string | null): Promise<DBTermbaseEntry[]> {
  const supabase = createClient();
  if (!supabase) return [];

  let query = supabase
    .from('termbases')
    .select('*')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching Termbase:', error);
    return [];
  }

  return data || [];
}

/**
 * Add a new Termbase entry for the current user
 */
export async function addTermbaseEntry(
  entry: TermbaseEntry,
  clientId?: string | null
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if entry already exists for this client
  let existingQuery = supabase
    .from('termbases')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', entry.source);

  if (clientId) {
    existingQuery = existingQuery.eq('client_id', clientId);
  } else {
    existingQuery = existingQuery.is('client_id', null);
  }

  const { data: existing } = await existingQuery.single();

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
        client_id: clientId || null,
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
 * Delete a Termbase entry by ID
 */
export async function deleteTermbaseEntryById(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('termbases')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting Termbase:', error);
    return false;
  }

  return true;
}

/**
 * Delete a Termbase entry by source text
 */
export async function deleteTermbaseEntry(source: string, clientId?: string | null): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  let query = supabase
    .from('termbases')
    .delete()
    .eq('user_id', user.id)
    .eq('source', source);

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { error } = await query;

  if (error) {
    console.error('Error deleting Termbase:', error);
    return false;
  }

  return true;
}
