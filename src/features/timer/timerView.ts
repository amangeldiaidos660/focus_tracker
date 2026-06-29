import { getElement } from '../../shared/dom';
import { formatClock, formatDuration } from '../../shared/formatters';
import type { TimerState } from '../../types/focus';

function getNextBreakLabel(timerState: TimerState): string {
  if (!timerState.breakEnabled) {
    return 'Не запланирован';
  }

  if (timerState.phase === 'break') {
    return `${formatClock(timerState.secondsLeft)} до фокуса`;
  }

  const seconds = Math.max(
    0,
    timerState.nextBreakAt - timerState.focusSecondsElapsed
  );

  if (
    timerState.mode === 'countdown' &&
    timerState.focusSecondsElapsed + seconds >= timerState.durationSeconds
  ) {
    return 'После завершения';
  }

  return formatClock(seconds);
}

export function updateTimerView(timerState: TimerState): void {
  const modeLabel =
    timerState.mode === 'countdown' ? 'На время' : 'Без лимита';
  const phaseLabel = timerState.phase === 'focus' ? 'Фокус активен' : 'Перерыв';

  getElement('timer-mode').textContent = `${modeLabel} · ${phaseLabel}`;
  getElement('timer-task-title').textContent = timerState.taskTitle;
  getElement('timer-group-title').textContent = timerState.groupTitle;
  getElement('timer-clock').textContent = formatClock(timerState.secondsLeft);
  getElement('timer-message').textContent =
    timerState.status === 'paused'
      ? 'Сессия поставлена на паузу'
      : timerState.phase === 'focus'
        ? 'Сохраняйте внимание на выбранном ресурсе'
        : 'Отдохните — фокус продолжится автоматически';
  getElement('timer-next-break').textContent = getNextBreakLabel(timerState);
  getElement('timer-session-mode').textContent = modeLabel;
  getElement('timer-focused-value').textContent = formatDuration(
    timerState.focusSecondsElapsed
  );
  getElement('timer-break-detail').textContent = timerState.breakEnabled
    ? `Каждые ${formatDuration(timerState.breakIntervalSeconds)} · ${formatDuration(
        timerState.breakDurationSeconds
      )}`
    : 'Выключены';
  getElement('timer-pause').classList.toggle(
    'hidden',
    timerState.status === 'paused'
  );
  getElement('timer-resume').classList.toggle(
    'hidden',
    timerState.status !== 'paused'
  );
}

export function showTimer(timerState: TimerState): void {
  getElement('app').setAttribute('inert', '');
  getElement('timer-overlay').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  updateTimerView(timerState);
}

export function hideTimer(): void {
  getElement('app').removeAttribute('inert');
  getElement('timer-overlay').classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}
