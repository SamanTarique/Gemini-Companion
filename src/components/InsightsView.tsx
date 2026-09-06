import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  Sun, 
  Moon, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  CalendarDays,
  Target,
  Brain,
  History,
  Trash2,
  CloudSun,
  ListOrdered,
  XCircle,
  Lightbulb,
  Check
} from 'lucide-react';
import { 
  TaskItem, 
  FocusSession, 
  DailyReview, 
  JournalEntry, 
  UserPreferences, 
  WeatherData,
  CalendarEvent,
  StrategicInsights
} from '../types';
import { searchSemanticMemories } from '../services/memoryService';

interface InsightsViewProps {
  tasks: TaskItem[];
  calendarEvents?: CalendarEvent[];
  focusSessions: FocusSession[];
  entries: JournalEntry[];
  dailyReviews: DailyReview[];
  userTimezone: string;
  preferences?: UserPreferences;
  weather?: WeatherData | null;
  onSaveDailyReview: (review: DailyReview) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  onPlanDay?: () => void;
  onDeleteDailyReview?: (reviewId: string) => Promise<void>;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  tasks,
  calendarEvents = [],
  focusSessions,
  entries,
  dailyReviews,
  userTimezone,
  preferences,
  weather,
  onSaveDailyReview,
  onUpdateTask,
  onNavigateTab,
  onPlanDay,
  onDeleteDailyReview,
}) => {
  // Navigation sub-tab
  const [activeTab, setActiveTab] = useState<'daily_brief' | 'strategic_horizon' | 'archive'>('daily_brief');

  // Daily Brief & Evening Review State
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [activeReviewType, setActiveReviewType] = useState<'morning_brief' | 'evening_review'>('morning_brief');
  const [currentReview, setCurrentReview] = useState<DailyReview | null>(dailyReviews[0] || null);
  const [selectedIncompleteTasks, setSelectedIncompleteTasks] = useState<string[]>([]);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null);

  // Strategic Insights State
  const [insightPeriod, setInsightPeriod] = useState<'daily' | 'weekly'>('daily');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [strategicInsights, setStrategicInsights] = useState<StrategicInsights | null>(null);
  const [dismissedCards, setDismissedCards] = useState<string[]>([]);

  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);
  const overdueTasks = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]);
  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);

  // Handle Morning Brief or Evening Review generation
  const handleGenerateReview = async (type: 'morning_brief' | 'evening_review') => {
    try {
      setIsGeneratingBrief(true);
      setActiveReviewType(type);
      setRescheduleSuccess(null);

      // Gather relevant memories if memory enabled
      let retrievedMemories: any[] = [];
      if (preferences?.aiMemoryEnabled && entries.length > 0) {
        try {
          const userUid = entries[0]?.userId || 'anonymous';
          const queryText = type === 'morning_brief' 
            ? 'daily goals priorities commitments focus' 
            : 'accomplishments friction wind-down reflection';
          retrievedMemories = await searchSemanticMemories({
            query: queryText,
            userId: userUid,
            topK: 3,
          });
        } catch (e) {
          console.warn('Memory retrieval skipped for review:', e);
        }
      }

      const res = await fetch('/api/gemini/daily-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          completedTasks: completedTasks.slice(0, 20),
          pendingTasks: pendingTasks.slice(0, 20),
          calendarEvents: calendarEvents.slice(0, 10),
          focusMinutes: totalFocusMinutes,
          mood: entries[0]?.mood || 'focused',
          timezone: userTimezone,
          weather: weather ? {
            tempC: weather.tempC,
            condition: weather.condition,
            windKph: weather.windKph,
          } : undefined,
          preferences: preferences ? {
            workStartHour: preferences.workStartHour,
            workEndHour: preferences.workEndHour,
            quietHoursStart: preferences.quietHoursStart,
            quietHoursEnd: preferences.quietHoursEnd,
          } : undefined,
          retrievedMemories: retrievedMemories.slice(0, 3).map((m) => ({
            title: m.title,
            content: m.content,
            tags: m.tags,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate review');
      }

      const data = await res.json();

      const newReview: DailyReview = {
        id: `review_${Date.now()}`,
        userId: '',
        dateStr: new Date().toISOString().split('T')[0],
        type,
        headline: data.headline || (type === 'morning_brief' ? 'Morning Focus Briefing' : 'Evening Synthesis'),
        summary: data.summary || '',
        highlights: data.highlights || [],
        recommendations: data.recommendations || [],
        productivityScore: data.productivityScore || 85,
        createdAt: Date.now(),
        morningBrief: type === 'morning_brief' ? data.morningBrief : undefined,
        eveningReview: type === 'evening_review' ? data.eveningReview : undefined,
      };

      setCurrentReview(newReview);
      await onSaveDailyReview(newReview);
    } catch (err: any) {
      alert(`Error generating review: ${err.message}`);
    } finally {
      setIsGeneratingBrief(false);
    }
  };

  // Handle Strategic Insights generation
  const handleGenerateStrategicInsights = async (period: 'daily' | 'weekly') => {
    try {
      setIsGeneratingInsights(true);
      setInsightPeriod(period);

      let retrievedMemories: any[] = [];
      if (preferences?.aiMemoryEnabled && entries.length > 0) {
        try {
          const userUid = entries[0]?.userId || 'anonymous';
          retrievedMemories = await searchSemanticMemories({
            query: period === 'weekly' ? 'weekly goals milestones recurring habits' : 'daily priorities progress patterns',
            userId: userUid,
            topK: 4,
          });
        } catch (e) {
          console.warn('Memory search skipped for strategic insights:', e);
        }
      }

      const res = await fetch('/api/gemini/insights-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          tasks: tasks.slice(0, 30),
          focusMinutes: totalFocusMinutes,
          journalEntries: entries.slice(0, 10).map((e) => ({
            title: e.title,
            content: e.content,
            mood: e.mood,
            tags: e.tags,
            createdAt: e.createdAt,
          })),
          retrievedMemories: retrievedMemories.slice(0, 4).map((m) => ({
            title: m.title,
            content: m.content,
            tags: m.tags,
          })),
          timezone: userTimezone,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate strategic insights');
      }

      const data: StrategicInsights = await res.json();
      setStrategicInsights(data);
      setDismissedCards([]);
    } catch (err: any) {
      alert(`Strategic insights error: ${err.message}`);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Reschedule selected incomplete tasks to tomorrow
  const handleRescheduleSelected = async () => {
    if (!onUpdateTask || selectedIncompleteTasks.length === 0) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    try {
      for (const taskId of selectedIncompleteTasks) {
        await onUpdateTask(taskId, {
          dueDate: tomorrowStr,
        });
      }
      setRescheduleSuccess(`Rescheduled ${selectedIncompleteTasks.length} task(s) to tomorrow (${tomorrowStr}).`);
      setSelectedIncompleteTasks([]);
    } catch (err: any) {
      alert(`Error rescheduling tasks: ${err.message}`);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedIncompleteTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const isCardDismissed = (cardId: string) => dismissedCards.includes(cardId);
  const dismissCard = (cardId: string) => {
    setDismissedCards((prev) => [...prev, cardId]);
  };

  return (
    <div className="space-y-8 text-zinc-100 animate-fadeIn max-w-6xl mx-auto w-full pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
              AI Productivity Insights &amp; Reviews
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Gemini-powered Morning Briefings, Evening Reflections, and Strategic Horizon Insights.
          </p>
        </div>

        {/* View Sub-Tabs */}
        <div className="inline-flex p-1 rounded-2xl bg-[#0F0F0F] border border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveTab('daily_brief')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'daily_brief'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Daily Brief &amp; Review</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('strategic_horizon');
              if (!strategicInsights && !isGeneratingInsights) {
                handleGenerateStrategicInsights(insightPeriod);
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'strategic_horizon'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Strategic Horizon</span>
          </button>
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-zinc-400" />
            <span>Archive ({dailyReviews.length})</span>
          </button>
        </div>
      </div>

      {/* 4 Core Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Tasks Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-semibold text-zinc-100 tracking-tight">
            {completedTasks.length}
          </div>
          <div className="text-[10px] text-zinc-500">
            {tasks.length > 0 
              ? `${Math.round((completedTasks.length / tasks.length) * 100)}% completion rate (${pendingTasks.length} pending)` 
              : 'No tasks scheduled'}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Focus Logged</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-semibold text-zinc-100 tracking-tight">
            {totalFocusMinutes}m
          </div>
          <div className="text-[10px] text-zinc-500">
            {focusSessions.length} total deep work sessions
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Journal Reflections</span>
            <Brain className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-semibold text-zinc-100 tracking-tight">
            {entries.length}
          </div>
          <div className="text-[10px] text-zinc-500">
            {preferences?.aiMemoryEnabled ? 'Linked to long-term memory' : 'Local reflections'}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Productivity Index</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-semibold text-emerald-400 tracking-tight">
            {currentReview?.productivityScore || 85}/100
          </div>
          <div className="text-[10px] text-zinc-500">
            Momentum evaluated by AI
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: Daily Brief & Evening Review */}
      {activeTab === 'daily_brief' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 bg-[#0F0F0F] border border-zinc-800 rounded-3xl shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                  <span>AI Daily Briefing &amp; Evening Review</span>
                  {weather && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-zinc-900 border border-zinc-800 text-zinc-400">
                      <CloudSun className="w-3 h-3 text-amber-400" />
                      <span>{weather.tempC}°C, {weather.condition}</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Synthesize your calendar, tasks, weather context, and reflections into an actionable plan or restful review.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateReview('morning_brief')}
                  disabled={isGeneratingBrief}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Sun className="w-4 h-4" />
                  <span>Generate Morning Brief</span>
                </button>

                <button
                  onClick={() => handleGenerateReview('evening_review')}
                  disabled={isGeneratingBrief}
                  className="px-4 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Moon className="w-4 h-4" />
                  <span>Generate Evening Review</span>
                </button>
              </div>
            </div>

            {isGeneratingBrief ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-zinc-400 font-mono">
                  Synthesizing schedule, tasks, weather buffers, and momentum with Gemini...
                </p>
              </div>
            ) : currentReview ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Header Tag */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      currentReview.type === 'morning_brief'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                    }`}>
                      {currentReview.type === 'morning_brief' ? 'Morning Briefing' : 'Evening Synthesis'}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {currentReview.dateStr}
                    </span>
                  </div>

                  {currentReview.type === 'morning_brief' && onPlanDay && (
                    <button
                      onClick={onPlanDay}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Apply to Daily Planner</span>
                    </button>
                  )}
                </div>

                {/* Headline & Summary */}
                <div>
                  <h4 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                    {currentReview.headline}
                  </h4>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans mt-2">
                    {currentReview.summary}
                  </p>
                </div>

                {/* MORNING BRIEF SPECIFIC SECTIONS */}
                {currentReview.type === 'morning_brief' && currentReview.morningBrief && (
                  <div className="space-y-6 pt-2">
                    {/* Top Priorities */}
                    {currentReview.morningBrief.priorities && currentReview.morningBrief.priorities.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-amber-400" />
                          <span>Top Priorities for Today</span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {currentReview.morningBrief.priorities.map((p, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  p.priority === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                                  p.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                                  'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                }`}>
                                  {p.priority}
                                </span>
                                {p.estimatedMinutes && (
                                  <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {p.estimatedMinutes}m
                                  </span>
                                )}
                              </div>
                              <h6 className="text-sm font-semibold text-zinc-200">{p.title}</h6>
                              <p className="text-xs text-zinc-400 leading-relaxed">{p.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conflicts & Weather Buffers */}
                    {((currentReview.morningBrief.potentialConflicts && currentReview.morningBrief.potentialConflicts.length > 0) ||
                      currentReview.morningBrief.travelOrWeatherContext) && (
                      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Schedule Advisory &amp; Context</span>
                        </div>
                        {currentReview.morningBrief.travelOrWeatherContext && (
                          <p className="text-xs text-zinc-300">
                            <strong>Weather &amp; Travel:</strong> {currentReview.morningBrief.travelOrWeatherContext}
                          </p>
                        )}
                        {currentReview.morningBrief.potentialConflicts && currentReview.morningBrief.potentialConflicts.map((c, i) => (
                          <p key={i} className="text-xs text-zinc-400 pl-2 border-l-2 border-amber-500/40">
                            {typeof c === 'string' ? c : `${c.description}${c.recommendation ? ` - ${c.recommendation}` : ''}`}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Suggested Sequence */}
                    {currentReview.morningBrief.suggestedSequence && currentReview.morningBrief.suggestedSequence.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                          <ListOrdered className="w-4 h-4 text-emerald-400" />
                          <span>Suggested Flow of the Day</span>
                        </h5>
                        <div className="space-y-2">
                          {currentReview.morningBrief.suggestedSequence.map((step, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex items-start gap-3">
                              <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                {step.step}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-zinc-200">{step.activity}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                      {step.type}
                                    </span>
                                    {step.durationMinutes && (
                                      <span className="text-[11px] text-zinc-500 font-mono">
                                        {step.durationMinutes}m
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {step.notes && (
                                  <p className="text-[11px] text-zinc-400 mt-0.5">{step.notes}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mindset */}
                    {currentReview.morningBrief.mindset && (
                      <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-300 italic">
                        "{currentReview.morningBrief.mindset}"
                      </div>
                    )}
                  </div>
                )}

                {/* EVENING REVIEW SPECIFIC SECTIONS */}
                {currentReview.type === 'evening_review' && (
                  <div className="space-y-6 pt-2">
                    {/* Reschedule Success Alert */}
                    {rescheduleSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>{rescheduleSuccess}</span>
                      </div>
                    )}

                    {/* Interactive Unfinished Tasks & Rescheduling */}
                    {pendingTasks.length > 0 && (
                      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                              Incomplete Tasks ({pendingTasks.length})
                            </h5>
                            <p className="text-[11px] text-zinc-400">
                              Select items to reschedule to tomorrow with one click.
                            </p>
                          </div>
                          {onUpdateTask && (
                            <button
                              onClick={handleRescheduleSelected}
                              disabled={selectedIncompleteTasks.length === 0}
                              className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors disabled:opacity-40"
                            >
                              Reschedule Checked ({selectedIncompleteTasks.length})
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {pendingTasks.slice(0, 15).map((t) => (
                            <label
                              key={t.id}
                              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-800/40 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={selectedIncompleteTasks.includes(t.id)}
                                onChange={() => toggleTaskSelection(t.id)}
                                className="rounded border-zinc-700 bg-zinc-900 text-purple-500 focus:ring-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-zinc-200 font-medium block truncate">
                                  {t.title}
                                </span>
                                {t.dueDate && (
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    Due: {t.dueDate}
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                                t.priority === 'critical' ? 'text-rose-400 bg-rose-500/10' :
                                t.priority === 'high' ? 'text-amber-400 bg-amber-500/10' :
                                'text-blue-400 bg-blue-500/10'
                              }`}>
                                {t.priority}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Wind Down Advice */}
                    {currentReview.eveningReview?.windDownAdvice && (
                      <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-1">
                        <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Moon className="w-4 h-4" />
                          <span>Rest &amp; Wind-Down Advice</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {currentReview.eveningReview.windDownAdvice}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Highlights & Recommendations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Key Observations</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-400 pl-4 list-disc">
                      {currentReview.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Recommendations</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-400 pl-4 list-disc">
                      {currentReview.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-zinc-500 text-xs">
                Select "Generate Morning Brief" to structure your day or "Generate Evening Review" to synthesize accomplishments.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Strategic Horizon (Daily & Weekly Summaries) */}
      {activeTab === 'strategic_horizon' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0F0F0F] border border-zinc-800">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Strategic Horizon Insights</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Analyze recurring patterns, stalled priorities, goals, and long-term journal reflections.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                <button
                  onClick={() => {
                    setInsightPeriod('daily');
                    handleGenerateStrategicInsights('daily');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    insightPeriod === 'daily'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Daily Horizon
                </button>
                <button
                  onClick={() => {
                    setInsightPeriod('weekly');
                    handleGenerateStrategicInsights('weekly');
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                    insightPeriod === 'weekly'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Weekly Horizon
                </button>
              </div>

              <button
                onClick={() => handleGenerateStrategicInsights(insightPeriod)}
                disabled={isGeneratingInsights}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                <span>Refresh Insights</span>
              </button>
            </div>
          </div>

          {isGeneratingInsights ? (
            <div className="py-20 text-center space-y-3 p-8 rounded-3xl bg-[#0F0F0F] border border-zinc-800">
              <div className="w-8 h-8 border-2 border-zinc-800 border-t-purple-400 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-400 font-mono">
                Synthesizing long-term reflections, recurring patterns, and weekly priorities with Gemini...
              </p>
            </div>
          ) : strategicInsights ? (
            <div className="space-y-6">
              {/* Overview Card */}
              <div className="p-6 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider">
                    {strategicInsights.period} Summary
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {new Date(strategicInsights.generatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                  {strategicInsights.headline}
                </h4>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {strategicInsights.summary}
                </p>
              </div>

              {/* 2x2 Grid of Detailed Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Core Priorities */}
                {!isCardDismissed('priorities') && (
                  <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3 relative group">
                    <button
                      onClick={() => dismissCard('priorities')}
                      className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      <Target className="w-4 h-4" />
                      <span>What Matters Most</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-300 pl-4 list-disc">
                      {strategicInsights.priorities.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Unfinished & Stalled Work */}
                {!isCardDismissed('unfinished') && (
                  <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3 relative group">
                    <button
                      onClick={() => dismissCard('unfinished')}
                      className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Unfinished &amp; Stalled Work</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-300 pl-4 list-disc">
                      {strategicInsights.unfinishedItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Recurring Patterns */}
                {!isCardDismissed('patterns') && (
                  <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3 relative group">
                    <button
                      onClick={() => dismissCard('patterns')}
                      className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4" />
                      <span>Recurring Behavioral Patterns</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-300 pl-4 list-disc">
                      {strategicInsights.recurringPatterns.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Meaningful Progress */}
                {!isCardDismissed('progress') && (
                  <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3 relative group">
                    <button
                      onClick={() => dismissCard('progress')}
                      className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Dismiss card"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Meaningful Progress &amp; Wins</span>
                    </div>
                    <ul className="space-y-2 text-xs text-zinc-300 pl-4 list-disc">
                      {strategicInsights.meaningfulProgress.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Goals Extracted Across Journal Entries */}
              {strategicInsights.goals && strategicInsights.goals.length > 0 && (
                <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    <Brain className="w-4 h-4" />
                    <span>Distilled Goals Across Reflections</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {strategicInsights.goals.map((g, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Long-Term Memory Citations */}
              {strategicInsights.memoryCitations && strategicInsights.memoryCitations.length > 0 && (
                <div className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span>Relevant Journal Memories Referenced</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">Long-term context enabled</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {strategicInsights.memoryCitations.map((citation, i) => (
                      <div key={i} className="p-3 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                        <div className="font-semibold text-zinc-200">{citation.title}</div>
                        <p className="text-zinc-400 line-clamp-2 text-[11px]">{citation.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-zinc-500 text-xs p-8 rounded-3xl bg-[#0F0F0F] border border-zinc-800">
              Click "Refresh Insights" to evaluate priorities and recurring patterns.
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: Review Archive */}
      {activeTab === 'archive' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-5 rounded-2xl bg-[#0F0F0F] border border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">
              Historical Daily Reviews &amp; Syntheses
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Review your previous Gemini-generated morning briefings, reflections, and momentum scores.
            </p>
          </div>

          {dailyReviews.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#0F0F0F] border border-zinc-800 text-center text-xs text-zinc-500">
              No daily reviews saved yet. Generate a Morning Brief or Evening Review to build your productivity history.
            </div>
          ) : (
            <div className="space-y-3">
              {dailyReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 rounded-2xl bg-[#0F0F0F] border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        rev.type === 'morning_brief'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                          : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                      }`}>
                        {rev.type === 'morning_brief' ? 'Morning Brief' : 'Evening Review'}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {rev.dateStr}
                      </span>
                      {rev.productivityScore && (
                        <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                          {rev.productivityScore}/100
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-zinc-200 truncate">
                      {rev.headline}
                    </h4>
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {rev.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setCurrentReview(rev);
                        setActiveTab('daily_brief');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                    >
                      View
                    </button>
                    {onDeleteDailyReview && (
                      <button
                        onClick={() => onDeleteDailyReview(rev.id)}
                        className="p-1.5 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                        title="Delete review"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
