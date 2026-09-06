import React, { useState, useEffect } from 'react';
import { 
  User, 
  Clock, 
  Calendar as CalendarIcon, 
  Briefcase, 
  Bell, 
  BellRing, 
  Sparkles, 
  Shield, 
  Check, 
  Save, 
  RotateCcw, 
  Volume2, 
  Vibrate, 
  Sliders, 
  Download, 
  Trash2, 
  ShieldCheck,
  AlertTriangle,
  Info,
  Globe
} from 'lucide-react';
import { 
  UserPreferences, 
  DEFAULT_USER_PREFERENCES, 
  JournalEntry, 
  TaskItem, 
  DailyPlan, 
  FocusSession,
  GoogleIntegrationMetadata,
  GmailDetectedItem,
  CalendarEvent
} from '../types';
import { playNotificationSound, triggerVibration } from '../services/notificationService';
import { GoogleWorkspacePanel } from './GoogleWorkspacePanel';
import { getGoogleIntegrationMetadata } from '../services/googleWorkspaceService';

interface SettingsViewProps {
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  entries: JournalEntry[];
  tasks: TaskItem[];
  plans: DailyPlan[];
  focusSessions: FocusSession[];
  userId?: string;
  onOpenThreatModel?: () => void;
  onOpenDeleteDataModal?: () => void;
  onImportCalendarEvents?: (events: CalendarEvent[]) => Promise<void>;
  onApproveCommitment?: (item: GmailDetectedItem) => Promise<void>;
}

