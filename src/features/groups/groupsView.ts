import { escapeHtml } from '../../shared/dom';
import { getTasks, groups } from '../../stores/focusStore';

export function renderTasks(groupId: string): void {
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

export function renderGroups(): void {
  const groupsLoading = document.getElementById('groups-loading');
  const groupsEmpty = document.getElementById('groups-empty');
  const groupsList = document.getElementById('groups-list');

  if (!groupsLoading || !groupsEmpty || !groupsList) {
    return;
  }

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
