import { supabaseClient } from '../lib/supabaseClient';

export function fetchGroups() {
  return supabaseClient
    .from('focus_groups')
    .select('id,user_id,title,created_at')
    .order('created_at', { ascending: false });
}

export function createGroup(userId: string, title: string) {
  return supabaseClient
    .from('focus_groups')
    .insert({ user_id: userId, title })
    .select('id,user_id,title,created_at')
    .single();
}

export function deleteGroup(groupId: string) {
  return supabaseClient.from('focus_groups').delete().eq('id', groupId);
}
