import { getElement } from '../../shared/dom';
import { formatClock, formatDuration } from '../../shared/formatters';
import type { TimerState } from '../../types/focus';

export function updateTimerView(timerState: TimerState): void {
  const modeLabel =
    timerState.mode === 'countdown' ? 'На время' : 'Без лимита';
  const phaseLabel = timerState.phase === 'focus' ? 'Фокус' : 'Перерыв';

  getElement('timer-mode').textContent = `${modeLabel} · ${phaseLabel}`;
  getElement('timer-task-title').textContent = timerState.taskTitle;
  getElement('timer-group-title').textContent = timerState.groupTitle;
  getElement('timer-clock').textContent = formatClock(timerState.secondsLeft);
  getElement('timer-message').textContent =
    timerState.phase === 'focus'
      ? `Сфокусировано: ${formatDuration(timerState.focusSecondsElapsed)}`
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

export function showTimer(timerState: TimerState): void {
  getElement('app').setAttribute('inert', '');
  const timerOverlay = getElement<HTMLElement>('timer-overlay');
  timerOverlay.classList.remove('hidden');
  timerOverlay.classList.add('flex');
  document.body.classList.add('overflow-hidden');
  updateTimerView(timerState);
}

export function hideTimer(): void {
  getElement('app').removeAttribute('inert');
  const timerOverlay = getElement<HTMLElement>('timer-overlay');
  timerOverlay.classList.add('hidden');
  timerOverlay.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
}
