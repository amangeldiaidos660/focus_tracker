import { fetchFinishedSessions } from '../../services/sessionsService';
import { escapeHtml, getElement } from '../../shared/dom';
import { formatDuration } from '../../shared/formatters';
import { groups } from '../../stores/focusStore';
import type { FocusSession } from '../../types/focus';

type Period = 'week' | 'month';

const chartColors = ['#3f9cff', '#8b5cf6', '#f5c84c', '#22c55e', '#f97316'];
const weekDayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

let sessions: FocusSession[] = [];
let selectedPeriod: Period = 'week';
let periodBound = false;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sumBetween(start: Date, end: Date): number {
  return sessions.reduce((total, session) => {
    const date = new Date(session.started_at);

    return date >= start && date < end
      ? total + (session.duration_seconds ?? 0)
      : total;
  }, 0);
}

function getPeriodRange(now: Date): {
  start: Date;
  end: Date;
  previousStart: Date;
} {
  const end = new Date(now.getTime() + 1);

  if (selectedPeriod === 'week') {
    const start = startOfWeek(now);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 7);
    return { start, end, previousStart };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start, end, previousStart };
}

function renderSummary(now: Date): void {
  const { start, end, previousStart } = getPeriodRange(now);
  const currentTotal = sumBetween(start, end);
  const previousTotal = sumBetween(previousStart, start);
  const changeElement = getElement('stat-period-change');

  getElement('stat-period-total').textContent = formatDuration(currentTotal);

  if (previousTotal === 0) {
    changeElement.textContent = 'Нет данных за прошлый период';
    changeElement.classList.remove('is-positive');
  } else {
    const percent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
    changeElement.textContent = `${percent >= 0 ? '+' : ''}${percent}% к прошлому периоду`;
    changeElement.classList.toggle('is-positive', percent >= 0);
  }

  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayTotal = sumBetween(today, tomorrow);
  const yesterdayTotal = sumBetween(yesterday, today);

  getElement('dashboard-today-time').textContent = formatDuration(todayTotal);
  getElement('dashboard-today-change').textContent =
    yesterdayTotal > 0
      ? `${todayTotal >= yesterdayTotal ? '+' : ''}${Math.round(
          ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
        )}% ко вчерашнему дню`
      : todayTotal > 0
        ? 'Хорошее начало — продолжайте в том же ритме.'
        : 'Выберите ресурс и настройте новую фокус-сессию.';
}

function getDailyTotals(): Map<string, number> {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    const key = getDateKey(new Date(session.started_at));
    totals.set(key, (totals.get(key) ?? 0) + (session.duration_seconds ?? 0));
  }

  return totals;
}

function renderBars(now: Date, dailyTotals: Map<string, number>): void {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = startOfDay(now);
    date.setDate(date.getDate() - (6 - index));
    return {
      date,
      seconds: dailyTotals.get(getDateKey(date)) ?? 0
    };
  });
  const maxValue = Math.max(...days.map((day) => day.seconds), 1);

  getElement('weekly-bars').innerHTML = days
    .map((day) => {
      const height = day.seconds === 0 ? 4 : Math.max(12, (day.seconds / maxValue) * 100);
      const weekDay = weekDayLabels[(day.date.getDay() + 6) % 7];

      return `
        <div class="bar-column" title="${day.date.toLocaleDateString('ru-RU')}: ${formatDuration(day.seconds)}">
          <div class="bar-track">
            <div class="bar-fill" style="height:${height}%"></div>
          </div>
          <span>${weekDay}</span>
        </div>
      `;
    })
    .join('');
}

function renderDistribution(now: Date): void {
  const { start, end } = getPeriodRange(now);
  const totals = new Map<string, number>();

  for (const session of sessions) {
    const date = new Date(session.started_at);

    if (date >= start && date < end) {
      totals.set(
        session.focus_group_id,
        (totals.get(session.focus_group_id) ?? 0) +
          (session.duration_seconds ?? 0)
      );
    }
  }

  const entries = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
  const total = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
  const chart = getElement<HTMLElement>('group-distribution-chart');
  const legend = getElement('group-distribution-legend');

  if (total === 0) {
    chart.style.background = 'conic-gradient(var(--line) 0 100%)';
    legend.innerHTML = '<p class="text-xs text-slate-500">Пока нет данных</p>';
    return;
  }

  let offset = 0;
  const stops = entries.map(([, seconds], index) => {
    const startPercent = offset;
    offset += (seconds / total) * 100;
    return `${chartColors[index]} ${startPercent}% ${offset}%`;
  });
  chart.style.background = `conic-gradient(${stops.join(',')})`;
  legend.innerHTML = entries
    .map(([groupId, seconds], index) => {
      const title = groups.get(groupId)?.title ?? 'Без группы';
      const percent = Math.round((seconds / total) * 100);

      return `
        <div class="legend-row">
          <span class="legend-dot" style="background:${chartColors[index]}"></span>
          <span class="legend-name">${escapeHtml(title)}</span>
          <span>${percent}%</span>
        </div>
      `;
    })
    .join('');
}

function renderHeatmap(now: Date, dailyTotals: Map<string, number>): void {
  const currentWeek = startOfWeek(now);
  const start = new Date(currentWeek);
  start.setDate(start.getDate() - 84);
  const days = Array.from({ length: 91 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return {
      date,
      seconds: dailyTotals.get(getDateKey(date)) ?? 0
    };
  });
  const maxValue = Math.max(...days.map((day) => day.seconds), 1);

  getElement('activity-heatmap').innerHTML = days
    .map((day) => {
      const ratio = day.seconds / maxValue;
      const level =
        day.seconds === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;

      return `<span class="heat-cell heat-level-${level}" title="${day.date.toLocaleDateString(
        'ru-RU'
      )}: ${formatDuration(day.seconds)}"></span>`;
    })
    .join('');
}

function renderStatistics(): void {
  const now = new Date();
  const dailyTotals = getDailyTotals();
  renderSummary(now);
  renderBars(now, dailyTotals);
  renderDistribution(now);
  renderHeatmap(now, dailyTotals);
}

export async function loadStatistics(): Promise<void> {
  const { data, error } = await fetchFinishedSessions();

  if (error) {
    throw error;
  }

  sessions = (data ?? []) as FocusSession[];

  if (!periodBound) {
    periodBound = true;
    getElement<HTMLSelectElement>('stats-period').addEventListener(
      'change',
      (event) => {
        selectedPeriod = (event.target as HTMLSelectElement).value as Period;
        renderStatistics();
      }
    );
  }

  renderStatistics();
}
