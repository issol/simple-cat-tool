import { createClient } from './client';

export interface Client {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all clients for the current user
 */
export async function fetchUserClients(): Promise<Client[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return data || [];
}

/**
 * Create a new client
 */
export async function createClientEntry(
  name: string,
  sourceLang: string = 'EN',
  targetLang: string = 'KO',
  description?: string
): Promise<Client | null> {
  const supabase = createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('clients')
    .insert({
      user_id: user.id,
      name,
      source_lang: sourceLang,
      target_lang: targetLang,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }

  return data;
}

/**
 * Update a client
 */
export async function updateClientEntry(
  id: string,
  updates: Partial<{ name: string; source_lang: string; target_lang: string; description: string }>
): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('clients')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating client:', error);
    return false;
  }

  return true;
}

/**
 * Delete a client
 */
export async function deleteClientEntry(id: string): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting client:', error);
    return false;
  }

  return true;
}

/**
 * Get TM count for a client
 */
export async function getClientTMCount(clientId: string): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('translation_memories')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (error) {
    console.error('Error getting TM count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get Termbase count for a client
 */
export async function getClientTBCount(clientId: string): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from('termbases')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);

  if (error) {
    console.error('Error getting TB count:', error);
    return 0;
  }

  return count || 0;
}
