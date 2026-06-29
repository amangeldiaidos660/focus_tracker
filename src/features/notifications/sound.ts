import { getNotificationSettings } from './notificationSettings';

export type TimerSignal = 'focus-complete' | 'break-start' | 'break-end';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext();
  return audioContext;
}

export async function unlockTimerSound(): Promise<void> {
  if (!getNotificationSettings().soundEnabled) {
    return;
  }

  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }
}

export async function playTimerSound(signal: TimerSignal): Promise<void> {
  if (!getNotificationSettings().soundEnabled) {
    return;
  }

  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }

  const frequency =
    signal === 'focus-complete' ? 880 : signal === 'break-start' ? 520 : 720;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.5);
}
