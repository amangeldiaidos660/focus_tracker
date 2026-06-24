import React, { useEffect, useRef, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

type Props = {
  taskId: string;
  groupId?: string;
  durationMinutes: number;
  breakEnabled?: boolean;
  breakIntervalMinutes?: number;
  breakDurationMinutes?: number;
  onClose?: () => void;
};

export default function FocusTimer(props: Props) {
  const { taskId, groupId, durationMinutes, breakEnabled, breakIntervalMinutes, breakDurationMinutes, onClose } = props;
  const totalSeconds = durationMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [status, setStatus] = useState<'running' | 'paused' | 'completed'>('running');
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // create session record (active)
    startTimeRef.current = new Date();
    (async () => {
      const user = (await supabaseClient.auth.getUser()).data.user;
      const payload = {
        user_id: user?.id,
        focus_group_id: groupId || null,
        focus_task_id: taskId,
        started_at: new Date().toISOString(),
        status: 'active',
        break_enabled: breakEnabled || false,
        break_interval_minutes: breakIntervalMinutes || null,
        break_duration_minutes: breakDurationMinutes || null
      } as any;

      const { data, error } = await supabaseClient.from('focus_sessions').insert(payload).select().single();
      if (data?.id) sessionIdRef.current = data.id;
      if (error) console.error('failed to create session', error);
    })();

    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timerRef.current ?? undefined);
          setStatus('completed');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === 'completed') {
      (async () => {
        const ended = new Date().toISOString();
        const duration = totalSeconds - secondsLeft;
        if (sessionIdRef.current) {
          await supabaseClient.from('focus_sessions').update({ ended_at: ended, duration_seconds: duration, status: 'completed' }).eq('id', sessionIdRef.current);
        }
      })();
      if (onClose) onClose();
    }
  }, [status]);

  const pause = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
      setStatus('paused');
      if (sessionIdRef.current) {
        supabaseClient.from('focus_sessions').update({ status: 'paused', pause_count: (Math.floor(Math.random()*1)+1) }).eq('id', sessionIdRef.current);
      }
    }
  };

  const resume = () => {
    if (!timerRef.current) {
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            window.clearInterval(timerRef.current ?? undefined);
            setStatus('completed');
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      setStatus('running');
      if (sessionIdRef.current) {
        supabaseClient.from('focus_sessions').update({ status: 'active' }).eq('id', sessionIdRef.current);
      }
    }
  };

  const stop = async () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    const ended = new Date().toISOString();
    const duration = totalSeconds - secondsLeft;
    if (sessionIdRef.current) await supabaseClient.from('focus_sessions').update({ ended_at: ended, duration_seconds: duration, status: 'cancelled' }).eq('id', sessionIdRef.current);
    setStatus('completed');
    if (onClose) onClose();
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white dark:bg-gray-800 rounded p-8 w-full max-w-md text-center">
        <h2 className="text-xl font-semibold mb-4">Focus session</h2>
        <div className="text-4xl font-mono mb-4">{String(mm).padStart(2,'0')}:{String(ss).padStart(2,'0')}</div>
        <div className="flex gap-3 justify-center">
          {status === 'running' ? (
            <button className="px-4 py-2 bg-yellow-500 text-white rounded" onClick={pause}>Pause</button>
          ) : (
            <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={resume}>Resume</button>
          )}
          <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={stop}>Stop</button>
        </div>
      </div>
    </div>
  );
}
