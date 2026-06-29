import {
  sendTimerAlert
} from '../notifications/notificationService';
import { unlockTimerSound } from '../notifications/sound';
import { loadStatistics } from '../statistics/statistics';
import {
  createSession,
  fetchActiveSessions,
  fetchSessionStatus,
  finishSessionRecord,
  pauseSession,
  resumeSession
} from '../../services/sessionsService';
import { closeDialog, openDialog } from '../../shared/dialogs';
import { escapeHtml, getElement } from '../../shared/dom';
import { showNotice } from '../../shared/notice';
import { getTasks, getUserId, groups } from '../../stores/focusStore';
import type { TimerMode, TimerState } from '../../types/focus';
import {
  getTimerState,
  readStoredTimerState,
  removeStoredTimerState,
  saveTimerState,
  setTimerState
} from './timerState';
import { hideTimer, showTimer, updateTimerView } from './timerView';

let timerInterval: number | null = null;

function getSelectedMode(): TimerMode {
  const selected = document.querySelector<HTMLInputElement>(
    'input[name="session-mode"]:checked'
  );

  return selected?.value === 'stopwatch' ? 'stopwatch' : 'countdown';
}

function updateModeFields(): void {
  const isCountdown = getSelectedMode() === 'countdown';
  const durationFields = getElement('session-duration-fields');
  const durationInput = getElement<HTMLInputElement>('session-duration');

  durationFields.classList.toggle('hidden', !isCountdown);
  durationInput.required = isCountdown;
}

function populateSessionTasks(groupId: string, selectedTaskId?: string): void {
  const taskSelect = getElement<HTMLSelectElement>('session-task');
  const tasks = getTasks(groupId).filter((task) => task.status === 'active');

  taskSelect.innerHTML =
    '<option value="">Выберите задачу</option>' +
    tasks
      .map(
        (task) =>
          `<option value="${task.id}">${escapeHtml(task.title)}</option>`
      )
      .join('');

  if (selectedTaskId) {
    taskSelect.value = selectedTaskId;
  }
}

function populateSessionGroups(
  selectedGroupId?: string,
  selectedTaskId?: string
): void {
  const groupSelect = getElement<HTMLSelectElement>('session-group');
  const availableGroups = Array.from(groups.values()).filter((group) =>
    getTasks(group.id).some((task) => task.status === 'active')
  );

  groupSelect.innerHTML =
    '<option value="">Выберите группу</option>' +
    availableGroups
      .map(
        (group) =>
          `<option value="${group.id}">${escapeHtml(group.title)}</option>`
      )
      .join('');

  if (selectedGroupId) {
    groupSelect.value = selectedGroupId;
  }

  populateSessionTasks(selectedGroupId ?? '', selectedTaskId);
}

export function openSessionSetup(groupId: string, taskId: string): void {
  populateSessionGroups(groupId, taskId);
  updateModeFields();
  openDialog(getElement<HTMLDialogElement>('session-dialog'));
}

async function finishSession(status: 'completed' | 'cancelled'): Promise<void> {
  const timerState = getTimerState();

  if (!timerState) {
    return;
  }

  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
  }

  timerInterval = null;
  setTimerState(null);
  saveTimerState();

  const { error } = await finishSessionRecord(
    timerState.sessionId,
    status,
    timerState.focusSecondsElapsed,
    timerState.pauseCount
  );

  hideTimer();

  if (error) {
    console.error(error);
    showNotice('Не удалось сохранить завершение сессии.', 'error');
    return;
  }

  showNotice(
    status === 'completed'
      ? 'Фокус-сессия завершена.'
      : 'Фокус-сессия остановлена.'
  );
  await loadStatistics();
}

