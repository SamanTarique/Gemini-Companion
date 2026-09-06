import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckSquare, 
  Square, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Tag, 
  Target, 
  TrendingUp, 
  Check, 
  X, 
  ArrowRight,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { 
  DetectedActionItem, 
  JournalAnalysisResult, 
  TaskItem, 
  CalendarEvent, 
  PriorityLevel 
} from '../types';

interface JournalAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: JournalAnalysisResult | null;
  isLoading: boolean;
  onApproveAndSync: (selectedItems: DetectedActionItem[]) => Promise<void>;
  existingTasks: TaskItem[];
  existingEvents: CalendarEvent[];
  journalTitle: string;
}

export const JournalAnalysisModal: React.FC<JournalAnalysisModalProps> = ({
  isOpen,
  onClose,
  analysis,
  isLoading,
  onApproveAndSync,
  existingTasks,
  existingEvents,
  journalTitle,
}) => {
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'task' | 'event' | 'deadline'>('all');

  // Combine tasks, events, and deadlines into a flat detected list
  const allDetectedActions: DetectedActionItem[] = React.useMemo(() => {
    if (!analysis) return [];
    const tasks = analysis.tasks || [];
    const events = analysis.events || [];
    const deadlines = analysis.deadlines || [];
    return [...tasks, ...events, ...deadlines];
  }, [analysis]);

  // Initialize selected IDs when analysis arrives
  React.useEffect(() => {
    if (analysis) {
      const initialSelected = new Set<string>();
      allDetectedActions.forEach((item) => {
        // Only select by default if not an obvious duplicate
        const isDuplicateTask = existingTasks.some(
          (t) => t.title.trim().toLowerCase() === item.title.trim().toLowerCase()
        );
        const isDuplicateEvent = existingEvents.some(
          (e) => e.title.trim().toLowerCase() === item.title.trim().toLowerCase()
        );
        if (!isDuplicateTask && !isDuplicateEvent) {
          initialSelected.add(item.id);
        }
      });
      setSelectedItemIds(initialSelected);
    }
  }, [analysis, existingTasks, existingEvents]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set<string>();
    filteredActions.forEach((item) => next.add(item.id));
    setSelectedItemIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setEditedTitles((prev) => ({ ...prev, [id]: newTitle }));
  };

  const handleConfirmSync = async () => {
    if (selectedItemIds.size === 0) return;
    try {
      setIsSyncing(true);
      const itemsToSync = allDetectedActions
        .filter((item) => selectedItemIds.has(item.id))
        .map((item) => ({
          ...item,
          title: editedTitles[item.id] || item.title,
        }));
      await onApproveAndSync(itemsToSync);
      onClose();
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredActions = allDetectedActions.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.type === activeFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#0F0F0F] border border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-start justify-between gap-4 bg-zinc-950/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight">
                AI Journal Analysis &amp; Action Approval
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Review and approve detected commitments from &ldquo;{journalTitle || 'Untitled Entry'}&rdquo; before updating your workspace.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-zinc-300">
                Analyzing journal reflections with Gemini...
              </p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Detecting goals, actionable tasks, recurring behavioral patterns, and schedule commitments.
              </p>
            </div>
          ) : !analysis ? (
            <div className="py-16 text-center text-zinc-400 text-sm">
              No analysis data available. Please try running the analysis again.
            </div>
          ) : (
            <>
              {/* Goals & Recurring Themes */}
              {((analysis.goals && analysis.goals.length > 0) || (analysis.recurringThemes && analysis.recurringThemes.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {analysis.goals && analysis.goals.length > 0 && (
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <Target className="w-3.5 h-3.5 text-blue-400" />
                        <span>Identified Goals &amp; Intentions</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {analysis.goals.map((goal, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium"
                          >
                            {goal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.recurringThemes && analysis.recurringThemes.length > 0 && (
                    <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
                        <Tag className="w-3.5 h-3.5 text-purple-400" />
                        <span>Recurring Themes</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {analysis.recurringThemes.map((theme, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium"
                          >
                            #{theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Observed Behavioral Patterns */}
              {analysis.patterns && analysis.patterns.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2.5">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>Observed Patterns &amp; Guidance</span>
                  </div>
                  <div className="space-y-2">
                    {analysis.patterns.map((pat, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs space-y-1">
                        <div className="font-semibold text-zinc-200">{pat.theme || pat.tag}</div>
                        <p className="text-zinc-400 leading-relaxed">{pat.description}</p>
                        {pat.suggestion && (
                          <div className="text-[11px] text-amber-300/90 flex items-start gap-1 mt-1">
                            <span className="font-semibold shrink-0">Tip:</span>
                            <span>{pat.suggestion}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items Pending Approval */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Detected Actions for Your Approval ({selectedItemIds.size}/{allDetectedActions.length})
                    </h3>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`px-2 py-1 text-[11px] rounded-lg transition-colors ${
                        activeFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      All ({allDetectedActions.length})
                    </button>
                    <button
                      onClick={() => setActiveFilter('task')}
                      className={`px-2 py-1 text-[11px] rounded-lg transition-colors ${
                        activeFilter === 'task' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Tasks ({allDetectedActions.filter((i) => i.type === 'task').length})
                    </button>
                    <button
                      onClick={() => setActiveFilter('event')}
                      className={`px-2 py-1 text-[11px] rounded-lg transition-colors ${
                        activeFilter === 'event' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Events ({allDetectedActions.filter((i) => i.type === 'event').length})
                    </button>
                    <button
                      onClick={() => setActiveFilter('deadline')}
                      className={`px-2 py-1 text-[11px] rounded-lg transition-colors ${
                        activeFilter === 'deadline' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Deadlines ({allDetectedActions.filter((i) => i.type === 'deadline').length})
                    </button>
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                  <span>Only checked items will be added to your Tasks or Calendar.</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-amber-400 hover:text-amber-300 font-medium"
                    >
                      Select All
                    </button>
                    <span>&bull;</span>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-zinc-400 hover:text-zinc-300 font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {filteredActions.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 italic bg-zinc-950/40 rounded-2xl border border-zinc-800/80">
                    No action items detected in this category.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {filteredActions.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const titleToDisplay = editedTitles[item.id] ?? item.title;
                      const isDuplicateTask = existingTasks.some(
                        (t) => t.title.trim().toLowerCase() === titleToDisplay.trim().toLowerCase()
                      );
                      const isDuplicateEvent = existingEvents.some(
                        (e) => e.title.trim().toLowerCase() === titleToDisplay.trim().toLowerCase()
                      );
                      const isDuplicate = isDuplicateTask || isDuplicateEvent;

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isSelected
                              ? 'bg-zinc-900 border-zinc-700 shadow-sm'
                              : 'bg-zinc-950/50 border-zinc-800/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSelect(item.id)}
                              className="mt-0.5 text-zinc-400 hover:text-zinc-200 shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0 space-y-1.5">
                              {editingId === item.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={titleToDisplay}
                                    onChange={(e) => handleTitleChange(item.id, e.target.value)}
                                    className="flex-1 px-2 py-1 text-xs bg-zinc-950 border border-amber-500/50 rounded-lg text-zinc-100 focus:outline-none"
                                    autoFocus
                                    onBlur={() => setEditingId(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') setEditingId(null);
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="p-1 text-xs text-zinc-400 hover:text-zinc-200"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-medium text-zinc-200 break-words leading-relaxed">
                                    {titleToDisplay}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(item.id)}
                                    className="text-zinc-500 hover:text-zinc-300 p-0.5 shrink-0"
                                    title="Edit title"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* Badges and metadata */}
                              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                <span
                                  className={`px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                                    item.type === 'event'
                                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                                      : item.type === 'deadline'
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  }`}
                                >
                                  {item.type}
                                </span>

                                {item.priority && item.priority !== 'medium' && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded font-medium ${
                                      item.priority === 'critical' || item.priority === 'high'
                                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                        : 'bg-zinc-800 text-zinc-400'
                                    }`}
                                  >
                                    {item.priority}
                                  </span>
                                )}

                                {(item.dueDate || item.dueTime || item.startTime) && (
                                  <span className="flex items-center gap-1 text-zinc-400">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {item.dueDate || ''} {item.dueTime || item.startTime || ''}
                                    </span>
                                  </span>
                                )}

                                {isDuplicate && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 text-[10px] font-medium">
                                    Already in workspace
                                  </span>
                                )}
                              </div>

                              {item.contextSnippet && (
                                <p className="text-[11px] text-zinc-400 italic border-l-2 border-zinc-700 pl-2">
                                  &ldquo;{item.contextSnippet}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-950/70">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Actions will be linked directly to this journal entry.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 transition-colors"
            >
              Dismiss
            </button>

            <button
              type="button"
              onClick={handleConfirmSync}
              disabled={isSyncing || selectedItemIds.size === 0}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 transition-all flex items-center gap-1.5 font-bold shadow-md shadow-amber-500/10"
            >
              {isSyncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Approve &amp; Sync ({selectedItemIds.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
