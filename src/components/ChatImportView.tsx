import React, { useState } from 'react';
import { 
  FileUp, 
  Sparkles, 
  ShieldCheck, 
  Check, 
  Trash2, 
  Calendar, 
  Clock, 
  ListTodo, 
  AlertCircle,
  UploadCloud,
  FileText
} from 'lucide-react';
import { TaskItem, ExtractedEvent, ExtractedDeadline, PriorityLevel } from '../types';

interface ChatImportViewProps {
  userTimezone: string;
  onImportExtractedTasks: (tasks: Omit<TaskItem, 'id' | 'createdAt'>[]) => Promise<void>;
  onNavigateTab: (tab: any) => void;
}

export const ChatImportView: React.FC<ChatImportViewProps> = ({
  userTimezone,
  onImportExtractedTasks,
  onNavigateTab,
}) => {
  const [chatText, setChatText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    tasks: any[];
    events: any[];
    deadlines: any[];
    extractedCount: number;
  } | null>(null);
  const [importedSuccess, setImportedSuccess] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setChatText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleParseChat = async () => {
    if (!chatText.trim()) return;

    try {
      setIsParsing(true);
      setImportedSuccess(false);

      const res = await fetch('/api/gemini/parse-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: chatText.trim(),
          timezone: userTimezone,
        }),
      });

      if (!res.ok) throw new Error('Chat extraction failed');
      const data = await res.json();
      setParsedData(data);
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!parsedData || !parsedData.tasks) return;

    const newTasks: Omit<TaskItem, 'id' | 'createdAt'>[] = parsedData.tasks.map((t) => ({
      userId: '',
      title: t.title,
      priority: (t.priority || 'medium') as PriorityLevel,
      category: (t.category || 'work') as any,
      dueDate: t.dueDate,
      estimatedMinutes: t.estimatedMinutes || 30,
      completed: false,
      source: 'chat_import',
    }));

    await onImportExtractedTasks(newTasks);
    setImportedSuccess(true);
    setChatText('');
    setParsedData(null);
  };

  return (
    <div className="space-y-8 text-zinc-100 animate-fadeIn">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <FileUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
            Unstructured Chat &amp; Notes Importer
          </h2>
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          Paste WhatsApp chats, Slack conversations, or unstructured notes. Gemini extracts tasks &amp; deadlines without storing the raw third-party transcript.
        </p>
      </div>

      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-3 text-xs text-zinc-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-200">Zero-Storage Privacy Protocol:</span> Raw imported text is processed purely in memory to extract structured action items and immediately discarded. Third-party personal conversations are never stored or logged in your Firestore database.
        </div>
      </div>

      {/* Upload / Paste Area */}
      <div className="p-6 sm:p-8 bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Paste Chat or Notes Content
          </label>
          <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center gap-1.5 transition-colors">
            <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
            <span>Upload .txt file</span>
            <input
              type="file"
              accept=".txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          placeholder="e.g. 
[10:14 AM] Alex: Hey, can you review the client proposal by Thursday 3 PM?
[10:15 AM] You: Sure, I'll also send the updated invoice tomorrow morning."
          rows={7}
          className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 font-mono"
        />

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setChatText('')}
            disabled={!chatText}
            className="px-4 py-2 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
          >
            Clear Text
          </button>

          <button
            onClick={handleParseChat}
            disabled={isParsing || !chatText.trim()}
            className="px-6 py-3 rounded-xl bg-zinc-100 hover:bg-white text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 text-black ${isParsing ? 'animate-spin' : ''}`} />
            <span>{isParsing ? 'Extracting Action Items...' : 'Extract Tasks with Gemini'}</span>
          </button>
        </div>
      </div>

      {/* Extraction Results */}
      {parsedData && (
        <div className="p-6 sm:p-8 bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-6 animate-fadeIn shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 tracking-tight">
                Extracted Commitments ({parsedData.extractedCount})
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review the items extracted by Gemini before adding them to your task board.
              </p>
            </div>

            <button
              onClick={handleCommitImport}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Import to My Tasks</span>
            </button>
          </div>

          {/* Tasks list preview */}
          {parsedData.tasks && parsedData.tasks.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ListTodo className="w-4 h-4 text-amber-400" />
                <span>Extracted Tasks ({parsedData.tasks.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsedData.tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        {task.priority || 'medium'}
                      </span>
                      {task.dueDate && (
                        <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.dueDate}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-zinc-100">{task.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events list preview */}
          {parsedData.events && parsedData.events.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Extracted Scheduled Events ({parsedData.events.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {parsedData.events.map((event, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1"
                  >
                    <div className="text-xs font-medium text-zinc-100">{event.title}</div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>{event.dateTime}</span>
                      {event.location && <span>• {event.location}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success Notification */}
      {importedSuccess && (
        <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Tasks and commitments successfully imported to your database!</span>
          </div>
          <button
            onClick={() => onNavigateTab('tasks')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition-all"
          >
            View Tasks
          </button>
        </div>
      )}
    </div>
  );
};
