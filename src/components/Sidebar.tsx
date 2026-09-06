import React, { useState } from 'react';
import { 
  SquarePen, 
  Search, 
  PanelLeftClose, 
  PanelLeft, 
  LayoutDashboard, 
  ListTodo, 
  Workflow, 
  Zap, 
  MessageSquare, 
  BarChart3, 
  FileUp, 
  Settings, 
  ShieldCheck, 
  Trash2, 
  LogOut, 
  Sparkles,
  Check,
  X,
  BookOpen,
  Calendar as CalendarIcon,
  Globe
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ActiveNavTab, JournalEntry } from '../types';
import { signOutCurrentUser } from '../lib/firebase';

interface SidebarProps {
  user: User;
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  entries: JournalEntry[];
  currentEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewChat: () => void;
  onDeleteEntry: (entryId: string) => void;
  onClearAllEntries?: () => void;
  isOpen: boolean;
  onToggleOpen?: () => void;
  onClose?: () => void;
  onOpenSettings: () => void;
  onOpenThreatModel: () => void;
  onOpenDeleteData: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onSelectTab,
  entries,
  currentEntryId,
  onSelectEntry,
  onNewChat,
  onDeleteEntry,
  onClearAllEntries,
  isOpen,
  onToggleOpen,
  onClose,
  onOpenSettings,
  onOpenThreatModel,
  onOpenDeleteData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const handleToggle = () => {
    if (onToggleOpen) {
      onToggleOpen();
    } else if (isOpen && onClose) {
      onClose();
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutCurrentUser();
    } catch {
      // Handled
    }
  };

  const navItems: { id: ActiveNavTab; label: string; icon: any }[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'search', label: 'AI Search', icon: Globe },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'planner', label: 'Planner', icon: Workflow },
    { id: 'focus', label: 'Focus', icon: Zap },
    { id: 'journal', label: 'Journal', icon: MessageSquare },
    { id: 'history', label: 'Archive', icon: BookOpen },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
    { id: 'import', label: 'Import', icon: FileUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.content && e.content.toLowerCase().includes(q)) ||
      (e.tags && e.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'ME';
  };

  const userName = user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={handleToggle}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#0F0F0F] border-r border-zinc-800/90 flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64 sm:w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'
        }`}
      >
        {/* Top Header */}
        <div className="p-3.5 flex items-center justify-between border-b border-zinc-800/80 shrink-0">
          {isOpen ? (
            <>
              <div 
                onClick={() => onSelectTab('home')}
                className="flex items-center gap-2.5 cursor-pointer px-1.5 py-1 rounded-xl hover:bg-zinc-800/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-zinc-100">
                    Companion
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors ${
                    showSearch ? 'bg-zinc-800 text-zinc-100' : ''
                  }`}
                  title="Search chats"
                >
                  <Search className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToggle}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-center py-1">
              <button
                id="sidebar-rail-expand-btn"
                onClick={handleToggle}
                className="p-2.5 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-zinc-800 transition-all shadow-xs group"
                title="Expand menu (Ctrl+B)"
                aria-label="Expand sidebar menu"
              >
                <PanelLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-2.5 shrink-0">
          {isOpen ? (
            <button
              onClick={() => {
                onNewChat();
                onSelectTab('journal');
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 hover:border-zinc-700 transition-all text-xs font-semibold tracking-tight shadow-xs group"
            >
              <div className="flex items-center gap-2.5">
                <SquarePen className="w-4 h-4 text-zinc-300 group-hover:text-amber-400 transition-colors" />
                <span>New chat</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">⌘K</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onNewChat();
                onSelectTab('journal');
              }}
              className="w-full p-2.5 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-800 transition-colors"
              title="New chat"
            >
              <SquarePen className="w-4 h-4 text-zinc-300" />
            </button>
          )}
        </div>

        {/* Search Input Filter */}
        {isOpen && showSearch && (
          <div className="px-3 pb-2 shrink-0 animate-fadeIn">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats & tasks..."
                className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Primary Nav List */}
        <div className="px-2 py-1 space-y-0.5 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                } ${!isOpen ? 'justify-center px-0' : ''}`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                {isOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </div>

        {/* Recents / Saved Chats List */}
        {isOpen && (
          <div className="flex-1 overflow-y-auto px-2 pt-3 border-t border-zinc-800/60 no-scrollbar">
            <div className="flex items-center justify-between px-3 py-1 mb-1">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                Recents
              </span>
              {entries.length > 0 && onClearAllEntries && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all saved chats and reflections?')) {
                      onClearAllEntries();
                    }
                  }}
                  className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors"
                  title="Clear all saved chats"
                >
                  Clear all
                </button>
              )}
            </div>

            {filteredEntries.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-zinc-600">
                {searchQuery ? 'No matching chats' : 'No saved chats yet'}
              </div>
            ) : (
              <div className="space-y-0.5 pb-3">
                {filteredEntries.map((entry) => {
                  const isSelected = activeTab === 'journal' && currentEntryId === entry.id;
                  const isDeleting = entryToDelete === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-zinc-800/90 text-zinc-100 font-medium'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70'
                      }`}
                      onClick={() => {
                        onSelectEntry(entry);
                        onSelectTab('journal');
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
                        <span className="truncate">
                          {entry.title || (entry.content ? entry.content.slice(0, 24) : 'Untitled reflection')}
                        </span>
                      </div>

                      {/* Hover action: Delete single chat */}
                      <div 
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isDeleting ? (
                          <div className="flex items-center gap-1 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-700">
                            <button
                              onClick={() => {
                                onDeleteEntry(entry.id);
                                setEntryToDelete(null);
                              }}
                              className="p-1 text-rose-400 hover:text-rose-300"
                              title="Confirm delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEntryToDelete(null)}
                              className="p-1 text-zinc-400 hover:text-zinc-200"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEntryToDelete(entry.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* User Account Footer */}
        <div className="p-2 border-t border-zinc-800/80 shrink-0 relative">
          {isOpen ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900/80 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userName}
                      className="w-8 h-8 rounded-full border border-zinc-700 object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {getInitials(user.displayName, user.email)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-zinc-200 truncate">
                      {userName}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      Personal account
                    </div>
                  </div>
                </div>

                <div className="px-2 py-0.5 text-[10px] font-medium bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 shrink-0">
                  Settings
                </div>
              </button>

              {/* User Menu Popover */}
              {showUserMenu && (
                <>
                  <div
                    onClick={() => setShowUserMenu(false)}
                    className="fixed inset-0 z-10"
                  />
                  <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-20 space-y-1 animate-fadeIn text-xs">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 text-zinc-400" />
                      <span>Settings &amp; Preferences</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenThreatModel();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Security &amp; Threat Model</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenDeleteData();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors text-left"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear all account data</span>
                    </button>

                    <div className="h-px bg-zinc-800 my-1" />

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                onClick={onOpenSettings}
                className="w-9 h-9 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-300 hover:text-zinc-100 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
