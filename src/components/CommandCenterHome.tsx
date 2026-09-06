import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  Play, 
  Check, 
  BrainCircuit, 
  RefreshCw, 
  AlertTriangle, 
  Workflow, 
  Zap, 
  CalendarDays, 
  Bell, 
  Layers, 
  ChevronRight,
  Sun,
  CloudSun,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { 
  TaskItem, 
  DailyPlan, 
  ScheduleBlock, 
  WeatherData, 
  PriorityLevel, 
  ExtractedEvent, 
  ExtractedDeadline, 
  UserPreferences,
  WhatNowRecommendation,
  CalendarEvent,
  DailyReview
} from '../types';
import { expandEventOccurrences, formatDateKey } from '../services/recurrenceService';

interface CommandCenterHomeProps {
  userName: string;
  userTimezone: string;
  tasks: TaskItem[];
  currentPlan: DailyPlan | null;
  events?: ExtractedEvent[];
  calendarEvents?: CalendarEvent[];
  deadlines?: ExtractedDeadline[];
  preferences?: UserPreferences;
  weather: WeatherData | null;
  onRefreshWeather: () => void;
  onNavigateTab: (tab: any) => void;
  onStartFocus: (taskTitle?: string, taskId?: string) => void;
  onToggleTask: (taskId: string) => Promise<void>;
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onSavePlan: (plan: DailyPlan) => Promise<void>;
  onCreateEvent?: (event: any) => Promise<void>;
  onUpdateEvent?: (eventId: string, updates: any, recurrenceMode?: any, occurrenceDate?: string) => Promise<void>;
  onDeleteEvent?: (eventId: string, recurrenceMode?: any, occurrenceDate?: string) => Promise<void>;
  onOpenJournalWithPrompt: (prompt: string) => void;
  dailyReviews?: DailyReview[];
}

