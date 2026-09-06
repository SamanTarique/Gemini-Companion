import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  BookOpen, 
  Brain, 
  Mic, 
  ListChecks, 
  ArrowRight, 
  CheckCircle2, 
  Feather,
  GitFork,
  AlertCircle,
  X
} from 'lucide-react';
import { signInWithGoogle, formatAuthError } from '../lib/firebase';

interface LandingPageProps {
  onOpenThreatModel: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenThreatModel }) => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<{ title: string; message: string; code?: string; actionHint?: string } | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(formatAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 flex flex-col justify-between selection:bg-zinc-800 selection:text-zinc-100">
      {/* Navigation */}
      <header className="border-b border-zinc-800 bg-[#0F0F0F]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 shadow-sm">
              <Feather className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-zinc-100 uppercase">
                Gemini Companion
              </span>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Smart Life Companion &amp; Journal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-threat-model-btn"
              onClick={onOpenThreatModel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800 uppercase tracking-wider"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Threat Model</span>
            </button>
            <button
              id="landing-signin-btn-header"
              onClick={handleSignIn}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-black bg-zinc-100 hover:bg-white rounded-lg transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <main className="max-w-5xl mx-auto px-6 pt-16 pb-20 flex-1 flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-8">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Smart Life Companion &amp; Reflection</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl font-semibold text-zinc-100 tracking-tight leading-[1.15] max-w-3xl mb-6">
          Welcome to Gemini Journal — <span className="font-medium text-zinc-300">where every thought finds clarity</span>.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed mb-10 font-sans">
          Speak or write freely. Gemini turns your reflections into insights, your commitments into schedules, and keeps all your data isolated and secure.
        </p>

        {/* CTA Card */}
        <div className="w-full max-w-md bg-[#0F0F0F] border border-zinc-800 rounded-2xl p-6 shadow-2xl mb-14">
          <button
            id="landing-signin-btn-hero"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-zinc-100 hover:bg-white text-black font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 shadow-md active:scale-[0.98] disabled:opacity-50 group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          {authError && (
            <div className="mt-4 p-3.5 text-xs bg-rose-950/40 rounded-xl border border-rose-900/60 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-rose-200">{authError.title}</h4>
                    <p className="text-zinc-300 mt-1 leading-relaxed">{authError.message}</p>
                    {authError.actionHint && (
                      <p className="text-zinc-400 mt-2 font-mono text-[11px] bg-black/40 p-2 rounded border border-rose-900/40">
                        {authError.actionHint}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAuthError(null)}
                  className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors shrink-0"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-center gap-4 text-[10px] text-zinc-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div>
              Isolated Firestore
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              No Passwords Stored
            </span>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Card 1 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mb-4">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Multi-Turn AI Reflection</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Engage in multi-turn introspective dialogues. Ask Gemini to summarize, brainstorm constructive actions, or reframe emotional patterns.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Strict User Isolation</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every document is stored under <code className="text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono text-zinc-300">/users/&#123;uid&#125;</code> and protected by Firestore Security Rules.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mb-4">
              <GitFork className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Linked Notes & Themes</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Obsidian-inspired thematic connections. Entries automatically cross-reference shared ideas, and you can export your entire journal as clean Markdown files.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mb-4">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Voice Dictation & Playback</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Dictate your stream-of-consciousness smoothly via native Web Speech API. Listen back to Gemini&apos;s reflections with client-side synthesis.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mb-4">
              <ListChecks className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Smart Schedule Extraction</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Extract tasks, deadlines, and events into structured format normalized to your local IANA timezone without compromising privacy.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-colors shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-zinc-200 text-base mb-1.5">Full Data Sovereignty</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Export everything to Markdown anytime, or permanently purge all records from Firestore with a single confirmed action.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6 bg-[#0A0A0A] text-center text-xs text-zinc-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="uppercase tracking-widest text-[10px]">Gemini-Companion • Firebase Authentication, Cloud Firestore &amp; Gemini 3.8 Flash</span>
          <button
            onClick={onOpenThreatModel}
            className="underline hover:text-zinc-300 transition-colors uppercase tracking-wider text-[10px]"
          >
            Security Threat Model
          </button>
        </div>
      </footer>
    </div>
  );
};
