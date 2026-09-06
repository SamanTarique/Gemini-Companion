import React, { useState, useEffect } from 'react';
import { 
  PanelLeft, 
  PanelLeftClose,
  SquarePen, 
  Settings, 
  ShieldCheck, 
  Bell,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ActiveNavTab } from '../types';

interface TopHeaderProps {
  activeTab: ActiveNavTab;
  isSidebarOpen?: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenThreatModel: () => void;
  userTimezone: string;
  unreadNotificationCount?: number;
  onOpenNotifications?: () => void;
}

const TAB_TITLES: Record<ActiveNavTab, string> = {
  home: 'Command Center',
  search: 'AI Search & Intelligence',
  calendar: 'Calendar & Schedule',
  tasks: 'Tasks & Commitments',
  planner: 'Daily Planner',
  focus: 'Focus Mode',
  journal: 'Reflections & Chat',
  insights: 'Productivity Insights',
  import: 'Chat & Notes Importer',
  history: 'Reflections Archive',
  settings: 'Settings & Preferences',
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  isSidebarOpen = true,
  onToggleSidebar,
  onNewChat,
  onOpenSettings,
  onOpenThreatModel,
  userTimezone,
  unreadNotificationCount = 0,
  onOpenNotifications,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (e) {
      console.warn('Fullscreen toggle not available or blocked in frame:', e);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-4 sm:px-6">
      {/* Left: Sidebar Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          id="toggle-sidebar-button"
          onClick={onToggleSidebar}
          className={`p-2 rounded-xl transition-all flex items-center justify-center ${
            isSidebarOpen 
              ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800' 
              : 'text-amber-400 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-amber-300 shadow-xs'
          }`}
          title={isSidebarOpen ? 'Collapse menu (Ctrl+B)' : 'Open menu (Ctrl+B)'}
          aria-label={isSidebarOpen ? 'Collapse menu' : 'Open menu'}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 tracking-tight">
            {TAB_TITLES[activeTab] || 'Gemini Companion'}
          </h1>
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all shadow-xs"
          title="Start new chat/reflection"
        >
          <SquarePen className="w-3.5 h-3.5 text-amber-400" />
          <span>New chat</span>
        </button>

        {/* Notifications Bell */}
        {onOpenNotifications && (
          <button
            onClick={onOpenNotifications}
            className="relative p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>
        )}

        {/* Fullscreen Toggle */}
        <button
          id="toggle-fullscreen-button"
          onClick={toggleFullscreen}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenThreatModel}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors hidden sm:flex items-center gap-1 text-xs"
          title="Security & Threat Model"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
