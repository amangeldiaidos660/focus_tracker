export function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) {
    dialog.showModal();
  }
}

export function closeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) {
    dialog.close();
  }
}

export function initializeDialogControls(): void {
  document
    .querySelectorAll<HTMLElement>('[data-close-dialog]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const dialogId = button.dataset.closeDialog;

        if (dialogId) {
          const dialog = document.getElementById(dialogId);

          if (dialog instanceof HTMLDialogElement) {
            closeDialog(dialog);
          }
        }
      });
    });
}
