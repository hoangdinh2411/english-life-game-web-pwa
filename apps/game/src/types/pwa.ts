export interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
  }>;
}
export interface PwaState {
  online: boolean;
  offlineReady: boolean;
  updateReady: boolean;
  message: string;
  canInstall: boolean;
  install: () => Promise<void>;
  update: () => Promise<void>;
}
