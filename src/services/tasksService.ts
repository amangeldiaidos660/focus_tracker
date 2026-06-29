import { supabaseClient } from '../lib/supabaseClient';

type CreateTaskInput = {
  userId: string;
  groupId: string;
  title: string;
  url: string;
  description: string | null;
};

export function fetchTasks() {
  return supabaseClient
    .from('focus_tasks')
    .select(
      'id,user_id,focus_group_id,title,url,description,status,created_at'
    )
    .order('created_at', { ascending: false });
}

export function createTask(input: CreateTaskInput) {
  return supabaseClient
    .from('focus_tasks')
    .insert({
      user_id: input.userId,
      focus_group_id: input.groupId,
      title: input.title,
      url: input.url,
      description: input.description,
      status: 'active'
    })
    .select(
      'id,user_id,focus_group_id,title,url,description,status,created_at'
    )
    .single();
}

export function updateTaskStatus(
  taskId: string,
  status: 'active' | 'archived'
) {
  return supabaseClient.from('focus_tasks').update({ status }).eq('id', taskId);
}

export function deleteTask(taskId: string) {
  return supabaseClient.from('focus_tasks').delete().eq('id', taskId);
}
