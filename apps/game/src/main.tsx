import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { PwaProvider } from './pwa/PwaProvider';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('The application root is missing.');
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void import('./pwa/clear-development-worker').then(({ clearDevelopmentWorker }) =>
    clearDevelopmentWorker(navigator.serviceWorker, caches, location.origin)).catch(() => {
      // Development remains usable when browser cache controls are unavailable.
    });
}
createRoot(root).render(<StrictMode><PwaProvider><App /></PwaProvider></StrictMode>);
