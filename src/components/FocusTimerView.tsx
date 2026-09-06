import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Check, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Flame, 
  Clock, 
  CheckCircle2, 
  ArrowLeft,
  Zap,
  Coffee
} from 'lucide-react';
import { TaskItem, FocusSession } from '../types';

interface FocusTimerViewProps {
  initialTaskTitle?: string;
  initialTaskId?: string;
  tasks: TaskItem[];
  onLogFocusSession: (session: Omit<FocusSession, 'id' | 'completedAt'>) => Promise<void>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onExitFocus?: () => void;
}

const MODES = [
  { id: 'pomodoro', label: 'Pomodoro (25m)', minutes: 25 },
  { id: 'deep_work', label: 'Deep Work (50m)', minutes: 50 },
  { id: 'flow_state', label: 'Flow Block (90m)', minutes: 90 },
  { id: 'short_break', label: 'Rest Break (5m)', minutes: 5 },
];

export const FocusTimerView: React.FC<FocusTimerViewProps> = ({
  initialTaskTitle,
  initialTaskId,
  tasks,
  onLogFocusSession,
  onCompleteTask,
  onExitFocus,
}) => {
  const [selectedMode, setSelectedMode] = useState(MODES[0]);
  const [secondsRemaining, setSecondsRemaining] = useState(selectedMode.minutes * 60);
  const [isActive, setIsActive] = useState(false);
  const [activeTaskTitle, setActiveTaskTitle] = useState(initialTaskTitle || 'Deep Creative Work');
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>(initialTaskId);
  const [audioMuted, setAudioMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  const [hasCompletedCurrentSession, setHasCompletedCurrentSession] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync initial task if provided
  useEffect(() => {
    if (initialTaskTitle) {
      setActiveTaskTitle(initialTaskTitle);
      setActiveTaskId(initialTaskId);
    }
  }, [initialTaskTitle, initialTaskId]);

  // Handle timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((sec) => sec - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isActive) {
      setIsActive(false);
      handleSessionFinished();
    }
    return () => clearInterval(interval);
  }, [isActive, secondsRemaining]);

  // Gentle ambient chime synthesizer via native Web Audio API
  const playChime = () => {
    if (audioMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(528, ctx.currentTime); // 528 Hz tranquil Solfeggio frequency
      osc.frequency.exponentialRampToValueAtTime(792, ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 2.0);
    } catch {
      // Audio context might be restricted
    }
  };

  const handleSessionFinished = async () => {
    playChime();
    setHasCompletedCurrentSession(true);

    // Auto-log session
    await onLogFocusSession({
      userId: '',
      taskId: activeTaskId,
      taskTitle: activeTaskTitle,
      durationMinutes: selectedMode.minutes,
      notes: sessionNotes.trim() || undefined,
    });
  };

  const handleSwitchMode = (mode: typeof MODES[0]) => {
    setIsActive(false);
    setSelectedMode(mode);
    setSecondsRemaining(mode.minutes * 60);
    setHasCompletedCurrentSession(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsRemaining(selectedMode.minutes * 60);
    setHasCompletedCurrentSession(false);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullScreen(false);
    }
  };

  const progressPercent = ((selectedMode.minutes * 60 - secondsRemaining) / (selectedMode.minutes * 60)) * 100;
  const minutesDisplay = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
  const secondsDisplay = (secondsRemaining % 60).toString().padStart(2, '0');

  return (
    <div
      ref={containerRef}
      className={`space-y-8 animate-fadeIn text-zinc-100 ${
        isFullScreen ? 'fixed inset-0 z-50 bg-[#0A0A0A] p-8 flex flex-col justify-center items-center' : ''
      }`}
    >
      {/* Top Bar with Mode Selector & Fullscreen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          {onExitFocus && !isFullScreen && (
            <button
              onClick={onExitFocus}
              className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-xl"
              title="Return"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <h2 className="font-serif text-2xl font-medium text-zinc-100">
                Focus Sanctuary
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Distraction-free environment with ambient frequency chime and session tracking.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
            title={audioMuted ? 'Unmute chime' : 'Mute chime'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={toggleFullScreen}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300"
            title={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Focus Card */}
      <div className="w-full max-w-4xl mx-auto bg-[#0F0F0F] border border-zinc-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8 text-center relative overflow-hidden">
        {/* Mode switcher pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleSwitchMode(mode)}
              className={`px-4 py-2 rounded-2xl text-xs font-semibold border transition-all ${
                selectedMode.id === mode.id
                  ? 'bg-zinc-100 text-black border-zinc-100 shadow-md'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {/* Active Task Pinned */}
        <div className="max-w-md mx-auto space-y-2">
          <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
            Currently Pinned Objective
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={activeTaskTitle}
              onChange={(e) => setActiveTaskTitle(e.target.value)}
              placeholder="What are you dedicating this block to?"
              className="w-full text-center px-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm font-medium text-zinc-100 focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Quick select from user tasks dropdown */}
          {tasks.filter((t) => !t.completed).length > 0 && (
            <select
              onChange={(e) => {
                const found = tasks.find((t) => t.id === e.target.value);
                if (found) {
                  setActiveTaskTitle(found.title);
                  setActiveTaskId(found.id);
                }
              }}
              value={activeTaskId || ''}
              className="text-xs bg-transparent text-zinc-400 hover:text-zinc-200 border-none cursor-pointer focus:outline-none"
            >
              <option value="" className="bg-zinc-900 text-zinc-300">
                Or select from pending tasks...
              </option>
              {tasks
                .filter((t) => !t.completed)
                .map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-900 text-zinc-200">
                    {t.title}
                  </option>
                ))}
            </select>
          )}
        </div>

        {/* Circular Breathing / Progress Display & Large Digit Timer */}
        <div className="relative flex flex-col items-center justify-center my-6">
          <div
            className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-zinc-800 flex flex-col items-center justify-center relative transition-all ${
              isActive ? 'shadow-[0_0_50px_-10px_rgba(52,211,153,0.15)] border-emerald-500/30' : ''
            }`}
          >
            {/* SVG Progress Circle */}
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-zinc-800 fill-transparent"
                strokeWidth="4"
              />
              <circle
                cx="50%"
                cy="50%"
                r="45%"
                className="stroke-emerald-400 fill-transparent transition-all duration-1000 ease-linear"
                strokeWidth="4"
                strokeDasharray={2 * Math.PI * 125}
                strokeDashoffset={2 * Math.PI * 125 * (1 - progressPercent / 100)}
                strokeLinecap="round"
              />
            </svg>

            {/* Timer Large Display */}
            <div className="relative z-10 space-y-1">
              <div className="font-mono text-5xl sm:text-6xl font-light text-zinc-100 tracking-tight">
                {minutesDisplay}:{secondsDisplay}
              </div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                {isActive ? 'Flow Active' : 'Paused'}
              </div>
            </div>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleReset}
            className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"
            title="Reset timer"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsActive(!isActive)}
            className="px-8 py-4 rounded-2xl bg-zinc-100 hover:bg-white text-black font-bold text-sm flex items-center gap-2.5 transition-all shadow-xl active:scale-95"
          >
            {isActive ? (
              <>
                <Pause className="w-5 h-5 fill-black" />
                <span>Pause Session</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-black" />
                <span>{secondsRemaining === selectedMode.minutes * 60 ? 'Start Flow' : 'Resume'}</span>
              </>
            )}
          </button>

          {activeTaskId && onCompleteTask && (
            <button
              onClick={() => onCompleteTask(activeTaskId)}
              className="p-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-emerald-400 transition-all"
              title="Mark task completed"
            >
              <Check className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Completion Banner */}
        {hasCompletedCurrentSession && (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center justify-center gap-2 animate-fadeIn max-w-md mx-auto">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Focus session logged! Great progress on your commitments.</span>
          </div>
        )}
      </div>
    </div>
  );
};
