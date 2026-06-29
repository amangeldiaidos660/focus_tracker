import type { TimerState } from '../../types/focus';

const timerStorageKey = 'focus-tracker-active-session';
let timerState: TimerState | null = null;

export function getTimerState(): TimerState | null {
  return timerState;
}

export function setTimerState(state: TimerState | null): void {
  timerState = state;
}

export function saveTimerState(): void {
  if (timerState) {
    localStorage.setItem(timerStorageKey, JSON.stringify(timerState));
  } else {
    localStorage.removeItem(timerStorageKey);
  }
}

export function readStoredTimerState(): TimerState | null {
  const rawState = localStorage.getItem(timerStorageKey);
  return rawState ? (JSON.parse(rawState) as TimerState) : null;
}

export function removeStoredTimerState(): void {
  localStorage.removeItem(timerStorageKey);
}
