import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA service worker for 100% offline village mode
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
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

createRoot(document.getElementById('root')!).render(<App />);
