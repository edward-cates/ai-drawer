// Supabase client
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://staukauuowzlrooepwfo.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey && !supabaseAnonKey) {
  console.warn('Warning: No Supabase keys set. Database features will not work.');
}

// Use service role key for server operations (bypasses RLS since we handle auth ourselves)
// Fall back to anon key for auth operations only
export const supabase = (supabaseServiceKey || supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)
  : null;

// Separate client with anon key for auth operations
export const supabaseAuth = supabaseAnonKey
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

// Version history
export async function saveVersion(designId, userId, document, thumbnail) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('design_versions')
    .insert({
      design_id: designId,
      user_id: userId,
      document,
      thumbnail,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving version:', error);
    return null;
  }
  return data;
}

export async function getVersions(designId, userId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('design_versions')
    .select('id, created_at, thumbnail')
    .eq('design_id', designId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching versions:', error);
    return [];
  }
  return data;
}

export async function getVersion(versionId, userId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('design_versions')
    .select('*')
    .eq('id', versionId)
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching version:', error);
    return null;
  }
  return data;
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

// Usage/rate limiting
const DAILY_PROMPT_LIMIT = 100;

export async function checkRateLimit(userId) {
  if (!supabase) return { allowed: true, remaining: DAILY_PROMPT_LIMIT };

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('usage')
    .select('prompt_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Error checking rate limit:', error);
    return { allowed: true, remaining: DAILY_PROMPT_LIMIT };
  }

  const count = data?.prompt_count || 0;
  const remaining = DAILY_PROMPT_LIMIT - count;

  return {
    allowed: count < DAILY_PROMPT_LIMIT,
    remaining: Math.max(0, remaining),
    limit: DAILY_PROMPT_LIMIT,
  };
}

export async function incrementUsage(userId) {
  if (!supabase) return;

  const today = new Date().toISOString().split('T')[0];

  // Try to increment existing row
  const { data, error } = await supabase
    .from('usage')
    .select('id, prompt_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row exists, create one
    await supabase
      .from('usage')
      .insert({ user_id: userId, date: today, prompt_count: 1 });
  } else if (data) {
    // Increment existing
    await supabase
      .from('usage')
      .update({ prompt_count: data.prompt_count + 1 })
      .eq('id', data.id);
  }
}
