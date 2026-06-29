import { getElement } from '../../shared/dom';
import { formatClock } from '../../shared/formatters';
import type { TimerState } from '../../types/focus';

export function updateTimerView(timerState: TimerState): void {
  const modeLabel =
    timerState.mode === 'countdown' ? 'На время' : 'Без лимита';
  const phaseLabel = timerState.phase === 'focus' ? 'Фокус активен' : 'Перерыв';
  const breakCard = getElement('timer-next-break-card');

  getElement('timer-overlay').dataset.phase = timerState.phase;
  getElement('timer-mode').textContent = `${modeLabel} · ${phaseLabel}`;
  getElement('timer-clock').textContent = formatClock(timerState.secondsLeft);
  getElement('timer-message').textContent =
    timerState.status === 'paused'
      ? 'Сессия поставлена на паузу'
      : timerState.phase === 'focus'
        ? 'Сохраняйте внимание на выбранном ресурсе'
        : 'Восстановите силы перед следующим отрезком фокуса';
  breakCard.classList.toggle('hidden', !timerState.breakEnabled);

  if (timerState.breakEnabled) {
    const breakSeconds =
      timerState.phase === 'break'
        ? timerState.secondsLeft
        : Math.max(0, timerState.nextBreakAt - timerState.focusSecondsElapsed);

    getElement('timer-next-break-label').textContent =
      timerState.phase === 'break' ? 'До возвращения к фокусу' : 'Следующий перерыв';
    getElement('timer-next-break').textContent = formatClock(breakSeconds);
  }

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
