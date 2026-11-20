import React from "react";
import { ArrowLeft, Lock, Sun, Moon } from "lucide-react";
import { Language, ThemeMode, EmblemType } from "../types";
import { BusinessEmblem } from "./BusinessEmblem";

interface HeaderNavProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  businessName?: string;
  tagline?: string;
  emblem?: EmblemType | string;
  brandColor?: string;
  lang: Language;
  theme?: ThemeMode;
  onToggleLang?: () => void;
  onToggleTheme?: () => void;
  onLock?: () => void;
  showFullBranding?: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  businessName = "LineBook Pro",
  tagline = "FINANCE & LINE",
  emblem = "ganesha",
  brandColor = "#D97706",
  lang,
  theme = "light",
  onToggleLang,
  onToggleTheme,
  onLock,
  showFullBranding = false,
}) => {
  return (
    <header className="px-4 py-3 sticky top-0 z-40 transition-colors backdrop-blur-md bg-white/80 dark:bg-[#0B0F19]/80 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="flex items-center justify-between gap-2">
        {/* Left Action: Prominent Back button or clean spacing (Menu option removed as requested) */}
        <div className="w-10 flex items-center justify-start">
          {onBack ? (
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10 flex items-center justify-center">
              {/* Subtle small emblem mark for branding presence when at root */}
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shadow-xs">
                <BusinessEmblem emblem={emblem} size={20} color={brandColor} />
              </div>
            </div>
          )}
        </div>

        {/* Center: Branding or Screen Title */}
        {showFullBranding || !title ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-1 overflow-hidden">
            <div className="flex items-center justify-center gap-1.5">
              <BusinessEmblem emblem={emblem} size={28} color={brandColor} />
              <h1
                className="text-base sm:text-lg font-black tracking-tight leading-none truncate font-sans"
                style={{ color: brandColor || "#D97706" }}
              >
                {businessName}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-3.5 h-px opacity-40" style={{ backgroundColor: brandColor || "#D97706" }} />
              <span className="text-[9px] tracking-widest font-extrabold uppercase opacity-80 text-slate-600 dark:text-slate-400">
                {tagline}
              </span>
              <span className="w-3.5 h-px opacity-40" style={{ backgroundColor: brandColor || "#D97706" }} />
            </div>
          </div>
        ) : (
          <div className="flex-1 text-center px-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Right Action: Theme Switch, Language, Lock */}
        <div className="flex items-center justify-end gap-1.5">
          {rightAction ? (
            rightAction
          ) : (
            <div className="flex items-center gap-1.5">
              {/* Dark / Light Mode Toggle */}
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-amber-400 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  aria-label="Toggle Theme"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-700" />
                  )}
                </button>
              )}

              {/* Language Toggle */}
              {onToggleLang && (
                <button
                  onClick={onToggleLang}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title="Toggle Language"
                >
                  <span className="text-[11px] font-black">{lang === "en" ? "తె" : "EN"}</span>
                </button>
              )}

              {/* Lock Button */}
              {onLock && (
                <button
                  onClick={onLock}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all shadow-xs cursor-pointer"
                  title="Lock App"
                >
                  <Lock className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