async function advanceTimer(): Promise<void> {
  const timerState = getTimerState();

  if (!timerState || timerState.status === 'paused') {
    return;
  }

  const now = Date.now();
  const elapsed = Math.max(
    1,
    Math.floor((now - timerState.lastTickAt) / 1000)
  );
  timerState.lastTickAt = now;

  if (timerState.phase === 'focus') {
    timerState.focusSecondsElapsed += elapsed;
    timerState.secondsLeft =
      timerState.mode === 'countdown'
        ? Math.max(
            0,
            timerState.durationSeconds - timerState.focusSecondsElapsed
          )
        : timerState.focusSecondsElapsed;

    if (
      timerState.mode === 'countdown' &&
      timerState.focusSecondsElapsed >= timerState.durationSeconds
    ) {
      void sendTimerAlert('focus-complete', {
        taskTitle: timerState.taskTitle
      });
      await finishSession('completed');
      return;
    }

    if (
      timerState.breakEnabled &&
      timerState.breakIntervalSeconds > 0 &&
      timerState.focusSecondsElapsed >= timerState.nextBreakAt
    ) {
      timerState.phase = 'break';
      timerState.secondsLeft = timerState.breakDurationSeconds;
      timerState.nextBreakAt += timerState.breakIntervalSeconds;
      void sendTimerAlert('break-start', {
        taskTitle: timerState.taskTitle,
        breakDurationSeconds: timerState.breakDurationSeconds
      });
    }
  } else {
    timerState.secondsLeft = Math.max(0, timerState.secondsLeft - elapsed);

    if (timerState.secondsLeft === 0) {
      timerState.phase = 'focus';
      timerState.secondsLeft =
        timerState.mode === 'countdown'
          ? timerState.durationSeconds - timerState.focusSecondsElapsed
          : timerState.focusSecondsElapsed;
      void sendTimerAlert('break-end', {
        taskTitle: timerState.taskTitle
      });
    }
  }

  saveTimerState();
  updateTimerView(timerState);
}

function startTimerLoop(): void {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
  }

  timerInterval = window.setInterval(() => {
    void advanceTimer();
  }, 1000);
}

async function startSession(): Promise<void> {
  void unlockTimerSound();

  const mode = getSelectedMode();
  const groupId = getElement<HTMLSelectElement>('session-group').value;
  const taskId = getElement<HTMLSelectElement>('session-task').value;
  const durationMinutes = Number(
    getElement<HTMLInputElement>('session-duration').value
  );
  const breakEnabled = getElement<HTMLInputElement>('break-enabled').checked;
  const breakIntervalMinutes = Number(
    getElement<HTMLInputElement>('break-interval').value
  );
  const breakDurationMinutes = Number(
    getElement<HTMLInputElement>('break-duration').value
  );
  const group = groups.get(groupId);
  const task = getTasks(groupId).find((item) => item.id === taskId);

  if (!group || !task || (mode === 'countdown' && durationMinutes < 1)) {
    showNotice('Выберите группу, задачу и длительность.', 'error');
    return;
  }

  if (
    breakEnabled &&
    (breakIntervalMinutes < 1 || breakDurationMinutes < 1)
  ) {
    showNotice('Проверьте настройки перерыва.', 'error');
    return;
  }

  const { data: activeSessions, error: activeError } =
    await fetchActiveSessions();

  if (activeError) {
    console.error(activeError);
    showNotice('Не удалось проверить активные сессии.', 'error');
    return;
  }

  if (activeSessions && activeSessions.length > 0) {
    showNotice('У вас уже есть активная сессия.', 'error');
    return;
  }

  const durationSeconds =
    mode === 'countdown' ? durationMinutes * 60 : 0;
  const { data, error } = await createSession({
    userId: getUserId(),
    groupId,
    taskId,
    mode,
    plannedDurationSeconds: mode === 'countdown' ? durationSeconds : null,
    breakEnabled,
    breakIntervalMinutes,
    breakDurationMinutes
  });

  if (error || !data) {
    console.error(error);
    showNotice('Не удалось создать фокус-сессию.', 'error');
    return;
  }

  const timerState: TimerState = {
    sessionId: data.id,
    mode,
    groupId,
    groupTitle: group.title,
    taskId,
    taskTitle: task.title,
    durationSeconds,
    focusSecondsElapsed: 0,
    secondsLeft: durationSeconds,
    status: 'active',
    phase: 'focus',
    breakEnabled,
    breakIntervalSeconds: breakEnabled ? breakIntervalMinutes * 60 : 0,
    breakDurationSeconds: breakEnabled ? breakDurationMinutes * 60 : 0,
    nextBreakAt: breakEnabled ? breakIntervalMinutes * 60 : 0,
    pauseCount: 0,
    lastTickAt: Date.now()
  };

  setTimerState(timerState);
  saveTimerState();
  closeDialog(getElement<HTMLDialogElement>('session-dialog'));
  showTimer(timerState);
  startTimerLoop();
}

