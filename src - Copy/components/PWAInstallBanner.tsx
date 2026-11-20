import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share2, PlusSquare, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types';

interface PWAInstallBannerProps {
  lang?: Language;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({ lang = 'te' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Requirement 4: Auto-dismiss install banner after 5 seconds
  useEffect(() => {
    if (dismissed || showGuide || isInstalled) return;
    const timer = setTimeout(() => {
      setDismissed(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [dismissed, showGuide, isInstalled]);

  // If already running inside standalone PWA mode or dismissed for session, hide
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <div className="rounded-2xl p-3.5 bg-gradient-to-r from-[#084D6E] via-[#0E2A47] to-[#0A1626] text-white shadow-lg border border-amber-500/40 relative overflow-hidden animate-in fade-in duration-300">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-white">
                  {lang === 'te' ? 'ఫోన్ యాప్‌లా ఇన్‌స్టాల్ చేయండి' : 'Install Mobile App (PWA)'}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black uppercase">
                  OFFLINE
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-tight">
                {lang === 'te'
                  ? 'సిగ్నల్ లేని గ్రామాల్లో కూడా ఆఫ్‌లైన్‌లో వేగంగా పనిచేస్తుంది'
                  : 'Fast 100% offline access in remote villages without signal'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs hover:from-amber-300 hover:to-amber-400 active:scale-95 transition-all shadow-md flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === 'te' ? 'ఇన్‌స్టాల్' : 'Install App'}</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center text-xs cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Guided Install Dialog (Both Android Chrome & iOS Safari) */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowGuide(false)}
        >
          <div className="w-full max-w-sm rounded-3xl p-6 bg-white dark:bg-[#131B2E] text-slate-900 dark:text-slate-100 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                <span>
                  {isIOS
                    ? lang === 'te' ? 'ఐఫోన్‌లో ఇన్‌స్టాల్ విధానం' : 'Install on iPhone / iPad'
                    : lang === 'te' ? 'ఆండ్రాయిడ్ క్రోమ్‌లో ఇన్‌స్టాల్' : 'Install on Android Chrome'}
                </span>
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'te' ? 'షేర్ (Share) బటన్ నొక్కండి' : 'Tap the Share Button'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      Safari బ్రౌజర్ క్రింద ఉండే <Share2 className="w-3.5 h-3.5 text-blue-500 inline" /> ఐకాన్ నొక్కండి.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'te' ? '"Add to Home Screen" ఎంచుకోండి' : 'Select "Add to Home Screen"'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                      మెనూని క్రిందికి స్క్రోల్ చేసి <PlusSquare className="w-3.5 h-3.5 text-emerald-500 inline" /> బటన్ నొక్కండి.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'te' ? 'క్రోమ్ మెనూ 3 చుక్కలు (⋮) నొక్కండి' : 'Tap Chrome 3 Dots (⋮)'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lang === 'te'
                        ? 'బ్రౌజర్ పైన కుడివైపు ఉండే 3 చుక్కలు నొక్కండి.'
                        : 'Tap the three dots (⋮) at top right corner of Chrome.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'te' ? '"Install app" లేదా "Add to Home screen" నొక్కండి' : 'Tap "Install app" or "Add to Home screen"'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lang === 'te'
                        ? 'ఆప్షన్ నొక్కి "Install" కన్ఫర్మ్ చేయండి. వెంటనే హోమ్‌స్క్రీన్‌కు జోడించబడుతుంది.'
                        : 'Tap the option and confirm "Install". The app will appear on your phone screen.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white font-bold text-xs cursor-pointer hover:bg-slate-800 shadow-md"
            >
              {lang === 'te' ? 'సరే (Got it)' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
