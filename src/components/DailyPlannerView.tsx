import React, { useState, useEffect } from 'react';
import { 
  Workflow, 
  Sparkles, 
  RotateCw, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  Download, 
  Copy, 
  Check, 
  Play, 
  Flame, 
  Zap, 
  Coffee, 
  Share2,
  ListTodo,
  AlertTriangle,
  ArrowRight,
  Sun
} from 'lucide-react';
import { DailyPlan, ScheduleBlock, TaskItem, ExtractedEvent, UserPreferences, DailyReview } from '../types';

interface DailyPlannerViewProps {
  currentPlan: DailyPlan | null;
  tasks: TaskItem[];
  events: ExtractedEvent[];
  userTimezone: string;
  onSavePlan: (plan: DailyPlan) => Promise<void>;
  onClearPlan?: () => Promise<void>;
  onStartFocus: (title: string, taskId?: string) => void;
  userPreferences?: UserPreferences;
  dailyReviews?: DailyReview[];
}

export const DailyPlannerView: React.FC<DailyPlannerViewProps> = ({
  currentPlan,
  tasks,
  events,
  userTimezone,
  onSavePlan,
  onClearPlan,
  onStartFocus,
  userPreferences,
  dailyReviews = [],
}) => {
  // Check for today's morning brief
  const latestBrief = dailyReviews.find((r) => r.type === 'morning_brief');
  const briefData = latestBrief?.morningBriefData || latestBrief?.morningBrief;
  // Plan generator form state
  const [focusGoal, setFocusGoal] = useState('');
  const [workdayStart, setWorkdayStart] = useState(userPreferences?.workdayStart || '09:00');
  const [workdayEnd, setWorkdayEnd] = useState(userPreferences?.workdayEnd || '18:00');
  const [energyPacing, setEnergyPacing] = useState<'morning_heavy' | 'balanced' | 'afternoon_heavy'>('balanced');
  const [isGenerating, setIsGenerating] = useState(false);

  // Preference tradeoffs from AI
  const [tradeoffs, setTradeoffs] = useState<Array<{
    preference: string;
    conflictReason: string;
    alternative: string;
    suggestedBlock?: any;
  }>>([]);

  // Sync with preferences if updated
  useEffect(() => {
    if (userPreferences?.workdayStart) setWorkdayStart(userPreferences.workdayStart);
    if (userPreferences?.workdayEnd) setWorkdayEnd(userPreferences.workdayEnd);
    if (userPreferences?.planningStyle && ['morning_heavy', 'balanced', 'afternoon_heavy'].includes(userPreferences.planningStyle)) {
      setEnergyPacing(userPreferences.planningStyle as any);
    }
  }, [userPreferences]);

  // Adaptive Rescheduling state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [disruptionReason, setDisruptionReason] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleResult, setRescheduleResult] = useState<{
    summary: string;
    adjustmentsMade: string[];
  } | null>(null);

  // Copy plan state
  const [hasCopied, setHasCopied] = useState(false);

  const handleGeneratePlan = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch('/api/gemini/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          events,
          workdayStart: userPreferences?.workdayStart || workdayStart,
          workdayEnd: userPreferences?.workdayEnd || workdayEnd,
          energyPacing: (userPreferences?.planningStyle as any) || energyPacing,
          timezone: userPreferences?.timezone || userTimezone,
          focusGoal: focusGoal.trim(),
          preferences: userPreferences,
        }),
      });

      if (!res.ok) throw new Error('Daily planning generation failed');
      const data = await res.json();

      if (Array.isArray(data.preferenceTradeoffs)) {
        setTradeoffs(data.preferenceTradeoffs);
      } else {
        setTradeoffs([]);
      }

      const newPlan: DailyPlan = {
        id: currentPlan?.id || `plan_${Date.now()}`,
        userId: '',
        dateStr: new Date().toISOString().split('T')[0],
        blocks: data.blocks || [],
        summary: data.summary || 'Optimized daily plan generated.',
        energyStrategy: data.energyStrategy || 'Structured around deep work slots.',
        totalFocusMinutes: data.totalFocusMinutes || 180,
        totalBreakMinutes: data.totalBreakMinutes || 45,
        createdAt: currentPlan?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      await onSavePlan(newPlan);
    } catch (err: any) {
      alert(`Failed to generate daily plan: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptAlternative = async (tradeoffIndex: number) => {
    if (!currentPlan) return;
    const item = tradeoffs[tradeoffIndex];
    if (!item?.suggestedBlock) return;

    const newBlock: ScheduleBlock = {
      id: `alt_${Date.now()}`,
      title: item.suggestedBlock.title || 'Alternative Session',
      startTime: item.suggestedBlock.startTime || '14:00',
      endTime: item.suggestedBlock.endTime || '15:00',
      type: item.suggestedBlock.type || 'focus',
      priority: 'high',
      description: item.alternative,
      completed: false,
    };

    const updatedBlocks = [...currentPlan.blocks, newBlock].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );

    await onSavePlan({
      ...currentPlan,
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });

    // Remove accepted tradeoff
    setTradeoffs((prev) => prev.filter((_, idx) => idx !== tradeoffIndex));
  };

  const handleAdaptiveReschedule = async () => {
    if (!currentPlan || !disruptionReason.trim()) return;

    try {
      setIsRescheduling(true);
      const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const res = await fetch('/api/gemini/adaptive-reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentBlocks: currentPlan.blocks,
          disruptionReason: disruptionReason.trim(),
          currentTime: currentTimeStr,
          workdayEnd,
          timezone: userTimezone,
        }),
      });

      if (!res.ok) throw new Error('Adaptive rescheduling failed');
      const data = await res.json();

      const updatedPlan: DailyPlan = {
        ...currentPlan,
        blocks: data.blocks || currentPlan.blocks,
        summary: data.summary || currentPlan.summary,
        updatedAt: Date.now(),
      };

      await onSavePlan(updatedPlan);
      setRescheduleResult({
        summary: data.summary,
        adjustmentsMade: data.adjustmentsMade || ['Schedule re-indexed to current local time.'],
      });
      setDisruptionReason('');
    } catch (err: any) {
      alert(`Rescheduling failed: ${err.message}`);
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleToggleBlockCompletion = async (blockId: string) => {
    if (!currentPlan) return;
    const updatedBlocks = currentPlan.blocks.map((b) =>
      b.id === blockId ? { ...b, completed: !b.completed } : b
    );
    await onSavePlan({
      ...currentPlan,
      blocks: updatedBlocks,
      updatedAt: Date.now(),
    });
  };

  const copyPlanMarkdown = () => {
    if (!currentPlan) return;
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    let md = `# Daily Plan — ${date}\n\n`;
    md += `**Strategy**: ${currentPlan.summary}\n`;
    md += `**Energy Pacing**: ${currentPlan.energyStrategy}\n\n`;
    md += `## Time Blocks\n\n`;
    currentPlan.blocks.forEach((b) => {
      md += `- [${b.completed ? 'x' : ' '}] **${b.startTime} - ${b.endTime}** | ${b.title} (${b.type.toUpperCase()})${b.description ? ` — ${b.description}` : ''}\n`;
    });
    navigator.clipboard.writeText(md);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="space-y-8 text-zinc-100 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-blue-400" />
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
              AI Daily Planner
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Gemini creates a realistic time-blocked schedule and adapts it when unexpected delays occur.
          </p>
        </div>

        {currentPlan && (
          <div className="flex items-center gap-2 shrink-0">
            {onClearPlan && (
              <button
                onClick={() => {
                  if (window.confirm('Clear current daily plan schedule?')) {
                    onClearPlan();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-400 rounded-xl text-xs font-medium transition-colors"
                title="Clear current schedule"
              >
                <span>Clear Plan</span>
              </button>
            )}

            <button
              onClick={copyPlanMarkdown}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium transition-all"
              title="Copy Plan as Markdown"
            >
              {hasCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{hasCopied ? 'Copied' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={() => setShowRescheduleModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Adapt Schedule</span>
            </button>
          </div>
        )}
      </div>

      {/* Plan Generation Config Card */}
      <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-4 shadow-xl">
        {/* Morning Briefing Insight Callout */}
        {latestBrief && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <Sun className="w-3.5 h-3.5" />
                <span>Morning Briefing Insight</span>
              </div>
              <p className="text-xs text-zinc-300 line-clamp-1 font-medium">
                {latestBrief.headline}
              </p>
              {briefData?.priorities?.[0] && (
                <p className="text-[11px] text-zinc-400">
                  Priority: {briefData.priorities[0].title} &mdash; {briefData.priorities[0].reason}
                </p>
              )}
            </div>

            {briefData?.priorities?.[0] && (
              <button
                type="button"
                onClick={() => setFocusGoal(briefData.priorities?.[0]?.title || '')}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-semibold shrink-0 transition-all active:scale-95 shadow-xs"
              >
                Use as Focus Goal
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-zinc-400" />
            <span>Plan Parameters</span>
          </div>
          <span className="text-xs text-zinc-500">
            {pendingTasksCount} candidate tasks available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Today's Main Goal / Focus Intent (Optional)
            </label>
            <input
              type="text"
              value={focusGoal}
              onChange={(e) => setFocusGoal(e.target.value)}
              placeholder="e.g. Ship the client design deliverable before 4 PM"
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
              Energy Pacing
            </label>
            <select
              value={energyPacing}
              onChange={(e) => setEnergyPacing(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
            >
              <option value="morning_heavy">Morning Heavy (Deep work early)</option>
              <option value="balanced">Balanced (Steady flow)</option>
              <option value="afternoon_heavy">Afternoon Heavy (Evening focus)</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Start
              </label>
              <input
                type="time"
                value={workdayStart}
                onChange={(e) => setWorkdayStart(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                End
              </label>
              <input
                type="time"
                value={workdayEnd}
                onChange={(e) => setWorkdayEnd(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="px-5 py-3 rounded-xl bg-zinc-100 hover:bg-white text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-black ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Synthesizing Optimal Plan...' : currentPlan ? 'Regenerate Plan with Gemini' : 'Generate Daily Plan with Gemini'}</span>
          </button>
        </div>
      </div>

      {/* Adaptive Reschedule Dialog / Panel */}
      {showRescheduleModal && (
        <div className="p-6 bg-zinc-950 border border-amber-500/30 rounded-3xl space-y-4 animate-fadeIn shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 text-lg font-semibold tracking-tight">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>Adaptive Rescheduling (Circumstance Change)</span>
            </div>
            <button
              onClick={() => setShowRescheduleModal(false)}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Close
            </button>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Running late? Unexpected meeting appeared? Tell Gemini what changed and your remaining schedule will be re-optimized without losing track of your top priorities.
          </p>

          <div className="space-y-3">
            <input
              type="text"
              value={disruptionReason}
              onChange={(e) => setDisruptionReason(e.target.value)}
              placeholder="e.g. 'I am running 45 minutes late' or 'A surprise client call was booked at 2 PM'"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleAdaptiveReschedule}
                disabled={isRescheduling || !disruptionReason.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black disabled:opacity-50 flex items-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRescheduling ? 'animate-spin' : ''}`} />
                <span>{isRescheduling ? 'Adapting Plan...' : 'Recalculate Remaining Day'}</span>
              </button>
            </div>
          </div>

          {rescheduleResult && (
            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2 mt-3">
              <div className="text-xs font-semibold text-emerald-400">
                Plan Adapted Successfully
              </div>
              <p className="text-xs text-zinc-300">{rescheduleResult.summary}</p>
              <ul className="text-[11px] text-zinc-400 space-y-1 list-disc pl-4">
                {rescheduleResult.adjustmentsMade.map((adj, i) => (
                  <li key={i}>{adj}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Plan Display Section */}
      {currentPlan ? (
        <div className="space-y-6">
          {/* Preference Tradeoffs Resolution Banner */}
          {tradeoffs.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Preference Conflicts Detected &amp; Resolved</span>
              </div>
              <p className="text-xs text-zinc-300">
                Some configured preferences could not be fully satisfied due to schedule constraints. Gemini formulated realistic alternatives:
              </p>
              <div className="space-y-2">
                {tradeoffs.map((item, idx) => (
                  <div key={idx} className="p-3.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-semibold text-zinc-200">{item.preference}</div>
                      <div className="text-rose-300 text-[11px] mt-0.5">Conflict: {item.conflictReason}</div>
                      <div className="text-emerald-300 text-[11px] mt-0.5">Proposed Alternative: {item.alternative}</div>
                    </div>
                    {item.suggestedBlock && (
                      <button
                        onClick={() => handleAcceptAlternative(idx)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Alternative</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Banner */}
          <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Daily Strategy
              </div>
              <div className="text-base font-semibold text-zinc-200 tracking-tight">
                {currentPlan.summary}
              </div>
              <div className="text-xs text-zinc-400">
                {currentPlan.energyStrategy}
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 font-mono text-xs text-zinc-400">
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
                ⚡ Focus: {currentPlan.totalFocusMinutes}m
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
                ☕ Breaks: {currentPlan.totalBreakMinutes}m
              </span>
            </div>
          </div>

          {/* Time Blocks Timeline */}
          <div className="space-y-3">
            {currentPlan.blocks.map((block) => {
              const isBreak = block.type === 'break';
              const isMeeting = block.type === 'meeting';
              const isFocus = block.type === 'focus' || block.type === 'task';

              return (
                <div
                  key={block.id}
                  className={`p-4 sm:p-5 rounded-3xl border transition-all ${
                    block.completed
                      ? 'bg-zinc-900/40 border-zinc-800/60 opacity-60'
                      : isBreak
                      ? 'bg-zinc-900/30 border-zinc-800/60'
                      : isMeeting
                      ? 'bg-blue-950/20 border-blue-900/40'
                      : 'bg-[#0F0F0F] border-zinc-800 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleToggleBlockCompletion(block.id)}
                        className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                          block.completed
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'
                        }`}
                      >
                        {block.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-200">
                            {block.startTime} – {block.endTime}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isBreak
                              ? 'bg-zinc-800 text-zinc-400'
                              : isMeeting
                              ? 'bg-blue-900/40 text-blue-300 border border-blue-800/40'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          }`}>
                            {block.type}
                          </span>
                          {block.priority && (
                            <span className="text-[10px] text-zinc-500 uppercase font-mono">
                              {block.priority}
                            </span>
                          )}
                        </div>

                        <h4 className={`text-base font-medium tracking-tight ${block.completed ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                          {block.title}
                        </h4>

                        {block.description && (
                          <p className="text-xs text-zinc-400 font-sans">
                            {block.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isFocus && !block.completed && (
                      <button
                        onClick={() => onStartFocus(block.title, block.taskId)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                        title="Start focus timer for this block"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">Start Focus</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-16 text-center bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-3">
          <Workflow className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-xl font-semibold text-zinc-200 tracking-tight">
            No Daily Plan Generated Yet
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Click "Generate Daily Plan with Gemini" above to automatically synthesize your pending tasks, meetings, and energy into an optimal, time-blocked day.
          </p>
        </div>
      )}
    </div>
  );
};
