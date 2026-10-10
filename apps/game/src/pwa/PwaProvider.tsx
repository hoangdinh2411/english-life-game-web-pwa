import type { InstallPrompt, PwaState } from '../types/pwa';
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { registerSW } from 'virtual:pwa-register';
const PwaContext = createContext<PwaState | null>(null);

export function PwaProvider({ children }: PropsWithChildren) {
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [message, setMessage] = useState('');
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const updateWorker = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const connection = () => setOnline(navigator.onLine);
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const installed = () => setPrompt(null);
    const checkUpdate = () => {
      if (navigator.onLine) void registration.current?.update().catch(() => setMessage('The app update could not download. Your current version is still available.'));
    };
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    window.addEventListener('online', checkUpdate);
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    // Development has no service worker, avoiding stale HMR and private caching.
    if (import.meta.env.PROD && !updateWorker.current) {
      updateWorker.current = registerSW({
        immediate: true,
        onOfflineReady: () => setOfflineReady(true),
        onNeedRefresh: () => setUpdateReady(true),
        onRegisteredSW: (_url, value) => {
          registration.current = value ?? null;
          if (value?.active && !value.waiting) setOfflineReady(true);
        },
        onRegisterError: () => setMessage('Offline setup could not finish. Reconnect and reload to try again.'),
      });
    }
    const timer = window.setInterval(checkUpdate, 60 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('online', checkUpdate);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  const install = async () => {
    if (!prompt) return;
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    catch { setMessage('Use your browser’s menu to install the app, if supported.'); }
  };
  const update = async () => {
    if (!updateReady || !updateWorker.current) return;
    // Available on onboarding or the paused game menu, after explicit confirmation.
    if (!window.confirm('Reload to update? This ends local practice and clears unfinished character choices.')) return;
    try { await updateWorker.current(true); }
    catch { setMessage('The app could not update. Keep playing and try again after reconnecting.'); }
  };
  return <PwaContext.Provider value={{ online, offlineReady, updateReady, message, canInstall: prompt !== null, install, update }}>{children}</PwaContext.Provider>;
}
export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error('PwaProvider is required.');
  return value;
}
