import { supabaseClient } from './supabaseClient';

export async function ensureProfile() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();

  if (userError || !userData.user) {
    return { created: false, error: userError ?? null };
  }

  const user = userData.user;

  const { error } = await supabaseClient.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null
    },
    { onConflict: 'id' }
  );

  if (error) {
    return { created: false, error };
  }

  return { created: true, error: null };
}
