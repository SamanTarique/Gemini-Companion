import React from 'react';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  Clock, 
  AlertCircle, 
  Sparkles,
  MapPin,
  Tag
} from 'lucide-react';
import { ExtractedTask, ExtractedEvent, ExtractedDeadline } from '../types';

interface ExtractedScheduleViewProps {
  tasks: ExtractedTask[];
  events: ExtractedEvent[];
  deadlines: ExtractedDeadline[];
  userTimezone: string;
  onToggleTask: (taskId: string) => void;
}

export const ExtractedScheduleView: React.FC<ExtractedScheduleViewProps> = ({
  tasks,
  events,
  deadlines,
  userTimezone,
  onToggleTask,
}) => {
  const hasItems = tasks.length > 0 || events.length > 0 || deadlines.length > 0;

  if (!hasItems) {
    return (
      <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl text-center">
        <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-zinc-200 mb-1">No Action Items Extracted Yet</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Click &quot;Extract Tasks &amp; Schedule&quot; in your journal editor, and Gemini will distill structured schedules normalized to <span className="font-mono text-zinc-300">{userTimezone}</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Structured Schedule &amp; Actions
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{userTimezone}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tasks Section */}
        <div className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              Tasks ({tasks.filter(t => t.completed).length}/{tasks.length})
            </span>
          </div>

          {tasks.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 text-center italic">No tasks extracted</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    task.completed
                      ? 'bg-zinc-950 border-zinc-800/60 text-zinc-600 line-through'
                      : 'bg-[#0A0A0A] hover:bg-zinc-900 border-zinc-800 text-zinc-200'
                  }`}
                >
                  <button className="mt-0.5 shrink-0 text-zinc-500 hover:text-zinc-200">
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug break-words">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority && task.priority !== 'medium' && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            task.priority === 'critical' || task.priority === 'high'
                              ? 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events Section */}
        <div className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Calendar Events ({events.length})
            </span>
          </div>

          {events.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 text-center italic">No events extracted</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-2.5 rounded-xl border border-zinc-800 bg-[#0A0A0A] text-zinc-200 space-y-1"
                >
                  <p className="text-xs font-medium leading-snug">{event.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-1 text-blue-400">
                      <Clock className="w-2.5 h-2.5" />
                      {event.dateTime}
                    </span>
                    {event.location && (
                      <span className="flex items-center gap-1 text-zinc-500">
                        <MapPin className="w-2.5 h-2.5" />
                        {event.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deadlines Section */}
        <div className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Deadlines &amp; Milestones ({deadlines.length})
            </span>
          </div>

          {deadlines.length === 0 ? (
            <div className="text-xs text-zinc-500 py-3 text-center italic">No deadlines extracted</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {deadlines.map((dl) => (
                <div
                  key={dl.id}
                  className="p-2.5 rounded-xl border border-rose-900/40 bg-rose-950/20 text-zinc-200 space-y-1"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-medium leading-snug">{dl.title}</p>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        dl.priority === 'critical'
                          ? 'bg-rose-900/80 text-rose-200 border border-rose-700'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {dl.priority}
                    </span>
                  </div>
                  <div className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    Due: {dl.deadline}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
