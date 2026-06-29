import { supabaseClient } from '../lib/supabaseClient';

type CreateSessionInput = {
  userId: string;
  groupId: string;
  taskId: string;
  breakEnabled: boolean;
  breakIntervalMinutes: number;
  breakDurationMinutes: number;
};

export function fetchFinishedSessions() {
  return supabaseClient
    .from('focus_sessions')
    .select('id,started_at,duration_seconds,status')
    .in('status', ['completed', 'cancelled'])
    .not('duration_seconds', 'is', null)
    .order('started_at', { ascending: false });
}

export function fetchActiveSessions() {
  return supabaseClient
    .from('focus_sessions')
    .select('id')
    .in('status', ['active', 'paused'])
    .limit(1);
}

export function createSession(input: CreateSessionInput) {
  return supabaseClient
    .from('focus_sessions')
    .insert({
      user_id: input.userId,
      focus_group_id: input.groupId,
      focus_task_id: input.taskId,
      started_at: new Date().toISOString(),
      status: 'active',
      break_enabled: input.breakEnabled,
      break_interval_minutes: input.breakEnabled
        ? input.breakIntervalMinutes
        : null,
      break_duration_minutes: input.breakEnabled
        ? input.breakDurationMinutes
        : null,
      pause_count: 0
    })
    .select('id')
    .single();
}

export function fetchSessionStatus(sessionId: string) {
  return supabaseClient
    .from('focus_sessions')
    .select('id,status')
    .eq('id', sessionId)
    .single();
}

export function finishSessionRecord(
  sessionId: string,
  status: 'completed' | 'cancelled',
  durationSeconds: number,
  pauseCount: number
) {
  return supabaseClient
    .from('focus_sessions')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      status,
      pause_count: pauseCount
    })
    .eq('id', sessionId);
}

export function pauseSession(sessionId: string, pauseCount: number) {
  return supabaseClient
    .from('focus_sessions')
    .update({ status: 'paused', pause_count: pauseCount })
    .eq('id', sessionId);
}

export function resumeSession(sessionId: string) {
  return supabaseClient
    .from('focus_sessions')
    .update({ status: 'active' })
    .eq('id', sessionId);
}
