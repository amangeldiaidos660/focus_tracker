export type TimerMode = 'countdown' | 'stopwatch';

export type FocusGroup = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

export type FocusTask = {
  id: string;
  user_id: string;
  focus_group_id: string;
  title: string;
  url: string;
  description: string | null;
  status: 'active' | 'archived';
  created_at: string;
};

export type FocusSession = {
  id: string;
  focus_group_id: string;
  started_at: string;
  duration_seconds: number | null;
  timer_mode: TimerMode;
  planned_duration_seconds: number | null;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
};

export type TimerState = {
  sessionId: string;
  mode: TimerMode;
  groupId: string;
  groupTitle: string;
  taskId: string;
  taskTitle: string;
  durationSeconds: number;
  focusSecondsElapsed: number;
  secondsLeft: number;
  status: 'active' | 'paused';
  phase: 'focus' | 'break';
  breakEnabled: boolean;
  breakIntervalSeconds: number;
  breakDurationSeconds: number;
  nextBreakAt: number;
  pauseCount: number;
  lastTickAt: number;
};
