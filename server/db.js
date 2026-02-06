// Supabase client
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://staukauuowzlrooepwfo.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('Warning: SUPABASE_ANON_KEY not set. Database features will not work.');
}

export const supabase = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Design operations
export async function getDesigns(userId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('designs')
    .select('id, name, thumbnail, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching designs:', error);
    return [];
  }
  return data;
}

export async function getDesign(id, userId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching design:', error);
    return null;
  }
  return data;
}

export async function createDesign(userId, name, document, thumbnail) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('designs')
    .insert({
      user_id: userId,
      name,
      document,
      thumbnail,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating design:', error);
    throw error;
  }
  return data;
}

export async function updateDesign(id, userId, updates) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('designs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating design:', error);
    throw error;
  }
  return data;
}

export async function deleteDesign(id, userId) {
  if (!supabase) return false;

  const { error } = await supabase
    .from('designs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting design:', error);
    return false;
  }
  return true;
}

// Auth helpers
export async function getUser(accessToken) {
  if (!supabase) return null;

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    console.error('Error getting user:', error);
    return null;
  }
  return user;
}
