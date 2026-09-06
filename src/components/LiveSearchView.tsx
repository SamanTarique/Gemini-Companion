import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Calendar,
  CheckSquare,
  Bell,
  Check,
  X,
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Navigation,
  Car,
  RotateCcw,
} from 'lucide-react';
import {
  LiveSearchResult,
  SuggestedAction,
  TaskItem,
  CalendarEvent,
  UserPreferences,
} from '../types';
import { executeLiveSearch } from '../services/liveSearchService';
import { resolveEffectiveLanguage, isUrduOrRomanUrdu, t } from '../lib/i18n';

function cleanErrorMessage(msg: string): string {
  if (!msg) return 'Failed to complete search.';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    return 'Gemini API quota or rate limit reached. Please wait a few seconds and try again.';
  }
  try {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error && parsed.error.message) {
        return cleanErrorMessage(parsed.error.message);
      }
    }
  } catch {}
  return msg.replace(/^Failed to generate search results:\s*/, '').trim();
}

interface LiveSearchViewProps {
  tasks: TaskItem[];
  events: CalendarEvent[];
  preferences: UserPreferences;
  onApproveAction: (action: SuggestedAction) => Promise<void>;
  initialQuery?: string;
}

export const LiveSearchView: React.FC<LiveSearchViewProps> = ({
  tasks,
  events,
  preferences,
  onApproveAction,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [includeContext, setIncludeContext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LiveSearchResult | null>(null);
  const [approvedActionIds, setApprovedActionIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());

  // Geolocation states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; displayName?: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Active language resolution
  const activeLanguage = resolveEffectiveLanguage(preferences?.language, query || lastSubmittedQuery);
  const isUrdu = activeLanguage === 'ur';

  // Request real browser geolocation
  const requestBrowserLocation = (): Promise<{ lat: number; lng: number; displayName?: string } | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        setLocationError('Geolocation is not supported by your browser.');
        resolve(null);
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          let displayName = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
              headers: { 'User-Agent': 'GeminiCompanion/1.0' },
            });
            if (res.ok) {
              const data = await res.json();
              displayName = data.display_name || displayName;
            }
          } catch {
            // Use coordinates
          }

          const loc = { lat, lng, displayName };
          setUserLocation(loc);
          setIsLocating(false);
          resolve(loc);
        },
        (err) => {
          setIsLocating(false);
          if (err.code === err.PERMISSION_DENIED) {
            setLocationError('Location access was denied. Please allow location in browser settings to calculate real road distance.');
          } else {
            setLocationError('Could not retrieve current position.');
          }
          resolve(null);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  // Quick prompt suggestions (bilingual)
  const samplePrompts = isUrdu
    ? [
        'اسلام آباد سے لاہور تک سڑک کا فاصلہ اور سفر کا وقت کیا ہے؟',
        'آج کا موسم اور میرے شیڈول کے اہم کام کیا ہیں؟',
        'ٹیک کانفرنسز اور اہم ڈیڈ لائنز 2025',
        'کیا مجھے کل کی میٹنگ کے لیے تیاری کرنی چاہیے؟',
      ]
    : [
        'How far is the airport from my current location and travel time?',
        'Upcoming tech conferences and key submission deadlines in 2025',
        'Weather forecast and daylight hours for planning outdoor workouts',
        'Travel route and road distance to downtown center',
      ];

  // Navigate back in history
  const handleHistoryPrev = () => {
    if (searchHistory.length === 0) return;
    let nextIdx: number;
    if (historyIndex === -1) {
      nextIdx = searchHistory.length - 1;
    } else {
      nextIdx = Math.max(0, historyIndex - 1);
    }
    setHistoryIndex(nextIdx);
    setQuery(searchHistory[nextIdx]);
  };

  // Navigate forward in history
  const handleHistoryNext = () => {
    if (historyIndex === -1) return;
    const nextIdx = historyIndex + 1;
    if (nextIdx >= searchHistory.length) {
      setHistoryIndex(-1);
      setQuery('');
    } else {
      setHistoryIndex(nextIdx);
      setQuery(searchHistory[nextIdx]);
    }
  };

  // Keyboard navigation for history (Up / Down)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && (query === '' || historyIndex !== -1)) {
      e.preventDefault();
      handleHistoryPrev();
    } else if (e.key === 'ArrowDown' && historyIndex !== -1) {
      e.preventDefault();
      handleHistoryNext();
    }
  };

  const handleSearch = async (searchQuery?: string, explicitLocation?: { lat: number; lng: number; displayName?: string } | null) => {
    const q = (searchQuery !== undefined ? searchQuery : query).trim();
    if (!q) return;

    // 1. Save to search history
    setSearchHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === q) return prev;
      return [...prev, q];
    });
    setHistoryIndex(-1);

    // 2. CRITICAL UX: Immediately clear the input field after sending
    setLastSubmittedQuery(q);
    setQuery('');

    setIsLoading(true);
    setError(null);

    // Check if query is travel/location related
    const isTravelQuery = /\b(how far|distance|kilometer|kilometre|km\b|miles?\b|how long will it take|travel time|when should i leave|show me the route|route to|directions to|navigate to|kitna door|kitna fasla|rasta|raste|kitna time|jane mein kitna)\b/i.test(q);

    let activeLoc = explicitLocation !== undefined ? explicitLocation : userLocation;

    // If query asks about travel from here and we don't have location, try acquiring it
    if (isTravelQuery && !activeLoc && !q.toLowerCase().includes('from ')) {
      const acquired = await requestBrowserLocation();
      if (acquired) {
        activeLoc = acquired;
      }
    }

    try {
      const searchRes = await executeLiveSearch({
        query: q,
        includeUserContext: includeContext,
        tasks,
        events,
        preferences,
        timezone: preferences.timezone,
        userLocation: activeLoc,
        language: preferences.language || 'auto',
      });
      setResult(searchRes);
    } catch (err: any) {
      setError(err.message || 'Failed to complete search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (action: SuggestedAction) => {
    setApprovingId(action.id);
    try {
      await onApproveAction(action);
      setApprovedActionIds((prev) => new Set([...prev, action.id]));
    } catch (err: any) {
      setError(`Failed to save action: ${err.message || 'Unknown error'}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDismiss = (actionId: string) => {
    setDismissedActionIds((prev) => new Set([...prev, actionId]));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                {t('search.title', activeLanguage, 'AI Live Search & Intelligence')}
              </h1>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {t('search.subtitle', activeLanguage, 'Real-time Google search grounding combined with your calendar, tasks, and real road routing.')}
            </p>
          </div>

          {/* Location & Privacy badges */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {userLocation ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate max-w-[200px]" title={userLocation.displayName}>
                  GPS: {userLocation.displayName?.split(',')[0]}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => requestBrowserLocation()}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 transition-colors"
                title="Detect your real current coordinates for accurate road navigation"
              >
                {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <span>{isLocating ? 'Detecting...' : isUrdu ? 'موجودہ مقام شامل کریں' : 'Use Current Location'}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{isUrdu ? 'نجی شیڈول محفوظ' : 'Private Schedule Guarded'}</span>
            </div>
          </div>
        </div>

        {/* Search Bar Form with Compact History Navigation */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="mt-6"
        >
          <div className="relative flex items-center">
            {/* History Navigation Buttons (ChatGPT style ← / →) */}
            <div className="absolute left-2.5 z-10 flex items-center gap-1">
              <button
                type="button"
                onClick={handleHistoryPrev}
                disabled={searchHistory.length === 0 || historyIndex === 0}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Previous sent prompt (←)"
                aria-label="Previous prompt"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleHistoryNext}
                disabled={historyIndex === -1}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-700/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Next sent prompt (→)"
                aria-label="Next prompt"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isUrdu
                  ? 'کوئی بھی سوال، تازہ ترین معلومات، سفری فاصلہ یا شیڈول تلاش کریں...'
                  : 'Search live information, road distance, travel route, or schedule...'
              }
              className="w-full pl-20 pr-28 py-3.5 bg-stone-50 dark:bg-stone-800/70 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm md:text-base transition-all"
            />

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isUrdu ? 'تلاش جاری...' : 'Searching...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isUrdu ? 'تلاش کریں' : 'Search'}</span>
                </>
              )}
            </button>
          </div>

          {/* Prompt History Index Indicator */}
          {historyIndex !== -1 && searchHistory.length > 0 && (
            <div className="mt-1.5 px-2 flex items-center justify-between text-[11px] text-stone-400">
              <span>
                Prompt history {historyIndex + 1} of {searchHistory.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setHistoryIndex(-1);
                  setQuery('');
                }}
                className="hover:underline text-stone-500"
              >
                Clear input (Exit history)
              </button>
            </div>
          )}

          {/* Toggle contextual synthesis */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-stone-600 dark:text-stone-400">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">
                {isUrdu ? 'میرے شیڈول اور ٹاسکس کے ساتھ جوڑیں' : 'Synthesize with my current schedule & tasks'}
              </span>
              <span className="text-stone-400 dark:text-stone-500">
                ({tasks.filter((t) => !t.completed).length} active tasks, {events.length} events loaded)
              </span>
            </label>

            <span className="text-stone-400">Powered by Google Search Grounding & OSRM</span>
          </div>
        </form>

        {/* Location Notice / Error */}
        {locationError && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{locationError}</span>
            </div>
            <button
              type="button"
              onClick={() => requestBrowserLocation()}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded text-xs font-medium shrink-0"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Quick sample chips */}
        {!result && !isLoading && (
          <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2.5">
              {t('search.suggestedPrompts', activeLanguage, 'Suggested Searches')}
            </p>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    handleSearch(prompt);
                  }}
                  className="text-left text-xs bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-300 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 transition-colors flex items-center gap-1.5"
                >
                  <Search className="w-3 h-3 text-stone-400" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">
                {error.includes('quota') || error.includes('429') ? 'Rate Limit / Quota Notice' : 'Search Notice'}
              </p>
              <p className="text-xs mt-1 text-zinc-300 leading-relaxed">{cleanErrorMessage(error)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleSearch(lastSubmittedQuery)}
            className="px-3 py-1.5 shrink-0 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Location Permission Prompt Banner (When travel query was requested relative to user but location wasn't enabled) */}
          {result.requiresLocationPermission && (
            <div className="p-4 sm:p-5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-blue-100">
                    {isUrdu ? 'موجودہ لوکیشن کی اجازت درکار ہے' : 'Browser Location Permission Required'}
                  </h4>
                  <p className="text-xs text-blue-200/80 mt-1 leading-relaxed">
                    {isUrdu
                      ? 'اصل سڑک کا فاصلہ، سفر کا وقت اور درست روٹ معلوم کرنے کے لیے براؤزر کی لوکیشن اجازت درکار ہے۔ ہم کبھی فرضی شہر کا اندازہ نہیں لگاتے۔'
                      : 'To calculate real road distance and travel duration from where you are, please allow location access. We never guess fake default cities like San Francisco.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLocating}
                onClick={async () => {
                  const loc = await requestBrowserLocation();
                  if (loc) {
                    handleSearch(result.query, loc);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-2 transition-all shadow-sm"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                <span>{isUrdu ? 'لوکیشن فعال کریں' : 'Allow Location Access'}</span>
              </button>
            </div>
          )}

          {/* Real Route Summary Card (When live road routing is calculated) */}
          {result.routeInfo && (
            <div className="bg-stone-900 border border-emerald-500/40 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                  <Car className="w-4 h-4" />
                  <span>{isUrdu ? 'سفری روٹ اور فاصلے کی تفصیلات' : 'Live Road Navigation & Distance'}</span>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {result.routeInfo.liveRoutingAvailable ? 'OSRM Live Routing' : 'Physical Distance'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
                <div className="p-3 rounded-lg bg-stone-800/70 border border-stone-700/60">
                  <span className="text-[11px] text-stone-400 block">{isUrdu ? 'سڑک کا فاصلہ' : 'Road Distance'}</span>
                  <p className="text-base font-bold text-white mt-0.5">
                    {result.routeInfo.distanceKm} km{' '}
                    <span className="text-xs font-normal text-stone-400">({result.routeInfo.distanceMiles} mi)</span>
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-stone-800/70 border border-stone-700/60">
                  <span className="text-[11px] text-stone-400 block">{isUrdu ? 'تخمینہ وقت' : 'Estimated Travel Time'}</span>
                  <p className="text-base font-bold text-emerald-400 mt-0.5">
                    {result.routeInfo.durationMinutes >= 60
                      ? `${Math.floor(result.routeInfo.durationMinutes / 60)}h ${result.routeInfo.durationMinutes % 60}m`
                      : `${result.routeInfo.durationMinutes} min`}{' '}
                    <span className="text-xs font-normal text-stone-400">({result.routeInfo.mode})</span>
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-stone-800/70 border border-stone-700/60">
                  <span className="text-[11px] text-stone-400 block">{isUrdu ? 'منزل' : 'Destination'}</span>
                  <p className="text-xs font-semibold text-stone-200 mt-0.5 truncate" title={result.routeInfo.destination}>
                    {result.routeInfo.destination.split(',')[0]}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Answer Card - Compact, clean, no generic hello greeting */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {isUrdu ? 'لائیو جواب' : 'Grounded Answer'}
                </span>
              </div>
              <span className="text-xs text-stone-400">
                {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Answer Content */}
            <div className="prose prose-stone dark:prose-invert max-w-none text-stone-800 dark:text-stone-200 text-sm leading-relaxed whitespace-pre-wrap">
              {result.answer}
            </div>

            {/* Context Badge if used */}
            {result.contextUsed && (
              <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {isUrdu
                    ? `آپ کے شیڈول کے ساتھ ہم آہنگ: ${result.contextUsed.tasksCount} ٹاسکس، ${result.contextUsed.eventsCount} ایونٹس`
                    : `Synthesized with schedule: ${result.contextUsed.tasksCount} active tasks, ${result.contextUsed.eventsCount} events`}
                </span>
              </div>
            )}
          </div>

          {/* Suggested Actions for Approval */}
          {result.suggestedActions && result.suggestedActions.length > 0 && (
            <div className="bg-white dark:bg-stone-900 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {isUrdu ? 'تجویز کردہ ٹاسکس اور کیلنڈر اپائنٹمنٹس' : 'Suggested Actions & Commitments'}
                  </h3>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 font-medium">
                  {isUrdu ? 'جائزہ لیں اور منظور کریں' : 'Review & Approve'}
                </span>
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
                {isUrdu
                  ? 'Gemini نے تلاش کے نتائج سے درج ذیل ممکنہ کام دریافت کیے ہیں۔ اپنے شیڈول میں شامل کرنے سے پہلے جائزہ لیں:'
                  : 'Review detected tasks or commitments before adding them to your schedule:'}
              </p>

              <div className="space-y-3">
                {result.suggestedActions
                  .filter((action) => !dismissedActionIds.has(action.id))
                  .map((action) => {
                    const isApproved = approvedActionIds.has(action.id);
                    const isProcessing = approvingId === action.id;

                    return (
                      <div
                        key={action.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isApproved
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-stone-50/80 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  action.type === 'event'
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                    : action.type === 'reminder'
                                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                                    : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {action.type.toUpperCase()}
                              </span>
                              <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm">{action.title}</h4>
                            </div>

                            {action.description && (
                              <p className="text-xs text-stone-600 dark:text-stone-300">{action.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400 pt-1">
                              {action.date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                                  <span>{action.date}</span>
                                </span>
                              )}
                              {(action.startTime || action.endTime) && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                                  <span>
                                    {action.startTime || '--:--'} - {action.endTime || '--:--'}
                                  </span>
                                </span>
                              )}
                              {action.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                                  <span>{action.location}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Approval Controls */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {isApproved ? (
                              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                                <Check className="w-4 h-4" />
                                <span>{isUrdu ? 'شامل کر دیا گیا' : 'Added'}</span>
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDismiss(action.id)}
                                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-colors"
                                  title="Dismiss suggestion"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleApprove(action)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                                >
                                  {isProcessing ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isUrdu ? 'منظور کریں' : 'Approve & Add'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Sources & Citations */}
          {result.sources && result.sources.length > 0 && (
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                  <span>{isUrdu ? 'مصدقہ ذرائع اور لنکس' : 'Grounding Sources & Citations'}</span>
                </div>
                <span className="text-xs text-stone-400">{result.sources.length} sources verified</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 rounded-lg border border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 hover:bg-stone-100/80 dark:hover:bg-stone-800/80 transition-colors flex items-start justify-between gap-2 group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-stone-800 dark:text-stone-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {src.title || src.url}
                      </p>
                      <p className="text-[11px] text-stone-400 truncate mt-0.5">{src.url}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-500 shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