type SettingsSection = 
  | 'profile' 
  | 'timedate' 
  | 'schedule' 
  | 'reminders' 
  | 'notifications' 
  | 'ai' 
  | 'integrations'
  | 'privacy';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon', full: 'Monday' },
  { id: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { id: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { id: 'thursday', label: 'Thu', full: 'Thursday' },
  { id: 'friday', label: 'Fri', full: 'Friday' },
  { id: 'saturday', label: 'Sat', full: 'Saturday' },
  { id: 'sunday', label: 'Sun', full: 'Sunday' },
];

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onUpdatePreferences,
  entries,
  tasks,
  plans,
  focusSessions,
  userId,
  onOpenThreatModel,
  onOpenDeleteDataModal,
  onImportCalendarEvents,
  onApproveCommitment,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [formState, setFormState] = useState<UserPreferences>({
    ...DEFAULT_USER_PREFERENCES,
    ...preferences,
  });

  const [integrationMeta, setIntegrationMeta] = useState<GoogleIntegrationMetadata | null>(null);

  useEffect(() => {
    if (userId) {
      getGoogleIntegrationMetadata(userId).then(setIntegrationMeta);
    }
  }, [userId]);

  const handleRefreshIntegrationMeta = async () => {
    if (userId) {
      const meta = await getGoogleIntegrationMetadata(userId);
      setIntegrationMeta(meta);
    }
  };

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('');

  const handleChange = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleWorkingDay = (dayId: string) => {
    const current = formState.workingDays || [];
    if (current.includes(dayId)) {
      if (current.length > 1) {
        handleChange('workingDays', current.filter((d) => d !== dayId));
      }
    } else {
      handleChange('workingDays', [...current, dayId]);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      await onUpdatePreferences(formState);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Reset all settings to recommended defaults?')) {
      setFormState({ ...DEFAULT_USER_PREFERENCES });
    }
  };

  const handleTestSound = () => {
    playNotificationSound(formState.soundPreference);
    triggerVibration(formState.vibrationPreference);
  };

  const handleAddCustomReminderTime = () => {
    const mins = parseInt(customMinutesInput, 10);
    if (!isNaN(mins) && mins > 0 && !formState.customReminderTimes.includes(mins)) {
      const updated = [...formState.customReminderTimes, mins].sort((a, b) => a - b);
      handleChange('customReminderTimes', updated);
      setCustomMinutesInput('');
    }
  };

  const handleRemoveCustomReminderTime = (mins: number) => {
    const updated = formState.customReminderTimes.filter((m) => m !== mins);
    handleChange('customReminderTimes', updated);
  };

  const handleExportAllJSON = () => {
    const exportBundle = {
      exportedAt: new Date().toISOString(),
      preferences: formState,
      tasks,
      plans,
      focusSessions,
      entries,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gemini_life_companion_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const sections: { id: SettingsSection; label: string; icon: any; description: string }[] = [
    { id: 'profile', label: 'Profile', icon: User, description: 'Personal identity & language' },
    { id: 'timedate', label: 'Time & Date', icon: Clock, description: 'Clocks, timezone & calendar defaults' },
    { id: 'schedule', label: 'Schedule', icon: Briefcase, description: 'Work hours, focus slots & buffers' },
    { id: 'reminders', label: 'Reminders', icon: BellRing, description: 'Offsets, snoozing & recurrences' },
    { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Quiet hours, protections & alerts' },
    { id: 'ai', label: 'AI Preferences', icon: Sparkles, description: 'Gemini planner & memory tuning' },
    { id: 'integrations', label: 'Google Workspace', icon: Globe, description: 'Google Calendar & Gmail integration' },
    { id: 'privacy', label: 'Privacy & Permissions', icon: Shield, description: 'Sensor access & data backups' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2.5">
            <span>Settings &amp; Preferences</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Tailor your routine, context-aware alerts, and Gemini AI planning behavior.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          {isSaved && (
            <span 
              id="settings-saved-feedback"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-medium animate-fadeIn"
              role="status"
              aria-live="polite"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Preferences saved</span>
            </span>
          )}

          <button
            type="button"
            id="btn-reset-defaults"
            onClick={handleResetToDefaults}
            className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            title="Reset to default settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Defaults</span>
          </button>

          <button
            type="button"
            id="btn-save-settings"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-zinc-950 font-semibold text-xs sm:text-sm rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Container: Side navigation + Grouped form panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Navigation Sidebar */}
        <nav 
          aria-label="Settings categories"
          className="md:col-span-4 lg:col-span-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none"
        >
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                id={`settings-tab-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                aria-selected={isActive}
                role="tab"
                className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all whitespace-nowrap md:whitespace-normal w-full border ${
                  isActive
                    ? 'bg-zinc-800/90 text-amber-300 border-amber-500/30 font-medium shadow-sm'
                    : 'bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800/60'
                } focus:outline-none focus:ring-2 focus:ring-amber-400`}
              >
                <div className={`p-2 rounded-xl border ${
                  isActive 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                    : 'bg-zinc-800/60 border-zinc-700/50 text-zinc-400'
                }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm tracking-tight">{sec.label}</div>
                  <div className="text-[11px] text-zinc-500 hidden md:block truncate">
                    {sec.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Active Content Section */}
        <div className="md:col-span-8 lg:col-span-9 bg-[#0F0F0F] border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-xl">
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. PROFILE */}
            {activeSection === 'profile' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-profile">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Profile Settings</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Customize your display name, avatar, and preferred language.</p>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label htmlFor="pref-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Display Name
                    </label>
                    <input
                      id="pref-name"
                      type="text"
                      value={formState.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-2">
                      Profile Avatar
                    </label>
                    <div className="flex items-center gap-3 mb-3">
                      {formState.profileImage ? (
                        <img
                          src={formState.profileImage}
                          alt="Selected profile avatar"
                          className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400 shadow-md"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold text-lg">
                          {formState.name ? formState.name[0].toUpperCase() : 'U'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <input
                          id="pref-profile-image-url"
                          type="url"
                          value={formState.profileImage}
                          onChange={(e) => handleChange('profileImage', e.target.value)}
                          placeholder="Or paste custom image URL..."
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Presets:</span>
                      <div className="flex gap-2">
                        {AVATAR_PRESETS.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleChange('profileImage', url)}
                            className={`w-8 h-8 rounded-xl overflow-hidden border-2 transition-transform ${
                              formState.profileImage === url ? 'border-amber-400 scale-105' : 'border-transparent hover:border-zinc-600'
                            }`}
                          >
                            <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pref-language" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Language / زبان
                    </label>
                    <select
                      id="pref-language"
                      value={formState.language}
                      onChange={(e) => handleChange('language', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
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
                </div>
              </div>
            )}

            {/* 2. TIME & DATE */}
            {activeSection === 'timedate' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-timedate">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Time &amp; Date Settings</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Configure hour format, calendar start day, and timezone precision.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="pref-timeformat" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Time Format
                    </label>
                    <select
                      id="pref-timeformat"
                      value={formState.timeFormat}
                      onChange={(e) => handleChange('timeFormat', e.target.value as '12h' | '24h')}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="12h">12-Hour (e.g. 02:30 PM)</option>
                      <option value="24h">24-Hour (e.g. 14:30)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="pref-timezone" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Timezone
                    </label>
                    <select
                      id="pref-timezone"
                      value={COMMON_TIMEZONES.includes(formState.timezone) ? formState.timezone : 'custom'}
                      onChange={(e) => {
                        if (e.target.value !== 'custom') {
                          handleChange('timezone', e.target.value);
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      {COMMON_TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>
                          {tz === 'Asia/Karachi' ? 'Asia/Karachi (Pakistan Standard Time, UTC+05:00)' : tz}
                        </option>
                      ))}
                      {!COMMON_TIMEZONES.includes(formState.timezone) && (
                        <option value="custom">Custom: {formState.timezone}</option>
                      )}
                    </select>
                    {!COMMON_TIMEZONES.includes(formState.timezone) && (
                      <input
                        type="text"
                        value={formState.timezone}
                        onChange={(e) => handleChange('timezone', e.target.value)}
                        placeholder="Enter IANA timezone e.g. Asia/Karachi"
                        className="mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="pref-dateformat" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Date Format
                    </label>
                    <select
                      id="pref-dateformat"
                      value={formState.dateFormat}
                      onChange={(e) => handleChange('dateFormat', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="MMM D, YYYY">Sep 3, 2026 (MMM D, YYYY)</option>
                      <option value="YYYY-MM-DD">2026-09-03 (YYYY-MM-DD)</option>
                      <option value="MM/DD/YYYY">09/03/2026 (MM/DD/YYYY)</option>
                      <option value="DD/MM/YYYY">03/09/2026 (DD/MM/YYYY)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="pref-weekstarts" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Week Starts On
                    </label>
                    <select
                      id="pref-weekstarts"
                      value={formState.weekStartsOn}
                      onChange={(e) => {
                        const val = e.target.value as 'monday' | 'sunday' | 'saturday';
                        handleChange('weekStartsOn', val);
                        handleChange('firstDayOfWeek', val === 'sunday' ? 0 : val === 'saturday' ? 6 : 1);
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="monday">Monday</option>
                      <option value="sunday">Sunday</option>
                      <option value="saturday">Saturday</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="pref-calendarview" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Default Calendar View
                    </label>
                    <select
                      id="pref-calendarview"
                      value={formState.defaultCalendarView}
                      onChange={(e) => handleChange('defaultCalendarView', e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="day">Day Focus View</option>
                      <option value="week">Week Overview</option>
                      <option value="month">Monthly Grid</option>
                      <option value="timeline">Time-Blocked Timeline</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SCHEDULE */}
            {activeSection === 'schedule' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-schedule">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Schedule &amp; Workday Rhythm</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Defines your work hours, deep work focus windows, meeting blocks, and travel buffers.
                  </p>
                </div>

                {/* Working Days Selector */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">
                    Working Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = formState.workingDays?.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          id={`working-day-${d.id}`}
                          onClick={() => toggleWorkingDay(d.id)}
                          aria-pressed={isSelected}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/40 shadow-xs'
                              : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
                          } focus:outline-none focus:ring-2 focus:ring-amber-400`}
                        >
                          {d.full}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Working Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="pref-workstart" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Workday Start Time
                    </label>
                    <input
                      id="pref-workstart"
                      type="time"
                      value={formState.workdayStart}
                      onChange={(e) => handleChange('workdayStart', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="pref-workend" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Workday End Time
                    </label>
                    <input
                      id="pref-workend"
                      type="time"
                      value={formState.workdayEnd}
                      onChange={(e) => handleChange('workdayEnd', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Preferred Focus Hours */}
                <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Preferred Deep Focus Hours (Peak Cognition)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pref-focusstart" className="block text-xs text-zinc-400 mb-1">
                        Focus Start
                      </label>
                      <input
                        id="pref-focusstart"
                        type="time"
                        value={formState.preferredFocusStart}
                        onChange={(e) => handleChange('preferredFocusStart', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="pref-focusend" className="block text-xs text-zinc-400 mb-1">
                        Focus End
                      </label>
                      <input
                        id="pref-focusend"
                        type="time"
                        value={formState.preferredFocusEnd}
                        onChange={(e) => handleChange('preferredFocusEnd', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Preferred Meeting Hours */}
                <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-200 font-medium text-xs">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    <span>Preferred Meeting Hours</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pref-meetstart" className="block text-xs text-zinc-400 mb-1">
                        Meetings Start
                      </label>
                      <input
                        id="pref-meetstart"
                        type="time"
                        value={formState.preferredMeetingStart}
                        onChange={(e) => handleChange('preferredMeetingStart', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label htmlFor="pref-meetend" className="block text-xs text-zinc-400 mb-1">
                        Meetings End
                      </label>
                      <input
                        id="pref-meetend"
                        type="time"
                        value={formState.preferredMeetingEnd}
                        onChange={(e) => handleChange('preferredMeetingEnd', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Durations & Buffers */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label htmlFor="pref-taskduration" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Default Task Duration ({formState.defaultTaskDuration} min)
                    </label>
                    <input
                      id="pref-taskduration"
                      type="range"
                      min={15}
                      max={120}
                      step={5}
                      value={formState.defaultTaskDuration}
                      onChange={(e) => handleChange('defaultTaskDuration', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="pref-breakduration" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Default Break Duration ({formState.defaultBreakDuration} min)
                    </label>
                    <input
                      id="pref-breakduration"
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={formState.defaultBreakDuration}
                      onChange={(e) => handleChange('defaultBreakDuration', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="pref-travelbuffer" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Travel / Transition Buffer ({formState.travelBufferMinutes} min)
                    </label>
                    <input
                      id="pref-travelbuffer"
                      type="range"
                      min={0}
                      max={60}
                      step={5}
                      value={formState.travelBufferMinutes}
                      onChange={(e) => handleChange('travelBufferMinutes', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. REMINDERS */}
            {activeSection === 'reminders' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-reminders">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Reminders Configuration</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Customize lead times, snooze durations, and automated recurring &amp; deadline alerts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label htmlFor="pref-defreminder" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Default Reminder Time Before Events / Deadlines
                    </label>
                    <select
                      id="pref-defreminder"
                      value={formState.defaultReminderMinutesBefore}
                      onChange={(e) => handleChange('defaultReminderMinutesBefore', parseInt(e.target.value, 10))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value={5}>5 minutes before</option>
                      <option value={10}>10 minutes before</option>
                      <option value={15}>15 minutes before</option>
                      <option value={30}>30 minutes before</option>
                      <option value={60}>1 hour before</option>
                      <option value={120}>2 hours before</option>
                      <option value={1440}>1 day before</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="pref-snooze" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Snooze Duration
                    </label>
                    <select
                      id="pref-snooze"
                      value={formState.snoozeDurationMinutes}
                      onChange={(e) => handleChange('snoozeDurationMinutes', parseInt(e.target.value, 10))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                    </select>
                  </div>
                </div>

                {/* Custom Reminder Times Chips */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">
                    Quick Reminder Presets
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {formState.customReminderTimes?.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-200"
                      >
                        <span>{m >= 60 ? `${m / 60}h` : `${m}m`} before</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomReminderTime(m)}
                          className="text-zinc-400 hover:text-rose-400"
                          title="Remove preset"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      id="pref-custom-reminder-input"
                      type="number"
                      min={1}
                      max={10080}
                      placeholder="Minutes (e.g. 45)"
                      value={customMinutesInput}
                      onChange={(e) => setCustomMinutesInput(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 w-28 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomReminderTime}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700"
                    >
                      Add Preset
                    </button>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Recurring Reminders</div>
                      <div className="text-xs text-zinc-400">Notify repeatedly for recurring routines and daily habits.</div>
                    </div>
                    <input
                      id="pref-toggle-recurring"
                      type="checkbox"
                      checked={formState.recurringRemindersEnabled}
                      onChange={(e) => handleChange('recurringRemindersEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Deadline Reminders</div>
                      <div className="text-xs text-zinc-400">Generate high-priority alerts as deadlines approach.</div>
                    </div>
                    <input
                      id="pref-toggle-deadlines"
                      type="checkbox"
                      checked={formState.deadlineRemindersEnabled}
                      onChange={(e) => handleChange('deadlineRemindersEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 5. NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-notifications">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Context-Aware Notification Rules</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Configure quiet hours, focus mode protection, meeting guards, and urgent alerts.
                  </p>
                </div>

                {/* Master Switch */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Enable Smart Notifications</div>
                      <div className="text-xs text-zinc-400">Receive in-app popups, sound chimes, and notification center items.</div>
                    </div>
                  </div>
                  <input
                    id="pref-toggle-master-notifications"
                    type="checkbox"
                    checked={formState.notificationsEnabled}
                    onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
                    className="w-5 h-5 accent-amber-400 rounded"
                  />
                </div>

                {/* Quiet Hours */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-200">Quiet Hours Protection</div>
                      <div className="text-xs text-zinc-400">Mutes non-urgent notifications during sleep or downtime.</div>
                    </div>
                    <input
                      id="pref-toggle-quiethours"
                      type="checkbox"
                      checked={formState.quietHoursEnabled}
                      onChange={(e) => handleChange('quietHoursEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </div>

                  {formState.quietHoursEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label htmlFor="pref-quietstart" className="block text-xs text-zinc-400 mb-1">
                          Quiet Hours Start
                        </label>
                        <input
                          id="pref-quietstart"
                          type="time"
                          value={formState.quietHoursStart}
                          onChange={(e) => handleChange('quietHoursStart', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label htmlFor="pref-quietend" className="block text-xs text-zinc-400 mb-1">
                          Quiet Hours End
                        </label>
                        <input
                          id="pref-quietend"
                          type="time"
                          value={formState.quietHoursEnd}
                          onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Protection Rules */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Meeting Protection</div>
                      <div className="text-xs text-zinc-400">Do not interrupt active calendar meetings with low/normal notifications.</div>
                    </div>
                    <input
                      id="pref-toggle-meetingprot"
                      type="checkbox"
                      checked={formState.meetingProtection}
                      onChange={(e) => handleChange('meetingProtection', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Focus Mode Protection</div>
                      <div className="text-xs text-zinc-400">Hold back non-urgent notifications while focus timer is active.</div>
                    </div>
                    <input
                      id="pref-toggle-focusprot"
                      type="checkbox"
                      checked={formState.focusModeProtection}
                      onChange={(e) => handleChange('focusModeProtection', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/20 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-rose-300">Urgent Notification Exceptions</div>
                      <div className="text-xs text-zinc-400">Allow critical/urgent notifications to bypass quiet hours &amp; focus blocks.</div>
                    </div>
                    <input
                      id="pref-toggle-urgentexceptions"
                      type="checkbox"
                      checked={formState.urgentExceptions}
                      onChange={(e) => handleChange('urgentExceptions', e.target.checked)}
                      className="w-4 h-4 accent-rose-400 rounded"
                    />
                  </label>
                </div>

                {/* Sound & Vibration & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label htmlFor="pref-sound" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Sound Preference
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="pref-sound"
                        value={formState.soundPreference}
                        onChange={(e) => handleChange('soundPreference', e.target.value as any)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                      >
                        <option value="chime">Chime (Default)</option>
                        <option value="subtle">Subtle Click</option>
                        <option value="bell">Soft Bell</option>
                        <option value="none">Mute (None)</option>
                      </select>
                      <button
                        type="button"
                        id="btn-test-sound"
                        onClick={handleTestSound}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                        title="Play test chime"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pref-vibrate" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Haptic Vibration
                    </label>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <span className="text-xs text-zinc-300 flex items-center gap-1.5">
                        <Vibrate className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Vibrate</span>
                      </span>
                      <input
                        id="pref-vibrate"
                        type="checkbox"
                        checked={formState.vibrationPreference}
                        onChange={(e) => handleChange('vibrationPreference', e.target.checked)}
                        className="w-4 h-4 accent-amber-400 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pref-prioritythreshold" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Minimum Alert Priority
                    </label>
                    <select
                      id="pref-prioritythreshold"
                      value={formState.priorityThreshold}
                      onChange={(e) => handleChange('priorityThreshold', e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="low">Low (All notifications)</option>
                      <option value="normal">Normal &amp; Above</option>
                      <option value="high">High &amp; Urgent Only</option>
                      <option value="urgent">Urgent Only</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 6. AI PREFERENCES */}
            {activeSection === 'ai' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-ai">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Gemini AI Planning &amp; Memory</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Tune how Gemini assists with schedule optimization, task breakdowns, and adaptive rescheduling.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">AI Daily Planning Engine</div>
                      <div className="text-xs text-zinc-400">Permits Gemini to assemble time-blocked daily schedules.</div>
                    </div>
                    <input
                      id="pref-toggle-aiplanning"
                      type="checkbox"
                      checked={formState.aiPlanningEnabled}
                      onChange={(e) => handleChange('aiPlanningEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Automatic Rescheduling</div>
                      <div className="text-xs text-zinc-400">Rebalance pending tasks automatically when meetings run over.</div>
                    </div>
                    <input
                      id="pref-toggle-autoreschedule"
                      type="checkbox"
                      checked={formState.automaticRescheduling}
                      onChange={(e) => handleChange('automaticRescheduling', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Ask Before Changing Schedule</div>
                      <div className="text-xs text-zinc-400">Display proposed adjustments before modifying your active timeline.</div>
                    </div>
                    <input
                      id="pref-toggle-askbeforechange"
                      type="checkbox"
                      checked={formState.askBeforeChangingSchedule}
                      onChange={(e) => handleChange('askBeforeChangingSchedule', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">AI Ephemeral Memory</div>
                      <div className="text-xs text-zinc-400">Remember recurring patterns and past productivity reviews across sessions.</div>
                    </div>
                    <input
                      id="pref-toggle-aimemory"
                      type="checkbox"
                      checked={formState.aiMemoryEnabled}
                      onChange={(e) => handleChange('aiMemoryEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Proactive Suggestions</div>
                      <div className="text-xs text-zinc-400">Surface smart task breakdown and break recommendations.</div>
                    </div>
                    <input
                      id="pref-toggle-aisuggestions"
                      type="checkbox"
                      checked={formState.aiSuggestionsEnabled}
                      onChange={(e) => handleChange('aiSuggestionsEnabled', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <div className="pt-2">
                    <label htmlFor="pref-planningstyle" className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Preferred Planning Style
                    </label>
                    <select
                      id="pref-planningstyle"
                      value={formState.planningStyle}
                      onChange={(e) => handleChange('planningStyle', e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-amber-400"
                    >
                      <option value="balanced">Balanced (Evenly distributed load with interspersed breaks)</option>
                      <option value="morning_heavy">Morning Heavy (Front-load demanding tasks before noon)</option>
                      <option value="afternoon_heavy">Afternoon Heavy (Light morning kickoff, deep execution later)</option>
                      <option value="deep_work">Deep Work Focused (Long uninterrupted focus blocks)</option>
                      <option value="sprint">Sprint Style (High density, short pomodoro cadence)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 7. GOOGLE WORKSPACE INTEGRATIONS */}
            {activeSection === 'integrations' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-integrations">
                <GoogleWorkspacePanel
                  userId={userId || 'anonymous'}
                  preferences={formState}
                  integrationMeta={integrationMeta}
                  onRefreshMeta={handleRefreshIntegrationMeta}
                  onImportCalendarEvents={onImportCalendarEvents || (async () => {})}
                  onApproveCommitment={onApproveCommitment || (async () => {})}
                />
              </div>
            )}

            {/* 8. PRIVACY & PERMISSIONS */}
            {activeSection === 'privacy' && (
              <div className="space-y-6 animate-fadeIn" role="tabpanel" aria-labelledby="settings-tab-privacy">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 tracking-tight">Privacy &amp; Permissions Control</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Granular permission switches governing sensors, external context, and data isolation.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Calendar Access</div>
                      <div className="text-xs text-zinc-400">Allow reading schedule blocks for conflict detection.</div>
                    </div>
                    <input
                      id="perm-calendar"
                      type="checkbox"
                      checked={formState.permissionCalendar}
                      onChange={(e) => handleChange('permissionCalendar', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Location Context</div>
                      <div className="text-xs text-zinc-400">Permit travel buffer calculations and localized sunrise/sunset.</div>
                    </div>
                    <input
                      id="perm-location"
                      type="checkbox"
                      checked={formState.permissionLocation}
                      onChange={(e) => handleChange('permissionLocation', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Weather Grounding</div>
                      <div className="text-xs text-zinc-400">Fetch meteorological conditions for morning briefing cards.</div>
                    </div>
                    <input
                      id="perm-weather"
                      type="checkbox"
                      checked={formState.permissionWeather}
                      onChange={(e) => handleChange('permissionWeather', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">Search Grounding</div>
                      <div className="text-xs text-zinc-400">Enable Google Search grounding in Gemini conversations.</div>
                    </div>
                    <input
                      id="perm-search"
                      type="checkbox"
                      checked={formState.permissionSearch}
                      onChange={(e) => handleChange('permissionSearch', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">System Notification Authorization</div>
                      <div className="text-xs text-zinc-400">Permission to dispatch audio and visual browser alerts.</div>
                    </div>
                    <input
                      id="perm-notifications"
                      type="checkbox"
                      checked={formState.permissionNotifications}
                      onChange={(e) => handleChange('permissionNotifications', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800 cursor-pointer">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">AI Conversation Memory Retention</div>
                      <div className="text-xs text-zinc-400">Store conversation embeddings strictly under your authenticated Firebase UID.</div>
                    </div>
                    <input
                      id="perm-aimemory"
                      type="checkbox"
                      checked={formState.permissionAiMemory}
                      onChange={(e) => handleChange('permissionAiMemory', e.target.checked)}
                      className="w-4 h-4 accent-amber-400 rounded"
                    />
                  </label>
                </div>

                {/* Data Backup & Security Modals */}
                <div className="pt-4 border-t border-zinc-800 space-y-3">
                  <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Data Portability &amp; Security Tools
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      id="btn-export-backup-json"
                      onClick={handleExportAllJSON}
                      className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-colors flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <Download className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">Export All Data</div>
                        <div className="text-[11px] text-zinc-500">Download clean JSON backup</div>
                      </div>
                    </button>

                    {onOpenThreatModel && (
                      <button
                        type="button"
                        id="btn-threat-model"
                        onClick={onOpenThreatModel}
                        className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-left transition-colors flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-zinc-200">Threat Model Audit</div>
                          <div className="text-[11px] text-zinc-500">View security boundaries</div>
                        </div>
                      </button>
                    )}

                    {onOpenDeleteDataModal && (
                      <button
                        type="button"
                        id="btn-delete-data"
                        onClick={onOpenDeleteDataModal}
                        className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-colors flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                        <div>
                          <div className="text-xs font-semibold text-rose-300">Delete My Data</div>
                          <div className="text-[11px] text-rose-400/70">Wipe private documents</div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