export async function restoreTimer(): Promise<void> {
  let storedState: TimerState | null;

  try {
    storedState = readStoredTimerState();
  } catch (error) {
    console.error(error);
    removeStoredTimerState();
    return;
  }

  if (!storedState) {
    return;
  }

  try {
    const { data, error } = await fetchSessionStatus(storedState.sessionId);

    if (error || !data || !['active', 'paused'].includes(data.status)) {
      removeStoredTimerState();
      return;
    }

    const timerState: TimerState = {
      ...storedState,
      mode: storedState.mode ?? 'countdown',
      status: data.status as 'active' | 'paused'
    };
    setTimerState(timerState);

    if (timerState.status === 'active') {
      await advanceTimer();
    } else {
      timerState.lastTickAt = Date.now();
    }

    const currentState = getTimerState();

    if (!currentState) {
      return;
    }

    saveTimerState();
    showTimer(currentState);
    startTimerLoop();
  } catch (error) {
    console.error(error);
    removeStoredTimerState();
  }
}

export function initializeTimer(): void {
  getElement('open-session').addEventListener('click', () => {
    if (groups.size === 0) {
      showNotice('Сначала создайте фокус-группу и задачу.', 'error');
      return;
    }

    populateSessionGroups();

    if (getElement<HTMLSelectElement>('session-group').options.length <= 1) {
      showNotice('Сначала добавьте активную задачу.', 'error');
      return;
    }

    updateModeFields();
    openDialog(getElement<HTMLDialogElement>('session-dialog'));
  });

  document
    .querySelectorAll<HTMLInputElement>('input[name="session-mode"]')
    .forEach((input) => {
      input.addEventListener('change', updateModeFields);
    });

  document.querySelectorAll<HTMLButtonElement>('[data-duration]').forEach(
    (button) => {
      button.addEventListener('click', () => {
        getElement<HTMLInputElement>('session-duration').value =
          button.dataset.duration ?? '25';
      });
    }
  );

  getElement<HTMLSelectElement>('session-group').addEventListener(
    'change',
    (event) => {
      populateSessionTasks((event.target as HTMLSelectElement).value);
    }
  );

  getElement<HTMLInputElement>('break-enabled').addEventListener(
    'change',
    (event) => {
      const enabled = (event.target as HTMLInputElement).checked;
      const fields = getElement('break-fields');
      fields.classList.toggle('hidden', !enabled);
      fields.classList.toggle('grid', enabled);
    }
  );

  getElement<HTMLFormElement>('session-form').addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      void startSession();
    }
  );

  getElement('timer-pause').addEventListener('click', async () => {
    const timerState = getTimerState();

    if (!timerState) {
      return;
    }

    timerState.status = 'paused';
    timerState.pauseCount += 1;
    timerState.lastTickAt = Date.now();
    saveTimerState();
    updateTimerView(timerState);

    const { error } = await pauseSession(
      timerState.sessionId,
      timerState.pauseCount
    );

    if (error) {
      console.error(error);
      showNotice('Не удалось сохранить паузу.', 'error');
    }
  });

  getElement('timer-resume').addEventListener('click', async () => {
    const timerState = getTimerState();

    if (!timerState) {
      return;
    }

    timerState.status = 'active';
    timerState.lastTickAt = Date.now();
    saveTimerState();
    updateTimerView(timerState);

    const { error } = await resumeSession(timerState.sessionId);

    if (error) {
      console.error(error);
      showNotice('Не удалось продолжить сессию.', 'error');
    }
  });

  getElement('timer-stop').addEventListener('click', () => {
    const timerState = getTimerState();

    if (
      timerState &&
      window.confirm('Остановить текущую фокус-сессию?')
    ) {
      void finishSession(
        timerState.mode === 'stopwatch' ? 'completed' : 'cancelled'
      );
    }
  });
}
