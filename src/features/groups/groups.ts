import {
  createGroup,
  deleteGroup,
  fetchGroups
} from '../../services/groupsService';
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTaskStatus
} from '../../services/tasksService';
import { closeDialog, openDialog } from '../../shared/dialogs';
import { getElement } from '../../shared/dom';
import { showNotice } from '../../shared/notice';
import {
  getTasks,
  getUserId,
  groups,
  tasksByGroup
} from '../../stores/focusStore';
import type { FocusGroup, FocusTask } from '../../types/focus';
import { renderGroups } from './groupsView';

type OpenSession = (groupId: string, taskId: string) => void;

export async function loadGroupsAndTasks(): Promise<void> {
  const { data: groupRows, error: groupError } = await fetchGroups();

  if (groupError) {
    throw groupError;
  }

  groups.clear();

  for (const group of (groupRows ?? []) as FocusGroup[]) {
    groups.set(group.id, group);
  }

  tasksByGroup.clear();

  if (groups.size > 0) {
    const { data: taskRows, error: taskError } = await fetchTasks();

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

export function initializeGroups(openSession: OpenSession): void {
  const groupDialog = getElement<HTMLDialogElement>('group-dialog');
  const taskDialog = getElement<HTMLDialogElement>('task-dialog');
  const groupsList = getElement<HTMLElement>('groups-list');

  getElement('open-group-form').addEventListener('click', () => {
    getElement<HTMLFormElement>('group-form').reset();
    openDialog(groupDialog);
  });

  getElement<HTMLFormElement>('group-form').addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();
      const title = getElement<HTMLInputElement>('group-title').value.trim();

      if (!title) {
        return;
      }

      const { data, error } = await createGroup(getUserId(), title);

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
      const groupId = getElement<HTMLInputElement>('task-group-id').value;
      const title = getElement<HTMLInputElement>('task-title').value.trim();
      const url = getElement<HTMLInputElement>('task-url').value.trim();
      const description = getElement<HTMLTextAreaElement>(
        'task-description'
      ).value.trim();
      const { data, error } = await createTask({
        userId: getUserId(),
        groupId,
        title,
        url,
        description: description || null
      });

      if (error || !data) {
        console.error(error);
        showNotice('Не удалось создать ресурс.', 'error');
        return;
      }

      tasksByGroup.set(groupId, [data as FocusTask, ...getTasks(groupId)]);
      renderGroups();
      closeDialog(taskDialog);
      showNotice('Ресурс добавлен.');
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
      document
        .querySelector<HTMLElement>(`[data-group-content="${groupId}"]`)
        ?.classList.toggle('hidden');
      document
        .querySelector<HTMLElement>(`[data-chevron="${groupId}"]`)
        ?.classList.toggle('rotate-90');
      return;
    }

    if (action === 'add-task') {
      getElement<HTMLFormElement>('task-form').reset();
      getElement<HTMLInputElement>('task-group-id').value = groupId;
      getElement('task-group-name').textContent =
        groups.get(groupId)?.title ?? '';
      openDialog(taskDialog);
      return;
    }

    if (action === 'start-task') {
      openSession(groupId, taskId);
      return;
    }

    if (action === 'delete-group') {
      if (!window.confirm('Удалить группу и все связанные с ней ресурсы?')) {
        return;
      }

      const { error } = await deleteGroup(groupId);

      if (error) {
        console.error(error);
        showNotice('Не удалось удалить группу.', 'error');
        return;
      }

      groups.delete(groupId);
      tasksByGroup.delete(groupId);
      renderGroups();
      showNotice('Группа удалена.');
      return;
    }

    const task = getTasks(groupId).find((item) => item.id === taskId);

    if (!task) {
      return;
    }

    if (action === 'toggle-task') {
      const nextStatus = task.status === 'active' ? 'archived' : 'active';
      const { error } = await updateTaskStatus(taskId, nextStatus);

      if (error) {
        console.error(error);
        showNotice('Не удалось изменить статус ресурса.', 'error');
        return;
      }

      task.status = nextStatus;
      renderGroups();
      showNotice(
        nextStatus === 'archived'
          ? 'Ресурс перенесён в архив.'
          : 'Ресурс снова активен.'
      );
      return;
    }

    if (action === 'delete-task') {
      if (!window.confirm('Удалить ресурс?')) {
        return;
      }

      const { error } = await deleteTask(taskId);

      if (error) {
        console.error(error);
        showNotice('Не удалось удалить ресурс.', 'error');
        return;
      }

      tasksByGroup.set(
        groupId,
        getTasks(groupId).filter((item) => item.id !== taskId)
      );
      renderGroups();
      showNotice('Ресурс удалён.');
    }
  });
}
