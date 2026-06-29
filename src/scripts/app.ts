import { initializeGroups, loadGroupsAndTasks } from '../features/groups/groups';
import { loadStatistics } from '../features/statistics/statistics';
import {
  initializeTimer,
  openSessionSetup,
  restoreTimer
} from '../features/timer/timer';
import { ensureProfile } from '../lib/ensureProfile';
import { supabaseClient } from '../lib/supabaseClient';
import { initializeDialogControls } from '../shared/dialogs';
import { getElement } from '../shared/dom';
import { showNotice } from '../shared/notice';
import { setUserId } from '../stores/focusStore';

async function initialize(): Promise<void> {
  const { data, error } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  if (error || !user) {
    window.location.href = '/login';
    return;
  }

  setUserId(user.id);
  getElement('user-name').textContent =
    user.user_metadata?.full_name ?? user.email ?? '';

  await ensureProfile();
  initializeDialogControls();
  initializeGroups(openSessionSetup);
  initializeTimer();

  try {
    await Promise.all([loadGroupsAndTasks(), loadStatistics()]);
    await restoreTimer();
  } catch (loadError) {
    console.error(loadError);
    getElement('groups-loading').textContent = 'Не удалось загрузить данные.';
    showNotice('Ошибка загрузки данных из Supabase.', 'error');
  }
}

void initialize();
