import { escapeHtml } from '../../shared/dom';
import { iconSvg, type IconName } from '../../shared/icons';
import { getTasks, groups } from '../../stores/focusStore';

const groupIcons: IconName[] = ['book', 'code', 'layers', 'chart'];

function getGroupIcon(index: number): IconName {
  return groupIcons[index % groupIcons.length];
}

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
      <div class="empty-state py-6">
        В этой группе пока нет ресурсов.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="resource-list">
      ${tasks
        .map((task, index) => {
          const startButton =
            task.status === 'active'
              ? `
                <button
                  data-action="start-task"
                  data-group-id="${groupId}"
                  data-task-id="${task.id}"
                  class="resource-play"
                  type="button"
                  aria-label="Начать фокус: ${escapeHtml(task.title)}"
                >
                  ${iconSvg('play')}
                </button>
              `
              : '<span></span>';
          const resourceIcon = index % 3 === 0 ? 'link' : index % 3 === 1 ? 'code' : 'book';

          return `
            <article class="resource-row ${task.status === 'archived' ? 'is-archived' : ''}">
              <span class="resource-icon">${iconSvg(resourceIcon)}</span>
              <div class="resource-main">
                <div class="resource-title">${escapeHtml(task.title)}</div>
                <a class="resource-url" href="${escapeHtml(task.url)}" target="_blank" rel="noreferrer">
                  ${escapeHtml(task.url)}
                </a>
              </div>
              ${startButton}
              <details class="action-menu">
                <summary aria-label="Действия с ресурсом">${iconSvg('more')}</summary>
                <div class="action-menu-popover">
                  <button data-action="toggle-task" data-group-id="${groupId}" data-task-id="${task.id}" type="button">
                    ${iconSvg('archive')}
                    ${task.status === 'active' ? 'Перенести в архив' : 'Вернуть из архива'}
                  </button>
                  <button class="danger-action" data-action="delete-task" data-group-id="${groupId}" data-task-id="${task.id}" type="button">
                    ${iconSvg('trash')}
                    Удалить ресурс
                  </button>
                </div>
              </details>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
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
    .map((group, index) => {
      const expanded = index === 0;

      return `
        <article class="group-card">
          <div class="group-heading">
            <button data-action="toggle-group" data-group-id="${group.id}" class="group-toggle" type="button">
              <span class="group-icon">${iconSvg(getGroupIcon(index))}</span>
              <span class="group-title">${escapeHtml(group.title)}</span>
              <span class="group-count">${getTasks(group.id).length}</span>
              <span data-chevron="${group.id}" class="group-chevron ${expanded ? 'rotate-90' : ''}">
                ${iconSvg('chevron-down')}
              </span>
            </button>
            <details class="action-menu">
              <summary aria-label="Действия с группой">${iconSvg('more')}</summary>
              <div class="action-menu-popover">
                <button class="danger-action" data-action="delete-group" data-group-id="${group.id}" type="button">
                  ${iconSvg('trash')}
                  Удалить группу
                </button>
              </div>
            </details>
          </div>

          <div data-group-content="${group.id}" class="group-content ${expanded ? '' : 'hidden'}">
            <div data-tasks="${group.id}"></div>
            <button data-action="add-task" data-group-id="${group.id}" class="add-resource" type="button">
              ${iconSvg('plus')}
              Добавить ресурс
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  groups.forEach((group) => {
    renderTasks(group.id);
  });
}
