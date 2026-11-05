import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { Language } from '../types';

interface OfflineIndicatorProps {
  lang?: Language;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang = 'te' }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
      <div className="bg-amber-600/95 dark:bg-amber-700/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-xl shadow-amber-900/30 flex items-center justify-between text-xs font-bold border border-amber-400/40">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-200 animate-ping" />
          <WifiOff className="w-4 h-4 text-amber-200" />
          <span>
            {lang === 'te'
              ? 'ఆఫ్‌లైన్ విలేజ్ మోడ్ — లెక్కలు ఫోన్‌లో సేవ్ అవుతున్నాయి'
              : 'Offline Village Mode — Records saved safely to phone'}
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 text-amber-100 font-extrabold uppercase">
          {lang === 'te' ? 'ఆఫ్‌లైన్' : 'Offline'}
        </span>
      </div>
    </div>
  );
};
