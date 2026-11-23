import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

import { isNativeAndroidApk } from './utils/platformUtils';

// Register PWA service worker for offline browser mode (skipped inside native APK bundle)
if (!isNativeAndroidApk() && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('SLG Village Finance Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('SLG Service Worker registration note:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
