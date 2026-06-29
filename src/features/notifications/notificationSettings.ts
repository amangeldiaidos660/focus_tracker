export type NotificationSettings = {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
};

const settingsStorageKey = 'focus-tracker-notification-settings';
const defaultSettings: NotificationSettings = {
  notificationsEnabled: false,
  soundEnabled: false
};

export function getNotificationSettings(): NotificationSettings {
  const rawSettings = localStorage.getItem(settingsStorageKey);

  if (!rawSettings) {
    return { ...defaultSettings };
  }

  try {
    return {
      ...defaultSettings,
      ...(JSON.parse(rawSettings) as Partial<NotificationSettings>)
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function updateNotificationSettings(
  patch: Partial<NotificationSettings>
): NotificationSettings {
  const settings = {
    ...getNotificationSettings(),
    ...patch
  };

  localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  return settings;
}
