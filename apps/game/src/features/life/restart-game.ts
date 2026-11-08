export interface ReloadTarget {
  reload(): void;
}

export function restartGame(target: ReloadTarget = window.location): void {
  target.reload();
}
