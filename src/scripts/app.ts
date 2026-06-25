import { supabaseClient } from '../lib/supabaseClient';
import { ensureProfile } from '../lib/ensureProfile';

type FocusGroup = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

type FocusTask = {
  id: string;
  user_id: string;
  focus_group_id: string;
  title: string;
  url: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
};

type FocusSession = {
  id: string;
  started_at: string;
  duration_seconds: number | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
};

type TimerState = {
  sessionId: string;
  groupId: string;
  groupTitle: string;
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  focusSecondsElapsed: number;
  secondsLeft: number;
  status: 'active' | 'paused';
  phase: 'focus' | 'break';
  breakEnabled: boolean;
  breakIntervalSeconds: number;
  breakDurationSeconds: number;
  nextBreakAt: number;
  pauseCount: number;
  lastTickAt: number;
};

const timerStorageKey = 'focus-tracker-active-session';

const groups = new Map<string, FocusGroup>();
const tasksByGroup = new Map<string, FocusTask[]>();

let userId = '';
let timerState: TimerState | null = null;
let timerInterval: number | null = null;

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Element #${id} not found`);
  }

  return element as T;
}

const app = getElement<HTMLElement>('app');
const groupsLoading = getElement<HTMLElement>('groups-loading');
const groupsEmpty = getElement<HTMLElement>('groups-empty');
const groupsList = getElement<HTMLElement>('groups-list');
const groupDialog = getElement<HTMLDialogElement>('group-dialog');
const taskDialog = getElement<HTMLDialogElement>('task-dialog');
const sessionDialog = getElement<HTMLDialogElement>('session-dialog');
const timerOverlay = getElement<HTMLElement>('timer-overlay');
const notice = getElement<HTMLElement>('notice');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showNotice(
  message: string,
  type: 'success' | 'error' = 'success'
): void {
  notice.textContent = message;

  notice.className =
    'pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-3 text-sm text-white shadow-xl ' +
    (type === 'success' ? 'bg-emerald-600' : 'bg-red-600');

  window.setTimeout(() => {
    notice.classList.add('hidden');
  }, 3500);
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
}

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
}

function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) {
    dialog.close();
  }
}

function getTasks(groupId: string): FocusTask[] {
  return tasksByGroup.get(groupId) ?? [];
}

