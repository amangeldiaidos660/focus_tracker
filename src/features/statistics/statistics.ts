import { fetchFinishedSessions } from '../../services/sessionsService';
import { getElement } from '../../shared/dom';
import { formatDuration } from '../../shared/formatters';
import type { FocusSession } from '../../types/focus';

export async function loadStatistics(): Promise<void> {
  const { data, error } = await fetchFinishedSessions();

  if (error) {
    throw error;
  }

  const sessions = (data ?? []) as FocusSession[];
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

  getElement('stat-today').textContent = formatDuration(sumAfter(startToday));
  getElement('stat-week').textContent = formatDuration(sumAfter(startWeek));
  getElement('stat-month').textContent = formatDuration(sumAfter(startMonth));
  getElement('stat-total').textContent = formatDuration(
    sessions.reduce(
      (sum, session) => sum + (session.duration_seconds ?? 0),
      0
    )
  );

  const byDay = new Map<string, number>();

  for (const session of sessions) {
    const day = new Date(session.started_at).toLocaleDateString('ru-RU');
    byDay.set(day, (byDay.get(day) ?? 0) + (session.duration_seconds ?? 0));
  }

  const historyTable = getElement<HTMLTableElement>('history-table');
  const historyEmpty = getElement('history-empty');
  historyTable.classList.toggle('hidden', byDay.size === 0);
  historyEmpty.classList.toggle('hidden', byDay.size > 0);

  getElement('history-body').innerHTML = Array.from(byDay.entries())
    .map(
      ([day, seconds]) => `
        <tr>
          <td class="px-4 py-3 text-slate-300">${day}</td>
          <td class="px-4 py-3 text-right font-medium">
            ${formatDuration(seconds)}
          </td>
        </tr>
      `
    )
    .join('');
}
