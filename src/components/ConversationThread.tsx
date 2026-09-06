import React, { useState } from 'react';
import { 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Send, 
  Brain, 
  Lightbulb, 
  FileText, 
  Search,
  Bot,
  User as UserIcon
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage } from '../types';

interface ConversationThreadProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  messages,
  onSendMessage,
  isLoading,
}) => {
  const [followUpText, setFollowUpText] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    // Clean markdown characters for pleasant speech
    const cleanText = text.replace(/[#*_`[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim() || isLoading) return;
    onSendMessage(followUpText.trim());
    setFollowUpText('');
  };

  if (messages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Gemini Dialogue</span>
        </h3>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Multi-turn thread</span>
      </div>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.map((msg) => {
          const isModel = msg.role === 'model';
          return (
            <div
              key={msg.id}
              className={`p-5 rounded-2xl border transition-all ${
                isModel
                  ? 'bg-zinc-900/80 border-zinc-800 text-zinc-200'
                  : 'bg-[#0A0A0A] border-zinc-800 text-zinc-100 ml-6'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                      isModel ? 'bg-zinc-800 border border-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isModel ? <Bot className="w-3.5 h-3.5 text-amber-400" /> : <UserIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">
                    {isModel ? 'Gemini Companion (3.8)' : 'You'}
                  </span>
                  {msg.type && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                      {msg.type === 'reflection' && <Brain className="w-2.5 h-2.5 text-amber-400" />}
                      {msg.type === 'brainstorm' && <Lightbulb className="w-2.5 h-2.5 text-amber-400" />}
                      {msg.type === 'summary' && <FileText className="w-2.5 h-2.5 text-blue-400" />}
                      {msg.type === 'search_context' && <Search className="w-2.5 h-2.5 text-emerald-400" />}
                      <span className="capitalize">{msg.type.replace('_', ' ')}</span>
                    </span>
                  )}
                </div>

                {isModel && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleSpeak(msg.id, msg.content)}
                      className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                        speakingMessageId === msg.id
                          ? 'bg-amber-950/50 border border-amber-800/60 text-amber-300 font-medium'
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                      title={speakingMessageId === msg.id ? 'Stop reading' : 'Listen to reflection (TTS)'}
                    >
                      {speakingMessageId === msg.id ? (
                        <VolumeX className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                      title="Copy message"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="text-sm leading-relaxed font-sans prose prose-invert max-w-none text-zinc-300">
                <div className="markdown-body space-y-2">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {isLoading && (
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center gap-3 animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
            </div>
            <div className="text-xs text-zinc-300 font-medium">
              Gemini is distilling thoughts &amp; crafting introspective insights...
            </div>
          </div>
        )}
      </div>

      {/* Multi-Turn Follow-Up Input */}
      <form onSubmit={handleSubmit} className="relative pt-2">
        <input
          id="followup-chat-input"
          type="text"
          value={followUpText}
          onChange={(e) => setFollowUpText(e.target.value)}
          placeholder="Ask a follow-up question or continue exploring this reflection..."
          disabled={isLoading}
          className="w-full pl-4 pr-12 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-all disabled:opacity-50"
        />
        <button
          id="send-followup-chat-btn"
          type="submit"
          disabled={!followUpText.trim() || isLoading}
          className="absolute right-2 top-4 p-2 bg-zinc-100 text-black rounded-lg hover:bg-white disabled:opacity-30 transition-all active:scale-95"
          title="Send follow-up"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
