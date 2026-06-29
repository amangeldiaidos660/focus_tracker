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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function initializeKazakhstanClock(): void {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Qyzylorda',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const updateClock = () => {
    getElement('dashboard-current-time').textContent = formatter.format(
      new Date()
    );
  };

  updateClock();
  window.setInterval(updateClock, 30_000);
}

async function initialize(): Promise<void> {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.style.colorScheme = 'dark';
  initializeKazakhstanClock();

  const { data, error } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  if (error || !user) {
    window.location.replace('/login');
    return;
  }

  setUserId(user.id);
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Пользователь';
  getElement('user-name').textContent = displayName;
  getElement('user-initials').textContent = getInitials(displayName) || 'FT';

  await ensureProfile();
  initializeDialogControls();
  initializeGroups(openSessionSetup);
  initializeTimer();

  try {
    await loadGroupsAndTasks();
    await loadStatistics();
    await restoreTimer();
  } catch (loadError) {
    console.error(loadError);
    getElement('groups-loading').textContent = 'Не удалось загрузить данные.';
    showNotice('Ошибка загрузки данных из Supabase.', 'error');
  }
}

void initialize();
