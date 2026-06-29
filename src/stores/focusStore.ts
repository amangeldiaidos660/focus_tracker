import type { FocusGroup, FocusTask } from '../types/focus';

export const groups = new Map<string, FocusGroup>();
export const tasksByGroup = new Map<string, FocusTask[]>();

let userId = '';

export function setUserId(id: string): void {
  userId = id;
}

export function getUserId(): string {
  return userId;
}

export function getTasks(groupId: string): FocusTask[] {
  return tasksByGroup.get(groupId) ?? [];
}
