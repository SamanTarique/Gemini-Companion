import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Brain, 
  Lightbulb, 
  FileText, 
  ListChecks, 
  Search, 
  Plus, 
  RotateCw, 
  AlertCircle, 
  Check, 
  Tag as TagIcon,
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  Bot,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Compass,
  Calendar,
  Target,
  MapPin,
  Navigation,
  Car,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  ShieldCheck
} from 'lucide-react';
import Markdown from 'react-markdown';
import { 
  JournalEntry, 
  MoodType, 
  ChatMessage, 
  StructuredExtraction, 
  ExtractedTask, 
  JournalMemory,
  DetectedActionItem,
  JournalAnalysisResult,
  TaskItem,
  CalendarEvent,
  DailyPlan,
  ActionProposal
} from '../types';
import { ExtractedScheduleView } from './ExtractedScheduleView';
import { JournalAnalysisModal } from './JournalAnalysisModal';
import { searchSemanticMemories, generateAndStoreMemory } from '../services/memoryService';
import { GeminiLiveSession, LiveSessionStatus } from '../services/geminiLiveService';
import { auth } from '../lib/firebase';

interface JournalEditorProps {
  currentEntry: JournalEntry;
  onUpdateEntry: (updated: Partial<JournalEntry>) => void;
  onSaveEntry: (entryOverride?: JournalEntry) => Promise<void>;
  onNewEntry: () => void;
  onNavigateTab?: (tab: any) => void;
  onImportTasks?: (tasks: ExtractedTask[]) => void;
  onAddCalendarEvent?: (eventData: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateCalendarEvent?: (eventId: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteCalendarEvent?: (eventId: string) => Promise<void>;
  onAddTask?: (task: Partial<TaskItem>) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onSavePlan?: (plan: DailyPlan) => Promise<void>;
  onStartFocus?: (taskId?: string, taskTitle?: string) => void;
  currentPlan?: DailyPlan | null;
  existingTasks?: TaskItem[];
  existingEvents?: CalendarEvent[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  errorMessage: string | null;
  userTimezone: string;
  userPreferences?: any;
}

const MOODS: { id: MoodType; label: string }[] = [
  { id: 'reflective', label: 'Reflective' },
  { id: 'calm', label: 'Calm' },
  { id: 'focused', label: 'Focused' },
  { id: 'energized', label: 'Energized' },
  { id: 'creative', label: 'Creative' },
  { id: 'grateful', label: 'Grateful' },
  { id: 'anxious', label: 'Anxious' },
];

const PROMPT_SUGGESTIONS = [
  { title: 'Extract Commitments', prompt: 'Review my day, identify key commitments, and extract actionable tasks.' },
  { title: 'Evening Reflection', prompt: 'What went well today, what caused friction, and what should I focus on tomorrow?' },
  { title: 'Brainstorm Solutions', prompt: 'I am working through a complex decision. Help me explore pros and cons.' },
  { title: 'Organize Thoughts', prompt: 'Synthesize my scattered thoughts into clear priorities and next steps.' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  currentEntry,
  onUpdateEntry,
  onSaveEntry,
  onNewEntry,
  onNavigateTab,
  onImportTasks,
  onAddCalendarEvent,
  onUpdateCalendarEvent,
  onDeleteCalendarEvent,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSavePlan,
  onStartFocus,
  currentPlan,
  existingTasks = [],
  existingEvents = [],
  saveStatus,
  errorMessage,
  userTimezone,
  userPreferences,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<LiveSessionStatus>('idle');
  const [liveVoiceMessage, setLiveVoiceMessage] = useState<string>('');
  const [liveAudioLevel, setLiveAudioLevel] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isLiveMuted, setIsLiveMuted] = useState(false);
  const liveSessionRef = useRef<GeminiLiveSession | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const isSendingRef = useRef(false);
  const [searchQueryPrompt, setSearchQueryPrompt] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [showMoodMenu, setShowMoodMenu] = useState(false);
  const [showExtractedSection, setShowExtractedSection] = useState(true);
  const [importedTasksSuccess, setImportedTasksSuccess] = useState(false);
  const [activeRecalledMemories, setActiveRecalledMemories] = useState<JournalMemory[]>([]);
  const [showMemoriesModal, setShowMemoriesModal] = useState(false);

  // Journal Analysis & Action Approval State
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<JournalAnalysisResult | null>(null);
  const [isAnalyzingJournal, setIsAnalyzingJournal] = useState(false);

  // Handle Action Proposals from Gemini Companion
  const handleApplyProposal = async (messageId: string, proposal: ActionProposal) => {
    try {
      if (proposal.tool === 'create_task' || proposal.tool === 'add_task') {
        if (onAddTask) {
          await onAddTask({
            title: proposal.params.title || proposal.title,
            priority: proposal.params.priority || 'medium',
            category: proposal.params.category || 'work',
            dueDate: proposal.params.dueDate,
            dueTime: proposal.params.dueTime,
            estimatedMinutes: proposal.params.estimatedMinutes || 25,
            completed: false,
            source: 'journal_extracted',
          });
        }
      } else if (
        proposal.tool === 'create_event' ||
        proposal.tool === 'schedule_event' ||
        proposal.tool === 'schedule_meeting'
      ) {
        if (onAddCalendarEvent) {
          const today = new Date().toISOString().split('T')[0];
          await onAddCalendarEvent({
            title: proposal.params.title || proposal.title,
            description: proposal.params.description || proposal.description || '',
            date: proposal.params.date || today,
            startTime: proposal.params.startTime || '09:00',
            endTime: proposal.params.endTime || '10:00',
            location: proposal.params.location,
            priority: proposal.params.priority || 'medium',
            repeat: { frequency: 'none' },
            reminder: [15],
          });
        }
      } else if (proposal.tool === 'reschedule') {
        if (proposal.params.eventId && onUpdateCalendarEvent) {
          await onUpdateCalendarEvent(proposal.params.eventId, {
            date: proposal.params.date,
            startTime: proposal.params.startTime,
            endTime: proposal.params.endTime,
          });
        } else if (proposal.params.taskId && onUpdateTask) {
          await onUpdateTask(proposal.params.taskId, {
            dueDate: proposal.params.dueDate || proposal.params.date,
            dueTime: proposal.params.dueTime || proposal.params.startTime,
          });
        }
      } else if (proposal.tool === 'delete_task') {
        if (proposal.params.taskId && onDeleteTask) {
          await onDeleteTask(proposal.params.taskId);
        }
      } else if (proposal.tool === 'start_focus') {
        if (onStartFocus) {
          onStartFocus(proposal.params.taskId, proposal.params.taskTitle || proposal.title);
        }
      }

      // Mark status as applied
      const updatedMessages = currentEntry.messages.map((m) => {
        if (m.id === messageId && m.actionProposal) {
          return {
            ...m,
            actionProposal: { ...m.actionProposal, status: 'applied' as const },
          };
        }
        return m;
      });
      const updatedEntry = { ...currentEntry, messages: updatedMessages, updatedAt: Date.now() };
      onUpdateEntry(updatedEntry);
      await onSaveEntry(updatedEntry);
    } catch (err: any) {
      setAiError(err.message || 'Failed to apply proposed action');
    }
  };

  const handleDismissProposal = async (messageId: string) => {
    const updatedMessages = currentEntry.messages.map((m) => {
      if (m.id === messageId && m.actionProposal) {
        return {
          ...m,
          actionProposal: { ...m.actionProposal, status: 'dismissed' as const },
        };
      }
      return m;
    });
    const updatedEntry = { ...currentEntry, messages: updatedMessages, updatedAt: Date.now() };
    onUpdateEntry(updatedEntry);
    await onSaveEntry(updatedEntry);
  };

  const handleToggleExtractedTask = (taskId: string) => {
    const updated = (currentEntry.extractedTasks || []).map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    onUpdateEntry({ extractedTasks: updated });
  };

  const handleImportTasksClick = () => {
    const uncompleted = (currentEntry.extractedTasks || []).filter((t) => !t.completed);
    if (uncompleted.length === 0) return;
    if (onImportTasks) {
      onImportTasks(uncompleted);
      setImportedTasksSuccess(true);
      setTimeout(() => setImportedTasksSuccess(false), 3000);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentEntry.messages, isAiLoading]);

  // Keep reference to latest currentEntry for voice turn callbacks
  const currentEntryRef = useRef(currentEntry);
  useEffect(() => {
    currentEntryRef.current = currentEntry;
  }, [currentEntry]);

  // Clean up Live Voice session on unmount
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
    };
  }, []);

