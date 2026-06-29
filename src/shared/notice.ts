import { getElement } from './dom';

export function showNotice(
  message: string,
  type: 'success' | 'error' = 'success'
): void {
  const notice = getElement<HTMLElement>('notice');
  notice.textContent = message;

  notice.className =
    'pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-3 text-sm text-white shadow-xl ' +
    (type === 'success' ? 'bg-emerald-600' : 'bg-red-600');

  window.setTimeout(() => {
    notice.classList.add('hidden');
  }, 3500);
}
