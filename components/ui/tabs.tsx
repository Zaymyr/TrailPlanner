import * as React from "react";
import { cn } from "../utils";

interface Tab {
  id: string;
  label: string;
}

interface TabsListProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabsList({ tabs, activeTab, onTabChange }: TabsListProps) {
  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "-mb-px px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none",
            activeTab === tab.id
              ? "border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
