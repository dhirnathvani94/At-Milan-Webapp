import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  label?: string;
}

export default function Tabs({ tabs, activeTab, onTabChange, label = 'Tabs' }: TabsProps) {
  return (
    <div className="border-b border-gray-200">
      <div className="-mb-px flex space-x-8 overflow-x-auto" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => {
                const idx = tabs.findIndex(t => t.id === tab.id);
                if (e.key === 'ArrowRight') { e.preventDefault(); const next = tabs[(idx + 1) % tabs.length]; onTabChange(next.id); (document.getElementById(`tab-${next.id}`))?.focus(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); const prev = tabs[(idx - 1 + tabs.length) % tabs.length]; onTabChange(prev.id); (document.getElementById(`tab-${prev.id}`))?.focus(); }
              }}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors
                ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                    isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