export const CommandCenterHome: React.FC<CommandCenterHomeProps> = ({
  userName,
  userTimezone,
  tasks,
  currentPlan,
  events = [],
  calendarEvents = [],
  deadlines = [],
  preferences,
  weather,
  onRefreshWeather,
  onNavigateTab,
  onStartFocus,
  onToggleTask,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSavePlan,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onOpenJournalWithPrompt,
  dailyReviews = [],
}) => {
  // "What should I do now?" AI state
  const [whatNowData, setWhatNowData] = useState<WhatNowRecommendation | null>(null);
  const [isLoadingWhatNow, setIsLoadingWhatNow] = useState(false);

  // Live ticking clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial recommendation on mount or when tasks change
  useEffect(() => {
    fetchWhatNowRecommendation();
  }, [tasks.length]);

  const fetchWhatNowRecommendation = async (extraPrompt?: string) => {
    try {
      setIsLoadingWhatNow(true);
      const pendingTasks = tasks.filter((t) => !t.completed);
      const res = await fetch('/api/gemini/what-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: pendingTasks,
          currentTime: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timezone: userTimezone,
          userPrompt: extraPrompt,
        }),
      });

      if (!res.ok) throw new Error('Failed to get recommendation');
      const data: WhatNowRecommendation = await res.json();
      setWhatNowData(data);
    } catch {
      // Safe fallback from pending tasks
      const firstPending = tasks.find((t) => !t.completed);
      setWhatNowData({
        actionTitle: firstPending ? firstPending.title : 'Plan your high-impact objectives for today',
        reason: 'Maintain steady momentum on your most valuable commitments.',
        estimatedMinutes: firstPending?.estimatedMinutes || 25,
        priority: firstPending?.priority || 'high',
        taskId: firstPending?.id,
        quickTips: ['Break this into smaller 10-minute milestones', 'Activate Focus Mode for 25 minutes'],
      });
    } finally {
      setIsLoadingWhatNow(false);
    }
  };

  // Today's Date String & Occurrences
  const todayDateStr = formatDateKey(currentTime);
  const todayOccurrences = useMemo(() => {
    return expandEventOccurrences(calendarEvents, todayDateStr, todayDateStr);
  }, [calendarEvents, todayDateStr]);

  // Stats Calculations
  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  // Today's Meetings: Schedule blocks with type 'meeting' + calendar occurrences for today
  const planMeetings = (currentPlan?.blocks || []).filter((b) => b.type === 'meeting');
  const meetingCount = todayOccurrences.length + planMeetings.length;

  // Important Deadlines: Critical/High priority items + extracted deadlines
  const criticalTasks = pendingTasks.filter((t) => t.priority === 'critical' || t.priority === 'high');
  const criticalDeadlines = deadlines.filter((d) => d.priority === 'critical');
  const importantDeadlineCount = criticalTasks.length + criticalDeadlines.length;

  const todayTimelineBlocks = currentPlan?.blocks || [];

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 animate-fadeIn text-zinc-100">
      {/* 1. Header Banner: Greeting with user's name, live Clock & Date */}
      <div className="bg-[#0F0F0F] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400 font-mono uppercase tracking-widest mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {currentTime.toLocaleDateString(undefined, { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {currentTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}
              </span>
              <span className="text-[10px] text-zinc-500 font-sans tracking-normal lowercase">
                ({userTimezone})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-zinc-100 tracking-tight">
              {getGreeting()}, <span className="text-zinc-300">{userName.split(' ')[0] || 'Friend'}</span>.
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xl">
              AI Command Center active. You have <span className="text-zinc-200 font-semibold">{pendingTasks.length} pending tasks</span>,{' '}
              <span className="text-blue-300 font-semibold">{meetingCount} scheduled meetings</span>, and{' '}
              <span className="text-amber-300 font-semibold">{importantDeadlineCount} high-priority items</span> today.
            </p>
          </div>

          {/* Weather Card Placeholder / Live Weather Context */}
          <div className="shrink-0">
            {weather ? (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-all shadow-md">
                <div className="text-3xl select-none">{weather.icon || '☀️'}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-200">{weather.city}</span>
                    <button
                      onClick={onRefreshWeather}
                      className="text-zinc-500 hover:text-zinc-300 p-0.5 transition-colors"
                      title="Refresh Weather"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-zinc-300 font-medium">
                    <span className="font-mono text-zinc-100">{weather.tempC}°C / {weather.tempF}°F</span> • {weather.condition}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1.5">
                    <span>Humidity: {weather.humidity}%</span>
                    <span>•</span>
                    <span className="text-emerald-400">High focus clarity</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-zinc-400">
                <CloudSun className="w-6 h-6 text-zinc-500 animate-pulse" />
                <div>
                  <div className="text-xs font-medium text-zinc-300">Local Weather</div>
                  <div className="text-[11px] text-zinc-500">Connecting atmospheric feed...</div>
                </div>
                <button
                  onClick={onRefreshWeather}
                  className="p-1 text-zinc-500 hover:text-zinc-300"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3 Metrics: Today's Tasks, Meetings Count, Important Deadlines Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-zinc-800/80">
          <div 
            onClick={() => onNavigateTab('tasks')}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="group-hover:text-zinc-200 transition-colors">Today's Tasks</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
              {pendingTasks.length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <span>{completedTasks.length} completed</span>
              <span>•</span>
              <span className="text-zinc-400 font-medium">View board &rarr;</span>
            </div>
          </div>

          <div 
            onClick={() => onNavigateTab('planner')}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="group-hover:text-zinc-200 transition-colors">Meetings Today</span>
              <CalendarDays className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-blue-300 tracking-tight">
              {meetingCount}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <span>{planMeetings.length} in plan</span>
              <span>•</span>
              <span className="text-zinc-400 font-medium">{events.length} extracted events</span>
            </div>
          </div>

          <div 
            onClick={() => onNavigateTab('calendar')}
            className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="group-hover:text-zinc-200 transition-colors">Important Deadlines</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-amber-300 tracking-tight">
              {importantDeadlineCount}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <span>{criticalTasks.length} urgent tasks</span>
              <span>•</span>
              <span className="text-amber-400/80 font-medium">View schedule &rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary AI Companion Link */}
      <div
        onClick={() => onNavigateTab('journal')}
        className="p-5 sm:p-6 rounded-3xl bg-[#0F0F0F] border border-zinc-800 hover:border-amber-500/40 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-xl"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors">
                Journal & AI Companion
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
                Voice & Text
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Your single life companion — reflective journaling, planning, task scheduling, real distance calculations, and voice check-ins.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="px-4 py-2 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all">
            <span>Open Companion</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>

      {/* AI Daily Insight Banner */}
      {dailyReviews.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-fadeIn">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                dailyReviews[0].type === 'morning_brief'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
              }`}>
                {dailyReviews[0].type === 'morning_brief' ? 'Morning Focus Brief' : 'Daily Evening Review'}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {dailyReviews[0].dateStr}
              </span>
              {dailyReviews[0].productivityScore && (
                <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                  Score: {dailyReviews[0].productivityScore}/100
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-zinc-200">
              {dailyReviews[0].headline}
            </h4>
            <p className="text-xs text-zinc-400 line-clamp-1">
              {dailyReviews[0].summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigateTab('insights')}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <span>View Full Insights</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Focused View: "What should I do now?" AI Recommendation + Core Hubs */}
      <div className="space-y-6">
        {/* "What should I do now?" AI Card */}
        <div className="bg-[#0F0F0F] border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">
                What should I do now?
              </h3>
            </div>
            <button
              onClick={() => fetchWhatNowRecommendation()}
              disabled={isLoadingWhatNow}
              className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium"
              title="Re-evaluate with Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWhatNow ? 'animate-spin' : ''}`} />
              <span>Re-evaluate</span>
            </button>
          </div>

          {isLoadingWhatNow ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-xs text-zinc-500 font-mono">
                Synthesizing tasks, timeline &amp; energy state...
              </p>
            </div>
          ) : whatNowData ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    whatNowData.priority === 'critical' || whatNowData.priority === 'high'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  }`}>
                    {whatNowData.priority} Priority • ~{whatNowData.estimatedMinutes} mins
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">Highest Leverage</span>
                </div>

                <h4 className="text-xl font-semibold text-zinc-100 tracking-tight">
                  {whatNowData.actionTitle}
                </h4>

                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                  {whatNowData.reason}
                </p>

                {whatNowData.quickTips && whatNowData.quickTips.length > 0 && (
                  <div className="pt-3 border-t border-zinc-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      Strategic Flow Tips:
                    </div>
                    {whatNowData.quickTips.map((tip, idx) => (
                      <div key={idx} className="text-xs text-zinc-400 flex items-center gap-2 font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Primary Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onStartFocus(whatNowData.actionTitle, whatNowData.taskId)}
                  className="flex-1 min-w-[170px] py-3 px-4 rounded-xl bg-zinc-100 hover:bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Start Focus Session ({whatNowData.estimatedMinutes}m)</span>
                </button>

                {whatNowData.taskId && (
                  <button
                    onClick={() => onToggleTask(whatNowData.taskId!)}
                    className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2 transition-all"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Mark Done</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigateTab('tasks')}
                  className="py-3 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-all"
                  title="View task board"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Core Navigation Hub: 4 Distinct, Intuitive Destinations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => onNavigateTab('planner')}
            className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-950/40 border border-blue-800/60 flex items-center justify-center text-blue-400">
              <Workflow className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-zinc-100 group-hover:text-blue-300 transition-colors">
              Daily Planner
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Pacing and time-blocking with energy buffers.
            </p>
          </div>

          <div 
            onClick={() => onNavigateTab('calendar')}
            className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
              Calendar &amp; Events
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Track meetings, scheduled blocks, and deadlines.
            </p>
          </div>

          <div 
            onClick={() => onNavigateTab('tasks')}
            className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-zinc-100 group-hover:text-amber-300 transition-colors">
              Tasks &amp; Board
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Organize priorities, categorize work, and complete milestones.
            </p>
          </div>

          <div 
            onClick={() => onNavigateTab('insights')}
            className="p-5 rounded-3xl bg-[#0F0F0F] border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all space-y-2 group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-950/40 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h4 className="text-base font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors">
              Insights &amp; Reviews
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Long-term memory synthesis, daily reviews, and focus analytics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
