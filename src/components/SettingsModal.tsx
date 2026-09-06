import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  ShieldCheck, 
  Download, 
  Trash2, 
  MapPin, 
  Globe, 
  Clock, 
  Sliders, 
  Check, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import { UserPreferences, JournalEntry, TaskItem, DailyPlan, FocusSession } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  entries: JournalEntry[];
  tasks: TaskItem[];
  plans: DailyPlan[];
  focusSessions: FocusSession[];
  onOpenThreatModel: () => void;
  onOpenDeleteDataModal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  entries,
  tasks,
  plans,
  focusSessions,
  onOpenThreatModel,
  onOpenDeleteDataModal,
}) => {
  const [cityInput, setCityInput] = useState(preferences.locationCity || '');
  const [langInput, setLangInput] = useState(preferences.language || 'auto');
  const [tzInput, setTzInput] = useState(preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [workStart, setWorkStart] = useState(preferences.workdayStart || '09:00');
  const [workEnd, setWorkEnd] = useState(preferences.workdayEnd || '18:00');
  const [isSaved, setIsSaved] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  if (!isOpen) return null;

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          if (res.ok) {
            const data = await res.json();
            const cityName = data.address?.city || data.address?.town || data.address?.village || data.address?.state || 'Current Location';
            setCityInput(cityName);
          }
        } catch {
          setCityInput(`${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdatePreferences({
      locationCity: cityInput.trim(),
      language: langInput,
      timezone: tzInput.trim(),
      workdayStart: workStart,
      workdayEnd: workEnd,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleExportAllJSON = () => {
    const exportBundle = {
      exportedAt: new Date().toISOString(),
      preferences,
      tasks,
      plans,
      focusSessions,
      entries,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gemini_companion_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#0F0F0F] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-zinc-100 tracking-tight">
                Companion Settings &amp; Privacy
              </h3>
              <p className="text-xs text-zinc-400">
                Configure your environment, security controls, and exported records.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preferences Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
            <span>Operational Preferences</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Current City / Location</span>
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isLocating}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50"
                >
                  {isLocating ? 'Detecting...' : 'Detect GPS'}
                </button>
              </div>
              <input
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="e.g. Lahore, Karachi, London (or leave empty)"
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <span>Language / زبان</span>
              </label>
              <select
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600"
              >
                <option value="auto">Auto (خودکار / Detect)</option>
                <option value="ur">Urdu (اردو)</option>
                <option value="en">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ja">日本語 (Japanese)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-500" />
                <span>IANA Timezone</span>
              </label>
              <input
                type="text"
                value={tzInput}
                onChange={(e) => setTzInput(e.target.value)}
                placeholder="e.g. Asia/Karachi, America/New_York"
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-zinc-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Default Workday Start</span>
              </label>
              <input
                type="time"
                value={workStart}
                onChange={(e) => setWorkStart(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Default Workday End</span>
              </label>
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setWorkEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-black font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              <span>{isSaved ? 'Preferences Saved' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>

        {/* Data & Security Section */}
        <div className="pt-4 border-t border-zinc-800 space-y-3">
          <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Data Sovereignty &amp; Threat Model</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExportAllJSON}
              className="p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left flex items-start gap-3 transition-colors"
            >
              <Download className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">Export All My Data (JSON)</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Download all tasks, plans, journals, and focus records.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenThreatModel();
              }}
              className="p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left flex items-start gap-3 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-zinc-200">View Threat Model &amp; Audit</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Review the 5 Threat Zones and Firestore security enforcement.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Danger Zone: User Data Purge */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-2">
          <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Danger Zone</span>
          </h4>

          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-rose-300">Permanent Account &amp; Data Purge</div>
              <div className="text-[11px] text-rose-400/80 mt-0.5">
                Irreversibly delete all your Firestore collections under your isolated account.
              </div>
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenDeleteDataModal();
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-md"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete My Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
