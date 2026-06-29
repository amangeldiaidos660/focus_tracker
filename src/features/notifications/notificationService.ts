import {
  getNotificationSettings,
  updateNotificationSettings
} from './notificationSettings';
import { playTimerSound, type TimerSignal } from './sound';

type TimerAlertDetails = {
  taskTitle: string;
  breakDurationSeconds?: number;
};

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;

export function notificationsSupported(): boolean {
  return (
    window.isSecureContext &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

export function getNotificationPermission(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null;
}

export async function setNotificationsEnabled(
  enabled: boolean
): Promise<boolean> {
  if (!enabled) {
    updateNotificationSettings({ notificationsEnabled: false });
    return false;
  }

  if (!notificationsSupported() || Notification.permission === 'denied') {
    updateNotificationSettings({ notificationsEnabled: false });
    return false;
  }

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
  const notificationsEnabled = permission === 'granted';
  updateNotificationSettings({ notificationsEnabled });

  if (notificationsEnabled) {
    try {
      await getServiceWorkerRegistration();
    } catch (error) {
      console.error(error);
      registrationPromise = null;
      updateNotificationSettings({ notificationsEnabled: false });
      return false;
    }
  }

  return notificationsEnabled;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  registrationPromise ??= navigator.serviceWorker.register('/notification-sw.js');
  return registrationPromise;
}

async function showSystemNotification(
  signal: TimerSignal,
  details: TimerAlertDetails
): Promise<void> {
  const settings = getNotificationSettings();

  if (
    !settings.notificationsEnabled ||
    !notificationsSupported() ||
    Notification.permission !== 'granted'
  ) {
    return;
  }

  const registration = await getServiceWorkerRegistration();
  const breakMinutes = Math.ceil((details.breakDurationSeconds ?? 0) / 60);
  const content =
    signal === 'focus-complete'
      ? {
          title: 'Фокус завершён',
          body: `${details.taskTitle}: запланированное время выполнено.`
        }
      : signal === 'break-start'
        ? {
            title: 'Время отдохнуть',
            body: `Перерыв на ${breakMinutes} мин.`
          }
        : {
            title: 'Возвращаемся к фокусу',
            body: `${details.taskTitle}: перерыв завершён.`
          };

  await registration.showNotification(content.title, {
    body: content.body,
    tag: `focus-tracker-${signal}`,
    data: { url: '/' }
  });
}

export async function sendTimerAlert(
  signal: TimerSignal,
  details: TimerAlertDetails
): Promise<void> {
  await Promise.allSettled([
    playTimerSound(signal),
    showSystemNotification(signal, details)
  ]);
}
