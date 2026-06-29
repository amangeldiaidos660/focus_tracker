import {
  getNotificationPermission,
  notificationsSupported,
  setNotificationsEnabled
} from '../features/notifications/notificationService';
import {
  getNotificationSettings,
  updateNotificationSettings
} from '../features/notifications/notificationSettings';
import { playTimerSound, unlockTimerSound } from '../features/notifications/sound';
import { supabaseClient } from '../lib/supabaseClient';

function updatePermissionStatus(): void {
  const status = document.getElementById('notification-permission');

  if (!status) {
    return;
  }

  const permission = getNotificationPermission();

  status.textContent =
    permission === null
      ? 'Этот браузер не поддерживает системные уведомления.'
      : permission === 'granted'
        ? 'Разрешение браузера получено.'
        : permission === 'denied'
          ? 'Уведомления заблокированы в настройках браузера.'
          : 'Браузер ещё не запрашивал разрешение.';
}

async function initialize(): Promise<void> {
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    window.location.href = '/login';
    return;
  }

  const email = document.getElementById('account-email');

  if (email) {
    email.textContent = user.email ?? '';
  }

  const notificationsToggle = document.getElementById(
    'notifications-enabled'
  ) as HTMLInputElement | null;
  const soundToggle = document.getElementById(
    'sound-enabled'
  ) as HTMLInputElement | null;
  const settings = getNotificationSettings();

  if (notificationsToggle) {
    notificationsToggle.checked =
      settings.notificationsEnabled &&
      getNotificationPermission() === 'granted';
    notificationsToggle.disabled = !notificationsSupported();
    notificationsToggle.addEventListener('change', async () => {
      notificationsToggle.disabled = true;

      try {
        notificationsToggle.checked = await setNotificationsEnabled(
          notificationsToggle.checked
        );
        updatePermissionStatus();
      } finally {
        notificationsToggle.disabled = !notificationsSupported();
      }
    });
  }

  if (soundToggle) {
    soundToggle.checked = settings.soundEnabled;
    soundToggle.addEventListener('change', async () => {
      updateNotificationSettings({ soundEnabled: soundToggle.checked });

      if (soundToggle.checked) {
        await unlockTimerSound();
        await playTimerSound('focus-complete');
      }
    });
  }

  updatePermissionStatus();

  document.getElementById('btn-signout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('focus-tracker-active-session');
    window.location.href = '/login';
  });
}

void initialize();