  /**
   * Complete Voice Conversation Turn Handler:
   * Flow: Microphone -> Transcribe Live -> final transcript -> Journal Gemini -> response -> audio response
   */
  const handleVoiceTurn = async (spokenText: string) => {
    const text = spokenText.trim();
    if (!text) return;

    setLiveVoiceStatus('processing');
    setLiveVoiceMessage('Gemini is reflecting on your words...');

    const activeEntry = currentEntryRef.current;
    const generatedTitle = activeEntry.title.trim() ? activeEntry.title : text.slice(0, 36);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newHistory = [...activeEntry.messages, userMsg];
    const updatedContent = activeEntry.content
      ? `${activeEntry.content}\n\n${text}`
      : text;

    const entryWithUserMsg: JournalEntry = {
      ...activeEntry,
      title: generatedTitle,
      messages: newHistory,
      content: updatedContent,
      updatedAt: Date.now(),
    };

    onUpdateEntry(entryWithUserMsg);
    await onSaveEntry(entryWithUserMsg);

    try {
      // 1. Semantic Memory Retrieval (Long-Term AI Memory Context)
      let retrievedMemories: JournalMemory[] = [];
      if (activeEntry.userId) {
        try {
          retrievedMemories = await searchSemanticMemories({
            query: text,
            userId: activeEntry.userId,
            topK: 3,
            minSimilarity: 0.35,
          });
          if (retrievedMemories.length > 0) {
            setActiveRecalledMemories(retrievedMemories);
          }
        } catch {
          // Graceful fallback
        }
      }

      // 2. Call existing Journal Gemini conversational reflection layer
      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          mood: activeEntry.mood,
          actionType: 'chat',
          history: newHistory,
          timezone: userTimezone,
          retrievedMemories,
          existingTags: activeEntry.tags || [],
          existingSentiment: activeEntry.sentiment,
          tasks: existingTasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, dueTime: t.dueTime, completed: t.completed })),
          events: existingEvents.slice(0, 10).map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime, location: e.location })),
          plan: currentPlan?.blocks?.slice(0, 10),
          userLocation: userPreferences?.locationCity || '',
          language: userPreferences?.language || 'auto',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const replyText = data.reply || '';

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'model',
        content: replyText,
        timestamp: Date.now(),
        type: 'reflection',
        actionProposal: data.actionProposal,
        locationInfo: data.locationInfo,
        whatNowData: data.whatNowData,
      };

      const updatedTags = Array.from(new Set([...activeEntry.tags, ...(data.tags || [])]));

      const entryWithAiReply: JournalEntry = {
        ...entryWithUserMsg,
        messages: [...newHistory, aiMsg],
        tags: updatedTags,
        sentiment: data.sentiment || activeEntry.sentiment,
        summary: data.summary || activeEntry.summary || '',
        updatedAt: Date.now(),
      };

      onUpdateEntry(entryWithAiReply);
      await onSaveEntry(entryWithAiReply);

      // Async store memory
      if (activeEntry.userId) {
        generateAndStoreMemory({
          entry: entryWithAiReply,
          userId: activeEntry.userId,
          preferences: userPreferences,
        }).catch(() => {});
      }

      // 3. Audio response playback & seamless transition back to listening for next turn
      if (liveSessionRef.current && replyText) {
        const cleanReply = replyText.replace(/[#*_`[\]()]/g, '');
        liveSessionRef.current.playAudioResponse(cleanReply, () => {
          if (liveSessionRef.current) {
            setLiveVoiceStatus('listening');
            setLiveVoiceMessage('Listening to you...');
            setLiveTranscript('');
          }
        });
      } else {
        setLiveVoiceStatus('listening');
        setLiveVoiceMessage('Listening to you...');
        setLiveTranscript('');
      }
    } catch (err: any) {
      console.error('[Gemini Voice Reflection Error]:', err.message);
      setSpeechError(err.message || 'Gemini reflection error');
      setLiveVoiceStatus('listening');
      setLiveVoiceMessage('Listening to you...');
    }
  };

  const startLiveVoice = async () => {
    setSpeechError(null);
    setLiveTranscript('');

    if (liveSessionRef.current) {
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
    }

    const session = new GeminiLiveSession({
      onStatusChange: (status, message) => {
        setLiveVoiceStatus(status);
        if (message) setLiveVoiceMessage(message);
        setIsRecording(status === 'listening' || status === 'speaking' || status === 'processing');
      },
      onAudioLevel: (level) => {
        setLiveAudioLevel(level);
      },
      onInterimTranscript: (text) => {
        setLiveTranscript(text);
      },
      onFinalTranscript: (text) => {
        setLiveTranscript(text);
      },
      onTurnComplete: async (userFinalText) => {
        if (!userFinalText || !userFinalText.trim()) return;
        await handleVoiceTurn(userFinalText);
      },
      onError: (err) => {
        setSpeechError(err);
        setIsRecording(false);
      },
    });

    liveSessionRef.current = session;

    // Secure token flow: retrieve Firebase ID token for authentication if available
    let idToken: string | undefined;
    try {
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken();
      }
    } catch {}

    await session.start({
      idToken,
      customVocabulary: ['AuraJournal', 'mindfulness', 'journaling', ...(currentEntry.tags || [])],
    });
  };

  const stopLiveVoice = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stop();
      liveSessionRef.current = null;
    }
    setLiveVoiceStatus('idle');
    setLiveVoiceMessage('');
    setLiveAudioLevel(0);
    setIsRecording(false);
  };

  const toggleSpeech = () => {
    if (liveVoiceStatus === 'listening' || liveVoiceStatus === 'speaking' || liveVoiceStatus === 'connecting' || liveVoiceStatus === 'processing') {
      stopLiveVoice();
    } else {
      startLiveVoice();
    }
  };

  const toggleLiveMute = () => {
    if (liveSessionRef.current) {
      const muted = liveSessionRef.current.toggleMute();
      setIsLiveMuted(muted);
    }
  };

  const handleSpeak = (messageId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*_`[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Send message to Gemini
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isAiLoading || isSendingRef.current) return;

    isSendingRef.current = true;
    setAiError(null);
    setFailedPrompt(null);

    const generatedTitle = currentEntry.title.trim() ? currentEntry.title : textToSend.slice(0, 36);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    const newHistory = [...currentEntry.messages, userMsg];
    const updatedContent = currentEntry.content
      ? `${currentEntry.content}\n\n${textToSend}`
      : textToSend;

    const entryWithUserMsg: JournalEntry = {
      ...currentEntry,
      title: generatedTitle,
      messages: newHistory,
      content: updatedContent,
      updatedAt: Date.now(),
    };

    // Update state and immediately persist user message to Firestore
    onUpdateEntry(entryWithUserMsg);
    await onSaveEntry(entryWithUserMsg);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      setIsAiLoading(true);

      // Semantic Memory Retrieval (Long-Term AI Memory Directive)
      let retrievedMemories: JournalMemory[] = [];
      if (currentEntry.userId) {
        try {
          retrievedMemories = await searchSemanticMemories({
            query: textToSend,
            userId: currentEntry.userId,
            topK: 3,
            minSimilarity: 0.35,
          });
          if (retrievedMemories.length > 0) {
            setActiveRecalledMemories(retrievedMemories);
          }
        } catch {
          // Graceful fallback if offline or no memories exist yet
        }
      }

      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: textToSend,
          mood: currentEntry.mood,
          actionType: 'chat',
          history: newHistory,
          timezone: userTimezone,
          retrievedMemories,
          existingTags: currentEntry.tags || [],
          existingSentiment: currentEntry.sentiment,
          tasks: existingTasks.slice(0, 20).map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, dueTime: t.dueTime, completed: t.completed })),
          events: existingEvents.slice(0, 10).map(e => ({ id: e.id, title: e.title, date: e.date, startTime: e.startTime, endTime: e.endTime, location: e.location })),
          plan: currentPlan?.blocks?.slice(0, 10),
          userLocation: userPreferences?.locationCity || '',
          language: userPreferences?.language || 'auto',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'model',
        content: data.reply,
        timestamp: Date.now(),
        type: 'reflection',
        actionProposal: data.actionProposal,
        locationInfo: data.locationInfo,
        whatNowData: data.whatNowData,
      };

      const updatedTags = Array.from(new Set([...currentEntry.tags, ...(data.tags || [])]));

      const entryWithAiReply: JournalEntry = {
        ...entryWithUserMsg,
        messages: [...newHistory, aiMsg],
        tags: updatedTags,
        sentiment: data.sentiment || currentEntry.sentiment,
        summary: data.summary || currentEntry.summary || '',
        updatedAt: Date.now(),
      };

      onUpdateEntry(entryWithAiReply);
      await onSaveEntry(entryWithAiReply);

      // Store in memory asynchronously
      if (currentEntry.userId) {
        generateAndStoreMemory({
          entry: entryWithAiReply,
          userId: currentEntry.userId,
          preferences: userPreferences,
        }).catch(() => {});
      }
    } catch (err: any) {
      setAiError(err.message || 'Unable to receive response from Gemini. Please try again.');
      setFailedPrompt(textToSend);
    } finally {
      setIsAiLoading(false);
      isSendingRef.current = false;
    }
  };

  // Handle Action Trigger (Reflect, Extract, Summarize)
  const handleAiAction = async (actionType: 'reflect' | 'brainstorm' | 'summarize') => {
    const context = currentEntry.content || currentEntry.messages.map((m) => m.content).join('\n');
    if (!context.trim()) {
      setAiError('Please write a message or reflection first.');
      return;
    }
    setAiError(null);

    try {
      setIsAiLoading(true);

      // Semantic Memory Retrieval (Long-Term AI Memory Directive)
      let retrievedMemories: JournalMemory[] = [];
      if (currentEntry.userId) {
        try {
          retrievedMemories = await searchSemanticMemories({
            query: context.slice(0, 500),
            userId: currentEntry.userId,
            topK: 3,
            minSimilarity: 0.35,
          });
          if (retrievedMemories.length > 0) {
            setActiveRecalledMemories(retrievedMemories);
          }
        } catch {
          // Graceful fallback
        }
      }

      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: context,
          mood: currentEntry.mood,
          actionType,
          history: currentEntry.messages,
          timezone: userTimezone,
          retrievedMemories,
          existingTags: currentEntry.tags || [],
          existingSentiment: currentEntry.sentiment,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AI action request failed');
      }
      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'model',
        content: data.reply,
        timestamp: Date.now(),
        type: actionType === 'summarize' ? 'summary' : actionType === 'brainstorm' ? 'brainstorm' : 'reflection',
      };

      const updatedEntry: JournalEntry = {
        ...currentEntry,
        messages: [...currentEntry.messages, aiMsg],
        summary: actionType === 'summarize' ? (data.reply || data.summary || '') : (data.summary || currentEntry.summary || ''),
        updatedAt: Date.now(),
      };

      onUpdateEntry(updatedEntry);
      await onSaveEntry(updatedEntry);

      if (currentEntry.userId) {
        generateAndStoreMemory({
          entry: updatedEntry,
          userId: currentEntry.userId,
          preferences: userPreferences,
        }).catch(() => {});
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to complete action.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Journal Analysis & Action Approval
  const handleOpenAnalysisAndApproval = async () => {
    const context = currentEntry.content || currentEntry.messages.map((m) => m.content).join('\n');
    if (!context.trim()) {
      setAiError('Write a reflection or some thoughts first before analyzing.');
      return;
    }
    setAiError(null);

    try {
      setIsAnalyzingJournal(true);
      setShowAnalysisModal(true);

      const res = await fetch('/api/gemini/journal-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: context,
          entryTitle: currentEntry.title || 'Journal Reflection',
          mood: currentEntry.mood,
          timezone: userTimezone,
          existingTasks: (existingTasks || []).map((t) => t.title),
          existingEvents: (existingEvents || []).map((e) => e.title),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to analyze journal entry');
      }

      const data: JournalAnalysisResult = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      setAiError(`Journal analysis error: ${err.message}`);
      setShowAnalysisModal(false);
    } finally {
      setIsAnalyzingJournal(false);
    }
  };

  const handleApproveAndSyncActions = async (selectedActions: DetectedActionItem[]) => {
    if (selectedActions.length === 0) return;

    const tasksToSync: ExtractedTask[] = [];
    const eventsToSync: any[] = [];
    const deadlinesToSync: any[] = [];

    for (const item of selectedActions) {
      if (item.type === 'task') {
        tasksToSync.push({
          id: item.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: item.title,
          priority: item.priority || 'medium',
          category: item.category || 'work',
          dueDate: item.dueDate,
          dueTime: item.dueTime || item.startTime,
          estimatedMinutes: item.estimatedMinutes || 25,
          completed: false,
          sourceEntryId: currentEntry.id,
          journalEntryId: currentEntry.id,
        });
      } else if (item.type === 'event') {
        eventsToSync.push({
          title: item.title,
          date: item.dueDate || new Date().toISOString().split('T')[0],
          startTime: item.startTime || item.dueTime || '10:00',
          endTime: item.endTime || '11:00',
          location: item.location,
          color: 'blue',
          sourceEntryId: currentEntry.id,
          journalEntryId: currentEntry.id,
        });
      } else if (item.type === 'deadline') {
        deadlinesToSync.push({
          id: item.id,
          title: item.title,
          deadline: item.dueDate || item.dueTime || 'End of day',
          priority: item.priority || 'high',
        });
        tasksToSync.push({
          id: item.id || `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: `[Deadline] ${item.title}`,
          priority: item.priority === 'critical' ? 'critical' : 'high',
          category: 'work',
          dueDate: item.dueDate,
          dueTime: item.dueTime,
          estimatedMinutes: 30,
          completed: false,
          sourceEntryId: currentEntry.id,
          journalEntryId: currentEntry.id,
        });
      }
    }

    if (onImportTasks && tasksToSync.length > 0) {
      onImportTasks(tasksToSync);
    }

    if (onAddCalendarEvent && eventsToSync.length > 0) {
      for (const ev of eventsToSync) {
        await onAddCalendarEvent(ev);
      }
    }

    const newTags = Array.from(
      new Set([...currentEntry.tags, ...(analysisResult?.recurringThemes || [])])
    );

    const confirmationMsg: ChatMessage = {
      id: `sys_${Date.now()}`,
      role: 'model',
      content: `**Approved Actions Synchronized**:\n- **${tasksToSync.length}** task(s) added to Task Board & linked to this reflection.\n${eventsToSync.length > 0 ? `- **${eventsToSync.length}** calendar event(s) scheduled.\n` : ''}${analysisResult?.goals && analysisResult.goals.length > 0 ? `- Identified Goals: ${analysisResult.goals.join(', ')}\n` : ''}\n*All commitments are verified and active.*`,
      timestamp: Date.now(),
      type: 'extraction',
    };

    onUpdateEntry({
      extractedTasks: [...(currentEntry.extractedTasks || []), ...tasksToSync],
      extractedEvents: [...(currentEntry.extractedEvents || []), ...eventsToSync],
      extractedDeadlines: [...(currentEntry.extractedDeadlines || []), ...deadlinesToSync],
      tags: newTags,
      messages: [...currentEntry.messages, confirmationMsg],
    });

    await onSaveEntry();
  };

  // Structured Task Extraction - now opens approval modal for full user consent
  const handleExtractSchedule = () => {
    handleOpenAnalysisAndApproval();
  };

  // Live Grounding Search
  const handleLiveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQueryPrompt.trim()) return;

    try {
      setIsAiLoading(true);
      const res = await fetch('/api/gemini/search-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQueryPrompt.trim(),
          journalContext: currentEntry.content.slice(0, 1200),
        }),
      });

      if (!res.ok) throw new Error('Live search grounding failed');
      const data = await res.json();

      let formatted = `### Live Context: "${searchQueryPrompt.trim()}"\n\n${data.summary}\n`;
      if (data.sources && data.sources.length > 0) {
        formatted += `\n**Sources:**\n${data.sources.map((s: any) => `- [${s.title}](${s.url})`).join('\n')}`;
      }

      const searchMsg: ChatMessage = {
        id: `search_${Date.now()}`,
        role: 'model',
        content: formatted,
        timestamp: Date.now(),
        type: 'search_context',
      };

      onUpdateEntry({
        messages: [...currentEntry.messages, searchMsg],
      });

      setSearchQueryPrompt('');
      setShowSearchModal(false);
      await onSaveEntry();
    } catch (err: any) {
      setAiError(`Search error: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Clear messages / Reset chat
  const handleClearMessages = () => {
    if (window.confirm('Clear all messages in this conversation?')) {
      onUpdateEntry({
        messages: [],
        content: '',
        extractedTasks: [],
        extractedEvents: [],
        extractedDeadlines: [],
      });
      onSaveEntry();
    }
  };

  // Add Tag
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const clean = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (clean && !currentEntry.tags.includes(clean)) {
        onUpdateEntry({ tags: [...currentEntry.tags, clean] });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onUpdateEntry({ tags: currentEntry.tags.filter((t) => t !== tagToRemove) });
  };

  const hasMessages = currentEntry.messages.length > 0;

  return (
    <div className="bg-[#0F0F0F] border border-zinc-800 rounded-3xl flex flex-col h-[calc(100vh-8.5rem)] min-h-[580px] shadow-2xl relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 sm:px-6 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 bg-[#0F0F0F]/90 backdrop-blur-xs z-10">
        <div className="flex-1 min-w-[200px]">
          <input
            id="chat-title-input"
            type="text"
            value={currentEntry.title}
            onChange={(e) => onUpdateEntry({ title: e.target.value })}
            placeholder="Reflection Title or Topic..."
            className="w-full text-base sm:text-lg font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none bg-transparent tracking-tight"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mood Pill */}
          <div className="relative">
            <button
              onClick={() => setShowMoodMenu(!showMoodMenu)}
              className="px-2.5 py-1 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors flex items-center gap-1.5 capitalize"
            >
              <span>Mindset:</span>
              <span className="text-zinc-100 font-semibold">{currentEntry.mood}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {showMoodMenu && (
              <>
                <div onClick={() => setShowMoodMenu(false)} className="fixed inset-0 z-20" />
                <div className="absolute right-0 top-full mt-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-30 min-w-[140px] space-y-0.5">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        onUpdateEntry({ mood: m.id });
                        setShowMoodMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg transition-colors capitalize ${
                        currentEntry.mood === m.id
                          ? 'bg-zinc-800 text-zinc-100 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Memory Recall Badge */}
          {activeRecalledMemories.length > 0 && (
            <button
              onClick={() => setShowMemoriesModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 rounded-xl transition-colors shadow-sm"
              title="View long-term memories retrieved for this conversation"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>{activeRecalledMemories.length} Memories Linked</span>
            </button>
          )}

          {/* AI Journal Insights & Actions */}
          <button
            onClick={handleOpenAnalysisAndApproval}
            disabled={isAiLoading || isAnalyzingJournal}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors disabled:opacity-50"
            title="Analyze reflection for goals, recurring patterns, and extract actions with approval"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">AI Analysis &amp; Approval</span>
            <span className="sm:hidden">Analyze</span>
          </button>

          {/* Quick Extract Action */}
          <button
            onClick={handleExtractSchedule}
            disabled={isAiLoading || isAnalyzingJournal}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors disabled:opacity-50"
            title="Extract tasks and commitments"
          >
            <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
            <span>Extract Tasks</span>
          </button>

          {/* Live Search */}
          <button
            onClick={() => setShowSearchModal(!showSearchModal)}
            disabled={isAiLoading}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
            title="Search live web context"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Clear Messages */}
          {hasMessages && (
            <button
              onClick={handleClearMessages}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
              title="Clear chat messages"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* New Chat */}
          <button
            onClick={onNewEntry}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-zinc-200 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors"
            title="Start fresh conversation"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Live Search Modal/Bar */}
      {showSearchModal && (
        <form onSubmit={handleLiveSearch} className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center gap-2 animate-fadeIn">
          <input
            type="text"
            value={searchQueryPrompt}
            onChange={(e) => setSearchQueryPrompt(e.target.value)}
            placeholder="Search web for factual context..."
            className="flex-1 px-3.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
            autoFocus
          />
          <button
            type="submit"
            disabled={!searchQueryPrompt.trim() || isAiLoading}
            className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 text-black rounded-xl hover:bg-white disabled:opacity-50"
          >
            Search
          </button>
        </form>
      )}

      {/* Discreet Extraction Status Pill (Tasks are silently auto-synced into main Task Board) */}
      {((currentEntry.extractedTasks?.length || 0) > 0 ||
        (currentEntry.extractedEvents?.length || 0) > 0) && (
        <div className="border-b border-zinc-850 bg-zinc-950/60 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              {(currentEntry.extractedTasks?.length || 0)} action item(s) synced to Task Board
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('tasks')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors"
              >
                View Tasks &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Conversation Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
        {!hasMessages && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10 space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shadow-md">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-zinc-100 tracking-tight">
                Welcome to Gemini Journal Companion
              </h3>
              <p className="text-sm text-zinc-400 max-w-md">
                What would you like to talk about? Reflect on your thoughts, brainstorm ideas, prioritize tasks, or converse naturally via real-time voice.
              </p>
            </div>

            {/* Direct Voice Start CTA */}
            <button
              onClick={startLiveVoice}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Start Real-Time Voice Conversation</span>
            </button>

            {/* Prompt Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left pt-2">
              {PROMPT_SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className="p-3.5 rounded-2xl bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700 text-left transition-all group"
                >
                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                    {item.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {currentEntry.messages.map((msg) => {
          const isModel = msg.role === 'model';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isModel ? 'mr-auto' : 'ml-auto justify-end'}`}
            >
              {isModel && (
                <div className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`p-4 rounded-2xl border text-sm leading-relaxed ${
                  isModel
                    ? 'bg-zinc-900/90 border-zinc-800/90 text-zinc-200'
                    : 'bg-zinc-800 text-zinc-100 border-zinc-700/80'
                }`}
              >
                {/* Content */}
                <div className="markdown-body text-zinc-200 prose prose-invert max-w-none text-xs sm:text-sm">
                  <Markdown>{msg.content}</Markdown>
                </div>

                {/* Grounded Travel & Route Information Card */}
                {msg.locationInfo && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-100">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        <span>Real Grounded Route</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                        OSRM &amp; Open-Meteo
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Origin</div>
                        <div className="text-zinc-200 font-medium truncate mt-0.5">
                          {msg.locationInfo.origin || 'Current Location'}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Destination</div>
                        <div className="text-zinc-200 font-medium truncate mt-0.5">
                          {msg.locationInfo.name || msg.locationInfo.displayName}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      {msg.locationInfo.distanceKm !== undefined && (
                        <div className="flex items-center gap-1 text-zinc-200 font-mono">
                          <Navigation className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            {msg.locationInfo.distanceKm.toFixed(1)} km ({msg.locationInfo.distanceMiles?.toFixed(1) || (msg.locationInfo.distanceKm * 0.621371).toFixed(1)} mi)
                          </span>
                        </div>
                      )}

                      {msg.locationInfo.durationMinutes !== undefined && (
                        <div className="flex items-center gap-1 text-zinc-200 font-mono">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>~{msg.locationInfo.durationMinutes} min drive</span>
                        </div>
                      )}

                      {msg.locationInfo.suggestedDepartureTime && (
                        <div className="flex items-center gap-1 text-amber-300 font-medium">
                          <Car className="w-3.5 h-3.5" />
                          <span>Leave by {msg.locationInfo.suggestedDepartureTime}</span>
                        </div>
                      )}
                    </div>

                    {msg.locationInfo.weatherAdvisory && (
                      <div className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 flex items-center gap-1.5">
                        <span className="text-amber-400 font-medium">Notice:</span> {msg.locationInfo.weatherAdvisory}
                      </div>
                    )}
                  </div>
                )}

                {/* Structured Action Proposal Card */}
                {msg.actionProposal && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-950/90 border-2 border-amber-500/40 space-y-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">
                          Action Proposal: {msg.actionProposal.tool.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {msg.actionProposal.requiresConfirmation && msg.actionProposal.status === 'pending' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Confirmation Required
                        </span>
                      )}

                      {msg.actionProposal.status === 'applied' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Applied to Workspace
                        </span>
                      )}

                      {msg.actionProposal.status === 'dismissed' && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 border border-zinc-800 font-semibold">
                          Dismissed
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-semibold text-zinc-100">
                        {msg.actionProposal.title}
                      </div>
                      {msg.actionProposal.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {msg.actionProposal.description}
                        </p>
                      )}
                    </div>

                    {/* Proposal parameters summary */}
                    {msg.actionProposal.params && Object.keys(msg.actionProposal.params).length > 0 && (
                      <div className="p-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                        {msg.actionProposal.params.priority && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 capitalize font-medium">
                            Priority: {msg.actionProposal.params.priority}
                          </span>
                        )}
                        {msg.actionProposal.params.dueDate && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                            Due: {msg.actionProposal.params.dueDate} {msg.actionProposal.params.dueTime || ''}
                          </span>
                        )}
                        {msg.actionProposal.params.date && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                            Date: {msg.actionProposal.params.date} {msg.actionProposal.params.startTime || ''}
                          </span>
                        )}
                        {msg.actionProposal.params.location && (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                            Loc: {msg.actionProposal.params.location}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Buttons for pending proposal */}
                    {msg.actionProposal.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleApplyProposal(msg.id, msg.actionProposal!)}
                          className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve &amp; Apply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissProposal(msg.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium text-xs transition-all cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* What Now Recommendation Card */}
                {msg.whatNowData && (
                  <div className="mt-3.5 p-3.5 rounded-2xl bg-zinc-950/80 border border-purple-900/60 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                        <Play className="w-3.5 h-3.5 text-purple-400" />
                        <span>Recommended Focus Now</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/60 font-mono">
                        {msg.whatNowData.estimatedMinutes} min
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-zinc-100">
                      {msg.whatNowData.actionTitle}
                    </div>
                    <p className="text-xs text-zinc-400">
                      {msg.whatNowData.reason}
                    </p>
                    {onStartFocus && (
                      <button
                        type="button"
                        onClick={() => onStartFocus(msg.whatNowData?.taskId, msg.whatNowData?.actionTitle)}
                        className="mt-1 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Focus Session</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Footer Controls for AI message */}
                {isModel && (
                  <div className="flex items-center justify-between gap-4 mt-3 pt-2.5 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className="hover:text-zinc-300 flex items-center gap-1 transition-colors"
                        title="Text to speech"
                      >
                        {speakingMessageId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                        <span>{speakingMessageId === msg.id ? 'Stop' : 'Listen'}</span>
                      </button>

                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="hover:text-zinc-300 flex items-center gap-1 transition-colors ml-2"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <span className="text-[10px] text-zinc-600 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>

              {!isModel && (
                <div className="w-7 h-7 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 text-xs font-semibold">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isAiLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto animate-pulse">
            <div className="w-7 h-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl text-xs text-zinc-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Gemini is synthesizing thoughts...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Error Notice */}
      {speechError && (
        <div className="px-4 py-2 text-xs text-amber-400 bg-amber-950/40 border-t border-amber-900/60 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* AI Companion Error Notice with Retry */}
      {aiError && (
        <div className="px-4 py-2.5 text-xs text-rose-300 bg-rose-950/40 border-t border-rose-900/60 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{aiError}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {failedPrompt && (
              <button
                onClick={() => handleSendMessage(failedPrompt)}
                disabled={isAiLoading}
                className="px-2.5 py-1 text-[11px] font-semibold bg-rose-900/60 hover:bg-rose-800/80 text-rose-100 rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => {
                setAiError(null);
                setFailedPrompt(null);
              }}
              className="p-1 text-rose-400 hover:text-rose-200 cursor-pointer"
              title="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* ChatGPT-style Floating Message Input Box */}
      <div className="p-3 sm:p-4 bg-[#0F0F0F] border-t border-zinc-800/80 shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Action Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar text-xs">
            <button
              onClick={() => handleAiAction('reflect')}
              disabled={isAiLoading}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors text-[11px]"
            >
              <Brain className="w-3 h-3 text-amber-400" />
              <span>Reflect</span>
            </button>

            <button
              onClick={() => handleAiAction('brainstorm')}
              disabled={isAiLoading}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors text-[11px]"
            >
              <Lightbulb className="w-3 h-3 text-amber-400" />
              <span>Brainstorm</span>
            </button>

            <button
              onClick={() => handleAiAction('summarize')}
              disabled={isAiLoading}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors text-[11px]"
            >
              <FileText className="w-3 h-3 text-blue-400" />
              <span>Summarize</span>
            </button>

            <button
              onClick={handleOpenAnalysisAndApproval}
              disabled={isAiLoading || isAnalyzingJournal}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0 transition-colors text-[11px] font-medium"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>AI Insights &amp; Approve</span>
            </button>

            <button
              onClick={handleExtractSchedule}
              disabled={isAiLoading || isAnalyzingJournal}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 flex items-center gap-1 shrink-0 transition-colors text-[11px]"
            >
              <ListChecks className="w-3 h-3 text-emerald-400" />
              <span>Extract Tasks</span>
            </button>
          </div>

          {/* Gemini Live Real-Time Voice Bar */}
          {liveVoiceStatus !== 'idle' && liveVoiceStatus !== 'closed' && (
            <div className="p-3 mb-2.5 rounded-2xl bg-zinc-900 border border-amber-500/40 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
                  <span
                    className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping"
                    style={{ animationDuration: liveVoiceStatus === 'speaking' ? '1s' : '1.8s' }}
                  />
                  <Mic className="w-4 h-4 relative z-10" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-300">Gemini Live Voice</span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {liveVoiceStatus === 'connecting' && 'Connecting...'}
                      {liveVoiceStatus === 'requesting_permission' && 'Requesting Mic...'}
                      {liveVoiceStatus === 'listening' && (isLiveMuted ? 'Muted' : 'Listening...')}
                      {liveVoiceStatus === 'processing' && 'Reflecting...'}
                      {liveVoiceStatus === 'speaking' && 'Speaking...'}
                      {liveVoiceStatus === 'error' && 'Connection Error'}
                    </span>
                  </div>
                  {liveTranscript ? (
                    <p className="text-[11px] text-zinc-200 truncate mt-0.5">{liveTranscript}</p>
                  ) : (
                    <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                      {liveVoiceMessage || 'Speak freely in any language'}
                    </p>
                  )}
                </div>
              </div>

              {/* Dynamic Sound Wave visualizer */}
              <div className="hidden sm:flex items-center gap-1 h-5 px-2">
                {[0.5, 0.9, 1.3, 0.7, 1.1].map((multiplier, i) => (
                  <span
                    key={i}
                    className="w-1 bg-amber-400 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(20, (liveAudioLevel * 22 + 4) * multiplier))}px`,
                    }}
                  />
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={toggleLiveMute}
                  className={`p-2 rounded-xl text-xs font-medium border transition-colors ${
                    isLiveMuted
                      ? 'bg-rose-900/40 border-rose-700 text-rose-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                  title={isLiveMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isLiveMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={stopLiveVoice}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                >
                  End Voice
                </button>
              </div>
            </div>
          )}

          {/* Compact Message Box */}
          <div className="relative bg-zinc-900 border border-zinc-800 focus-within:border-zinc-700 rounded-2xl transition-all shadow-lg flex items-center p-1.5 sm:p-2">
            {/* Live Voice Button */}
            <button
              id="chatgpt-voice-btn"
              onClick={toggleSpeech}
              className={`p-2 rounded-xl transition-all ${
                liveVoiceStatus !== 'idle' && liveVoiceStatus !== 'closed'
                  ? 'bg-amber-400 text-black shadow-lg animate-pulse'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title={
                liveVoiceStatus !== 'idle' && liveVoiceStatus !== 'closed'
                  ? 'End Gemini Live Voice session'
                  : 'Start real-time voice conversation'
              }
            >
              {liveVoiceStatus !== 'idle' && liveVoiceStatus !== 'closed' ? (
                <Mic className="w-4 h-4 text-black" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Input textarea */}
            <textarea
              id="chatgpt-message-textarea"
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (inputText.trim() && !isAiLoading && !isSendingRef.current) {
                    handleSendMessage();
                  }
                }
              }}
              placeholder="Ask anything or write your thoughts..."
              rows={1}
              className="flex-1 bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none max-h-32"
            />

            {/* Send Button */}
            <button
              id="chatgpt-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isAiLoading}
              className="p-2 rounded-xl bg-zinc-100 text-black hover:bg-white disabled:opacity-20 disabled:hover:bg-zinc-100 transition-all active:scale-95 shrink-0 cursor-pointer"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-2 pt-1.5">
            <span>Shift + Enter for new line</span>
            <span>Gemini Companion (Gemini 3.8 Flash)</span>
          </div>
        </div>
      </div>

      {/* Recalled Long-Term Memories Modal */}
      {showMemoriesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-zinc-100">Long-Term Memory Units</h3>
                  <p className="text-xs text-zinc-400">Past journal reflections linked to this dialogue</p>
                </div>
              </div>
              <button
                onClick={() => setShowMemoriesModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl"
              >
                <Trash2 className="hidden" />
                <span>&times;</span>
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {activeRecalledMemories.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2 hover:border-purple-800/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">{m.title || 'Untitled Entry'}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {m.content}
                  </p>
                  {m.mood && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 capitalize">
                      Mood: {m.mood}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowMemoriesModal(false)}
                className="px-4 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Journal Analysis & Action Approval Modal */}
      <JournalAnalysisModal
        isOpen={showAnalysisModal}
        onClose={() => setShowAnalysisModal(false)}
        analysis={analysisResult}
        isLoading={isAnalyzingJournal}
        onApproveAndSync={handleApproveAndSyncActions}
        existingTasks={existingTasks}
        existingEvents={existingEvents}
        journalTitle={currentEntry.title}
      />
    </div>
  );
};
