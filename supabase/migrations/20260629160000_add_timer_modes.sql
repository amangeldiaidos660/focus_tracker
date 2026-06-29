alter table public.focus_sessions
  add column timer_mode text not null default 'countdown',
  add column planned_duration_seconds integer;

alter table public.focus_sessions
  add constraint focus_sessions_timer_mode_check
    check (timer_mode in ('countdown', 'stopwatch')),
  add constraint focus_sessions_planned_duration_check
    check (planned_duration_seconds is null or planned_duration_seconds > 0);
