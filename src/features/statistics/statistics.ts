import { fetchFinishedSessions } from '../../services/sessionsService';
import { escapeHtml, getElement } from '../../shared/dom';
import { formatDuration } from '../../shared/formatters';
import { groups } from '../../stores/focusStore';
import type { FocusSession } from '../../types/focus';

type Period = 'week' | 'month' | 'year';

const chartColors = ['#3f9cff', '#8b5cf6', '#f5c84c', '#22c55e', '#f97316'];
const weekDayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthLabels = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек'
];

let sessions: FocusSession[] = [];
let selectedPeriod: Period = 'week';
let selectedActivityYear = new Date().getFullYear();
let controlsBound = false;

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sumBetween(start: Date, end: Date): number {
  return sessions.reduce((total, session) => {
    const date = new Date(session.started_at);
    return date >= start && date < end
      ? total + (session.duration_seconds ?? 0)
      : total;
  }, 0);
}

function getPeriodDays(): number {
  return selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 365;
}

function getPeriodRange(now: Date): {
  start: Date;
  end: Date;
  previousStart: Date;
} {
  const end = addDays(startOfDay(now), 1);
  const days = getPeriodDays();
  const start = addDays(end, -days);
  const previousStart = addDays(start, -days);
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
    return;
  }

  const percent = Math.round(((currentTotal - previousTotal) / previousTotal) * 100);
  changeElement.textContent = `${percent >= 0 ? '+' : ''}${percent}% к прошлому периоду`;
  changeElement.classList.toggle('is-positive', percent >= 0);
}

function getDailyTotals(): Map<string, number> {
  const totals = new Map<string, number>();

  for (const session of sessions) {
    const key = getDateKey(new Date(session.started_at));
    totals.set(key, (totals.get(key) ?? 0) + (session.duration_seconds ?? 0));
  }

  return totals;
}

function getBarData(now: Date, dailyTotals: Map<string, number>) {
  if (selectedPeriod === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return {
        label: monthLabels[start.getMonth()],
        title: start.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        seconds: sumBetween(start, end)
      };
    });
  }

  const days = selectedPeriod === 'week' ? 7 : 30;

  return Array.from({ length: days }, (_, index) => {
    const date = addDays(startOfDay(now), -(days - 1 - index));
    const showLabel =
      selectedPeriod === 'week' || index % 5 === 0 || index === days - 1;

    return {
      label: showLabel
        ? selectedPeriod === 'week'
          ? weekDayLabels[(date.getDay() + 6) % 7]
          : String(date.getDate())
        : '',
      title: date.toLocaleDateString('ru-RU'),
      seconds: dailyTotals.get(getDateKey(date)) ?? 0
    };
  });
}

function renderBars(now: Date, dailyTotals: Map<string, number>): void {
  const data = getBarData(now, dailyTotals);
  const maxValue = Math.max(...data.map((item) => item.seconds), 1);
  const chart = getElement<HTMLElement>('weekly-bars');

  chart.dataset.range = selectedPeriod;
  chart.style.gridTemplateColumns = `repeat(${data.length}, minmax(0, 1fr))`;
  getElement('bar-chart-title').textContent =
    selectedPeriod === 'year' ? 'Время по месяцам' : 'Время по дням';
  chart.innerHTML = data
    .map((item) => {
      const height = item.seconds === 0 ? 4 : Math.max(10, (item.seconds / maxValue) * 100);

      return `
        <div class="bar-column" title="${escapeHtml(item.title)}: ${formatDuration(item.seconds)}">
          <div class="bar-track">
            <div class="bar-fill" style="height:${height}%"></div>
          </div>
          <span>${item.label || '&nbsp;'}</span>
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

function getAvailableYears(): number[] {
  return Array.from(
    new Set([
      new Date().getFullYear(),
      ...sessions.map((session) => new Date(session.started_at).getFullYear())
    ])
  ).sort((left, right) => right - left);
}

function renderYearOptions(): void {
  const select = getElement<HTMLSelectElement>('activity-year');
  const years = getAvailableYears();

  if (!years.includes(selectedActivityYear)) {
    selectedActivityYear = years[0];
  }

  select.innerHTML = years
    .map(
      (year) =>
        `<option value="${year}" ${year === selectedActivityYear ? 'selected' : ''}>${year}</option>`
    )
    .join('');
}

function renderHeatmap(dailyTotals: Map<string, number>): void {
  const yearStart = new Date(selectedActivityYear, 0, 1);
  const yearEnd = new Date(selectedActivityYear, 11, 31);
  const gridStart = startOfWeek(yearStart);
  const gridEnd = addDays(startOfWeek(yearEnd), 6);
  const dayCount =
    Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1;
  const weekCount = Math.ceil(dayCount / 7);
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(gridStart, index);
    const inside = date.getFullYear() === selectedActivityYear;
    return {
      date,
      inside,
      seconds: inside ? dailyTotals.get(getDateKey(date)) ?? 0 : 0
    };
  });
  const maxValue = Math.max(...days.map((day) => day.seconds), 1);
  const chart = getElement<HTMLElement>('activity-chart');

  chart.style.setProperty('--heat-weeks', String(weekCount));
  getElement('activity-months').innerHTML = monthLabels
    .map((label, month) => {
      const firstDay = new Date(selectedActivityYear, month, 1);
      const weekIndex = Math.floor(
        (startOfWeek(firstDay).getTime() - gridStart.getTime()) / 604_800_000
      );
      return `<span style="grid-column:${weekIndex + 1} / span 3">${label}</span>`;
    })
    .join('');
  getElement('activity-heatmap').innerHTML = days
    .map((day) => {
      if (!day.inside) {
        return '<span class="heat-cell is-outside"></span>';
      }

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
  renderYearOptions();
  renderHeatmap(dailyTotals);
}

export async function loadStatistics(): Promise<void> {
  const { data, error } = await fetchFinishedSessions();

  if (error) {
    throw error;
  }

  sessions = (data ?? []) as FocusSession[];

  if (!controlsBound) {
    controlsBound = true;
    getElement<HTMLSelectElement>('stats-period').addEventListener(
      'change',
      (event) => {
        selectedPeriod = (event.target as HTMLSelectElement).value as Period;
        renderStatistics();
      }
    );
    getElement<HTMLSelectElement>('activity-year').addEventListener(
      'change',
      (event) => {
        selectedActivityYear = Number((event.target as HTMLSelectElement).value);
        renderHeatmap(getDailyTotals());
      }
    );
  }

  renderStatistics();
}
