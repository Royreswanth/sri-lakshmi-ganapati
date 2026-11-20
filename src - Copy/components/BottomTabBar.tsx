import React from "react";
import { Home, HandCoins, Users, BarChart3, Settings } from "lucide-react";
import { Language, ThemeMode } from "../types";

export type TabType =
  | "home"
  | "collect"
  | "borrowers"
  | "reports"
  | "calendar"
  | "calc"
  | "expenses"
  | "settings";

interface BottomTabBarProps {
  activeTab?: TabType;
  currentTab?: TabType;
  onSelectTab: (tab: TabType) => void;
  lang: Language;
  theme?: ThemeMode;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  currentTab,
  onSelectTab,
  lang,
  theme = "light",
}) => {
  const selected = activeTab || currentTab || "home";

  const tabs: { id: TabType; labelEn: string; labelTe: string; icon: React.ReactNode }[] = [
    {
      id: "home",
      labelEn: "Home",
      labelTe: "హోమ్",
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: "collect",
      labelEn: "Collect",
      labelTe: "వసూలు",
      icon: <HandCoins className="w-5 h-5" />,
    },
    {
      id: "borrowers",
      labelEn: "Borrowers",
      labelTe: "ఖాతా",
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: "reports",
      labelEn: "Reports",
      labelTe: "నివేదికలు",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: "settings",
      labelEn: "Settings",
      labelTe: "సెట్టింగ్స్",
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-40 select-none">
      <nav className="rounded-full px-2 py-2 flex items-center justify-between backdrop-blur-md bg-white/95 dark:bg-[#131B2E]/95 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-900/10 dark:shadow-black/60 transition-colors">
        {tabs.map((tab) => {
          const isActive = selected === tab.id;
          const label = lang === "te" ? tab.labelTe : tab.labelEn;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-1.5 py-2 px-3 rounded-full transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-[#1E3A8A] text-white shadow-md shadow-blue-900/40 scale-102"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span className="shrink-0">{tab.icon}</span>
              {isActive && (
                <span className="text-xs font-bold whitespace-nowrap tracking-tight animate-fadeIn">
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
