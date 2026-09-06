import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Download, 
  Trash2, 
  LogOut, 
  LayoutDashboard,
  ListTodo,
  Workflow,
  Zap,
  BookOpen,
  BarChart3,
  FileUp,
  Settings,
  Globe2
} from 'lucide-react';
import { User } from 'firebase/auth';
import { signOutCurrentUser } from '../lib/firebase';
import { ActiveNavTab } from '../types';

interface NavbarProps {
  user: User;
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  userTimezone: string;
  onOpenSettings: () => void;
  onOpenThreatModel: () => void;
  onOpenDeleteData: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onSelectTab,
  userTimezone,
  onOpenSettings,
  onOpenThreatModel,
  onOpenDeleteData,
}) => {
  const handleSignOut = async () => {
    try {
      await signOutCurrentUser();
    } catch {
      // Handle gracefully
    }
  };

  const navItems: { id: ActiveNavTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'planner', label: 'Planner', icon: Workflow },
    { id: 'focus', label: 'Focus', icon: Zap },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'import', label: 'Import', icon: FileUp },
  ];

  return (
    <header className="border-b border-zinc-800 bg-[#0A0A0A]/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div 
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer select-none shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-700 flex items-center justify-center text-amber-300 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-100">
              Gemini Companion
            </span>
          </div>
        </div>

        {/* Primary Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-zinc-100 text-black font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Settings, Security, Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSettings}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-xl transition-colors"
            title="Settings & Privacy"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenThreatModel}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 rounded-xl transition-colors hidden sm:flex items-center gap-1 text-xs"
            title="View Threat Model & Security Verification"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden lg:inline text-zinc-400">Security</span>
          </button>

          {/* User Profile Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-zinc-700 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-500 text-zinc-100 flex items-center justify-center font-bold text-xs">
                {(user.displayName || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="hidden xl:block text-left">
              <div className="text-xs font-medium text-zinc-200 max-w-[90px] truncate leading-tight">
                {user.displayName || 'User'}
              </div>
              <div className="text-[9px] text-zinc-500 font-mono">
                {user.uid.slice(0, 6)}...
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-xl transition-colors ml-0.5"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom / Secondary Navigation Strip */}
      <div className="md:hidden flex items-center justify-between px-2 py-1.5 border-t border-zinc-800/80 bg-[#0A0A0A] overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex flex-col items-center gap-1 shrink-0 ${
                isActive ? 'text-zinc-100 font-bold' : 'text-zinc-500'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-zinc-500'}`} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

