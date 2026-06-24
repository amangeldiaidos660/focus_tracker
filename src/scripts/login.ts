import { supabaseClient } from '../lib/supabaseClient';

const btn = document.getElementById('btn-google-login');
if (btn) {
  btn.addEventListener('click', async () => {
    await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
  });
}