function renderTasks(groupId: string): void {
  const container = document.querySelector<HTMLElement>(
    `[data-tasks="${groupId}"]`
  );

  if (!container) {
    return;
  }

  const tasks = getTasks(groupId);

  if (tasks.length === 0) {
    container.innerHTML = `
      <p class="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-500">
        В этой группе пока нет задач.
      </p>
    `;
    return;
  }

  container.innerHTML = tasks
    .map((task) => {
      const description = task.description
        ? `<p class="mt-2 text-sm text-slate-400">${escapeHtml(
            task.description
          )}</p>`
        : '';

      const archiveLabel =
        task.status === 'archived'
          ? '<span class="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">Архив</span>'
          : '';

      const startButton =
        task.status === 'active'
          ? `
            <button
              data-action="start-task"
              data-group-id="${groupId}"
              data-task-id="${task.id}"
              class="rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium hover:bg-blue-400"
            >
              Начать фокус
            </button>
          `
          : '';

      return `
        <article class="flex flex-col justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="font-medium">${escapeHtml(task.title)}</h4>
              ${archiveLabel}
            </div>

            <a
              class="mt-1 block truncate text-sm text-blue-400 hover:text-blue-300"
              href="${escapeHtml(task.url)}"
              target="_blank"
              rel="noreferrer"
            >
              ${escapeHtml(task.url)}
            </a>

            ${description}
          </div>

          <div class="flex shrink-0 flex-wrap gap-2">
            ${startButton}

            <button
              data-action="toggle-task"
              data-group-id="${groupId}"
              data-task-id="${task.id}"
              class="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
            >
              ${task.status === 'active' ? 'В архив' : 'Вернуть'}
            </button>

            <button
              data-action="delete-task"
              data-group-id="${groupId}"
              data-task-id="${task.id}"
              class="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:border-red-700"
            >
              Удалить
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderGroups(): void {
  groupsLoading.classList.add('hidden');
  groupsEmpty.classList.toggle('hidden', groups.size > 0);

  groupsList.innerHTML = Array.from(groups.values())
    .map((group) => {
      return `
        <article class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div class="flex flex-wrap items-center justify-between gap-3 p-4">
            <button
              data-action="toggle-group"
              data-group-id="${group.id}"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span
                data-chevron="${group.id}"
                class="text-slate-500 transition-transform"
              >
                ›
              </span>

              <span class="truncate font-semibold">
                ${escapeHtml(group.title)}
              </span>

              <span class="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                ${getTasks(group.id).length}
              </span>
            </button>

            <div class="flex gap-2">
              <button
                data-action="add-task"
                data-group-id="${group.id}"
                class="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-slate-500"
              >
                Добавить задачу
              </button>

              <button
                data-action="delete-group"
                data-group-id="${group.id}"
                class="rounded-lg border border-red-900 px-3 py-2 text-sm text-red-400 hover:border-red-700"
              >
                Удалить
              </button>
            </div>
          </div>

          <div
            data-group-content="${group.id}"
            class="hidden border-t border-slate-800 p-4"
          >
            <div data-tasks="${group.id}" class="space-y-3"></div>
          </div>
        </article>
      `;
    })
    .join('');

  groups.forEach((group) => {
    renderTasks(group.id);
  });
}

async function loadGroupsAndTasks(): Promise<void> {
  const { data: groupRows, error: groupError } = await supabaseClient
    .from('focus_groups')
    .select('id,user_id,title,created_at')
    .order('created_at', { ascending: false });

  if (groupError) {
    throw groupError;
  }

  groups.clear();

  for (const group of (groupRows ?? []) as FocusGroup[]) {
    groups.set(group.id, group);
  }

  tasksByGroup.clear();

  if (groups.size > 0) {
    const { data: taskRows, error: taskError } = await supabaseClient
      .from('focus_tasks')
      .select(
        'id,user_id,focus_group_id,title,url,description,status,created_at'
      )
      .order('created_at', { ascending: false });

    if (taskError) {
      throw taskError;
    }

    for (const task of (taskRows ?? []) as FocusTask[]) {
      const tasks = tasksByGroup.get(task.focus_group_id) ?? [];
      tasks.push(task);
      tasksByGroup.set(task.focus_group_id, tasks);
    }
  }

  renderGroups();
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

function populateSessionTasks(
  groupId: string,
  selectedTaskId?: string
): void {
  const taskSelect = getElement<HTMLSelectElement>('session-task');

  const tasks = getTasks(groupId).filter(
    (task) => task.status === 'active'
  );

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

async function loadStatistics(): Promise<void> {
  const { data, error } = await supabaseClient
    .from('focus_sessions')
    .select('id,started_at,duration_seconds,status')
    .in('status', ['completed', 'cancelled'])
    .not('duration_seconds', 'is', null)
    .order('started_at', { ascending: false });

  if (error) {
    throw error;
  }

  const sessions = (data ?? []) as FocusSession[];
  const now = new Date();

  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const weekDay = (now.getDay() + 6) % 7;

  const startWeek = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - weekDay
  );

  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  function sumAfter(start: Date): number {
    return sessions.reduce((sum, session) => {
      if (new Date(session.started_at) >= start) {
        return sum + (session.duration_seconds ?? 0);
      }

      return sum;
    }, 0);
  }

  getElement('stat-today').textContent = formatDuration(
    sumAfter(startToday)
  );

  getElement('stat-week').textContent = formatDuration(
    sumAfter(startWeek)
  );

  getElement('stat-month').textContent = formatDuration(
    sumAfter(startMonth)
  );

  getElement('stat-total').textContent = formatDuration(
    sessions.reduce(
      (sum, session) => sum + (session.duration_seconds ?? 0),
      0
    )
  );

  const byDay = new Map<string, number>();

  for (const session of sessions) {
    const day = new Date(session.started_at).toLocaleDateString('ru-RU');

    byDay.set(
      day,
      (byDay.get(day) ?? 0) + (session.duration_seconds ?? 0)
    );
  }

  const historyTable =
    getElement<HTMLTableElement>('history-table');

  const historyEmpty = getElement('history-empty');

  historyTable.classList.toggle('hidden', byDay.size === 0);
  historyEmpty.classList.toggle('hidden', byDay.size > 0);

  getElement('history-body').innerHTML = Array.from(byDay.entries())
    .map(([day, seconds]) => {
      return `
        <tr>
          <td class="px-4 py-3 text-slate-300">${day}</td>
          <td class="px-4 py-3 text-right font-medium">
            ${formatDuration(seconds)}
          </td>
        </tr>
      `;
    })
    .join('');
}

function saveTimerState(): void {
  if (timerState) {
    localStorage.setItem(timerStorageKey, JSON.stringify(timerState));
  } else {
    localStorage.removeItem(timerStorageKey);
  }
}

function updateTimerView(): void {
  if (!timerState) {
    return;
  }

  getElement('timer-mode').textContent =
    timerState.phase === 'focus' ? 'Фокус' : 'Перерыв';

  getElement('timer-task-title').textContent =
    timerState.taskTitle;

  getElement('timer-group-title').textContent =
    timerState.groupTitle;

  getElement('timer-clock').textContent =
    formatClock(timerState.secondsLeft);

  getElement('timer-message').textContent =
    timerState.phase === 'focus'
      ? `Сфокусировано: ${formatDuration(
          timerState.focusSecondsElapsed
        )}`
      : 'После перерыва фокус продолжится автоматически.';

  getElement('timer-pause').classList.toggle(
    'hidden',
    timerState.status === 'paused'
  );

  getElement('timer-resume').classList.toggle(
    'hidden',
    timerState.status !== 'paused'
  );
}

function showTimer(): void {
  app.setAttribute('inert', '');
  timerOverlay.classList.remove('hidden');
  timerOverlay.classList.add('flex');
  document.body.classList.add('overflow-hidden');
  updateTimerView();
}

function hideTimer(): void {
  app.removeAttribute('inert');
  timerOverlay.classList.add('hidden');
  timerOverlay.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}

async function finishSession(
  status: 'completed' | 'cancelled'
): Promise<void> {
  if (!timerState) {
    return;
  }

  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
  }

  timerInterval = null;

  const finishedState = timerState;

  timerState = null;
  saveTimerState();

  const { error } = await supabaseClient
    .from('focus_sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: finishedState.focusSecondsElapsed,
      status,
      pause_count: finishedState.pauseCount
    })
    .eq('id', finishedState.sessionId);

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

    timerState.secondsLeft = Math.max(
      0,
      timerState.durationSeconds - timerState.focusSecondsElapsed
    );

    if (
      timerState.focusSecondsElapsed >= timerState.durationSeconds
    ) {
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
    }
  } else {
    timerState.secondsLeft = Math.max(
      0,
      timerState.secondsLeft - elapsed
    );

    if (timerState.secondsLeft === 0) {
      timerState.phase = 'focus';

      timerState.secondsLeft =
        timerState.durationSeconds -
        timerState.focusSecondsElapsed;
    }
  }

  saveTimerState();
  updateTimerView();
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
  const groupId =
    getElement<HTMLSelectElement>('session-group').value;

  const taskId =
    getElement<HTMLSelectElement>('session-task').value;

  const durationMinutes = Number(
    getElement<HTMLInputElement>('session-duration').value
  );

  const breakEnabled =
    getElement<HTMLInputElement>('break-enabled').checked;

  const breakIntervalMinutes = Number(
    getElement<HTMLInputElement>('break-interval').value
  );

  const breakDurationMinutes = Number(
    getElement<HTMLInputElement>('break-duration').value
  );

  const group = groups.get(groupId);

  const task = getTasks(groupId).find(
    (item) => item.id === taskId
  );

  if (!group || !task || durationMinutes < 1) {
    showNotice(
      'Выберите группу, задачу и длительность.',
      'error'
    );
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
    await supabaseClient
      .from('focus_sessions')
      .select('id')
      .in('status', ['active', 'paused'])
      .limit(1);

  if (activeError) {
    console.error(activeError);
    showNotice(
      'Не удалось проверить активные сессии.',
      'error'
    );
    return;
  }

  if (activeSessions && activeSessions.length > 0) {
    showNotice(
      'У вас уже есть активная сессия.',
      'error'
    );
    return;
  }

  const { data, error } = await supabaseClient
    .from('focus_sessions')
    .insert({
      user_id: userId,
      focus_group_id: groupId,
      focus_task_id: taskId,
      started_at: new Date().toISOString(),
      status: 'active',
      break_enabled: breakEnabled,
      break_interval_minutes: breakEnabled
        ? breakIntervalMinutes
        : null,
      break_duration_minutes: breakEnabled
        ? breakDurationMinutes
        : null,
      pause_count: 0
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error(error);
    showNotice(
      'Не удалось создать фокус-сессию.',
      'error'
    );
    return;
  }

  timerState = {
    sessionId: data.id,
    groupId,
    groupTitle: group.title,
    taskId,
    taskTitle: task.title,
    durationSeconds: durationMinutes * 60,
    focusSecondsElapsed: 0,
    secondsLeft: durationMinutes * 60,
    status: 'active',
    phase: 'focus',
    breakEnabled,
    breakIntervalSeconds: breakEnabled
      ? breakIntervalMinutes * 60
      : 0,
    breakDurationSeconds: breakEnabled
      ? breakDurationMinutes * 60
      : 0,
    nextBreakAt: breakEnabled
      ? breakIntervalMinutes * 60
      : 0,
    pauseCount: 0,
    lastTickAt: Date.now()
  };

  saveTimerState();
  closeDialog(sessionDialog);
  showTimer();
  startTimerLoop();
}

async function restoreTimer(): Promise<void> {
  const rawState = localStorage.getItem(timerStorageKey);

  if (!rawState) {
    return;
  }

  try {
    const storedState = JSON.parse(rawState) as TimerState;

    const { data, error } = await supabaseClient
      .from('focus_sessions')
      .select('id,status')
      .eq('id', storedState.sessionId)
      .single();

    if (
      error ||
      !data ||
      !['active', 'paused'].includes(data.status)
    ) {
      localStorage.removeItem(timerStorageKey);
      return;
    }

    timerState = {
      ...storedState,
      status: data.status as 'active' | 'paused'
    };

    if (timerState.status === 'active') {
      await advanceTimer();
    } else {
      timerState.lastTickAt = Date.now();
    }

    if (!timerState) {
      return;
    }

    saveTimerState();
    showTimer();
    startTimerLoop();
  } catch (error) {
    console.error(error);
    localStorage.removeItem(timerStorageKey);
  }
}

document
  .querySelectorAll<HTMLElement>('[data-close-dialog]')
  .forEach((button) => {
    button.addEventListener('click', () => {
      const dialogId = button.dataset.closeDialog;

      if (dialogId) {
        closeDialog(getElement<HTMLDialogElement>(dialogId));
      }
    });
  });

getElement('open-group-form').addEventListener('click', () => {
  getElement<HTMLFormElement>('group-form').reset();
  openDialog(groupDialog);
});

getElement('open-session').addEventListener('click', () => {
  if (groups.size === 0) {
    showNotice(
      'Сначала создайте фокус-группу и задачу.',
      'error'
    );
    return;
  }

  populateSessionGroups();

  const groupSelect =
    getElement<HTMLSelectElement>('session-group');

  if (groupSelect.options.length <= 1) {
    showNotice(
      'Сначала добавьте активную задачу.',
      'error'
    );
    return;
  }

  openDialog(sessionDialog);
});

getElement<HTMLSelectElement>('session-group').addEventListener(
  'change',
  (event) => {
    populateSessionTasks(
      (event.target as HTMLSelectElement).value
    );
  }
);

getElement<HTMLInputElement>('break-enabled').addEventListener(
  'change',
  (event) => {
    const enabled =
      (event.target as HTMLInputElement).checked;

    const fields = getElement('break-fields');

    fields.classList.toggle('hidden', !enabled);
    fields.classList.toggle('grid', enabled);
  }
);

getElement<HTMLFormElement>('group-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    const title =
      getElement<HTMLInputElement>('group-title').value.trim();

    if (!title) {
      return;
    }

    const { data, error } = await supabaseClient
      .from('focus_groups')
      .insert({
        user_id: userId,
        title
      })
      .select('id,user_id,title,created_at')
      .single();

    if (error || !data) {
      console.error(error);
      showNotice('Не удалось создать группу.', 'error');
      return;
    }

    groups.set(data.id, data as FocusGroup);
    tasksByGroup.set(data.id, []);

    renderGroups();
    closeDialog(groupDialog);
    showNotice('Фокус-группа создана.');
  }
);

getElement<HTMLFormElement>('task-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    const groupId =
      getElement<HTMLInputElement>('task-group-id').value;

    const title =
      getElement<HTMLInputElement>('task-title').value.trim();

    const url =
      getElement<HTMLInputElement>('task-url').value.trim();

    const description =
      getElement<HTMLTextAreaElement>(
        'task-description'
      ).value.trim();

    const { data, error } = await supabaseClient
      .from('focus_tasks')
      .insert({
        user_id: userId,
        focus_group_id: groupId,
        title,
        url,
        description: description || null,
        status: 'active'
      })
      .select(
        'id,user_id,focus_group_id,title,url,description,status,created_at'
      )
      .single();

    if (error || !data) {
      console.error(error);
      showNotice('Не удалось создать задачу.', 'error');
      return;
    }

    tasksByGroup.set(groupId, [
      data as FocusTask,
      ...getTasks(groupId)
    ]);

    renderGroups();
    closeDialog(taskDialog);
    showNotice('Задача создана.');
  }
);

getElement<HTMLFormElement>('session-form').addEventListener(
  'submit',
  (event) => {
    event.preventDefault();
    void startSession();
  }
);

groupsList.addEventListener('click', async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    '[data-action]'
  );

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const groupId = button.dataset.groupId ?? '';
  const taskId = button.dataset.taskId ?? '';

  if (action === 'toggle-group') {
    const content = document.querySelector<HTMLElement>(
      `[data-group-content="${groupId}"]`
    );

    const chevron = document.querySelector<HTMLElement>(
      `[data-chevron="${groupId}"]`
    );

    content?.classList.toggle('hidden');
    chevron?.classList.toggle('rotate-90');
    return;
  }

  if (action === 'add-task') {
    getElement<HTMLFormElement>('task-form').reset();

    getElement<HTMLInputElement>('task-group-id').value =
      groupId;

    openDialog(taskDialog);
    return;
  }

  if (action === 'start-task') {
    populateSessionGroups(groupId, taskId);
    openDialog(sessionDialog);
    return;
  }

  if (action === 'delete-group') {
    if (
      !window.confirm(
        'Удалить группу и все связанные с ней задачи?'
      )
    ) {
      return;
    }

    const { error } = await supabaseClient
      .from('focus_groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error(error);
      showNotice(
        'Не удалось удалить группу. Возможно, с ней связаны задачи или сессии.',
        'error'
      );
      return;
    }

    groups.delete(groupId);
    tasksByGroup.delete(groupId);

    renderGroups();
    showNotice('Группа удалена.');
    return;
  }

  const task = getTasks(groupId).find(
    (item) => item.id === taskId
  );

  if (!task) {
    return;
  }

  if (action === 'toggle-task') {
    const nextStatus =
      task.status === 'active' ? 'archived' : 'active';

    const { error } = await supabaseClient
      .from('focus_tasks')
      .update({
        status: nextStatus
      })
      .eq('id', taskId);

    if (error) {
      console.error(error);
      showNotice(
        'Не удалось изменить статус задачи.',
        'error'
      );
      return;
    }

    task.status = nextStatus;
    renderGroups();

    showNotice(
      nextStatus === 'archived'
        ? 'Задача перенесена в архив.'
        : 'Задача снова активна.'
    );

    return;
  }

  if (action === 'delete-task') {
    if (!window.confirm('Удалить задачу?')) {
      return;
    }

    const { error } = await supabaseClient
      .from('focus_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error(error);
      showNotice(
        'Не удалось удалить задачу. Возможно, с ней связаны сессии.',
        'error'
      );
      return;
    }

    tasksByGroup.set(
      groupId,
      getTasks(groupId).filter(
        (item) => item.id !== taskId
      )
    );

    renderGroups();
    showNotice('Задача удалена.');
  }
});

getElement('timer-pause').addEventListener(
  'click',
  async () => {
    if (!timerState) {
      return;
    }

    timerState.status = 'paused';
    timerState.pauseCount += 1;
    timerState.lastTickAt = Date.now();

    saveTimerState();
    updateTimerView();

    const { error } = await supabaseClient
      .from('focus_sessions')
      .update({
        status: 'paused',
        pause_count: timerState.pauseCount
      })
      .eq('id', timerState.sessionId);

    if (error) {
      console.error(error);
      showNotice('Не удалось сохранить паузу.', 'error');
    }
  }
);

getElement('timer-resume').addEventListener(
  'click',
  async () => {
    if (!timerState) {
      return;
    }

    timerState.status = 'active';
    timerState.lastTickAt = Date.now();

    saveTimerState();
    updateTimerView();

    const { error } = await supabaseClient
      .from('focus_sessions')
      .update({
        status: 'active'
      })
      .eq('id', timerState.sessionId);

    if (error) {
      console.error(error);
      showNotice(
        'Не удалось продолжить сессию.',
        'error'
      );
    }
  }
);

getElement('timer-stop').addEventListener('click', () => {
  if (
    window.confirm(
      'Остановить текущую фокус-сессию?'
    )
  ) {
    void finishSession('cancelled');
  }
});

async function initialize(): Promise<void> {
  const { data, error } =
    await supabaseClient.auth.getSession();

  const user = data.session?.user;

  if (error || !user) {
    window.location.href = '/login';
    return;
  }

  userId = user.id;

  getElement('user-name').textContent =
    user.user_metadata?.full_name ??
    user.email ??
    '';

  await ensureProfile();

  try {
    await Promise.all([
      loadGroupsAndTasks(),
      loadStatistics()
    ]);

    await restoreTimer();
  } catch (loadError) {
    console.error(loadError);

    groupsLoading.textContent =
      'Не удалось загрузить данные.';

    showNotice(
      'Ошибка загрузки данных из Supabase.',
      'error'
    );
  }
}

void initialize();