import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  Check,
  X,
  Loader2,
  CalendarCheck,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Inbox,
} from 'lucide-react';
import {
  CalendarEvent,
  TaskItem,
  GoogleIntegrationMetadata,
  GmailDetectedItem,
  UserPreferences,
} from '../types';
import {
  fetchGoogleCalendarEvents,
  fetchGmailMessages,
  detectCommitmentsFromEmails,
  ensureGoogleToken,
  saveGoogleIntegrationMetadata,
} from '../services/googleWorkspaceService';
import { formatAuthError } from '../lib/firebase';

interface GoogleWorkspacePanelProps {
  userId: string;
  preferences: UserPreferences;
  integrationMeta: GoogleIntegrationMetadata | null;
  onRefreshMeta: () => Promise<void>;
  onImportCalendarEvents: (events: CalendarEvent[]) => Promise<void>;
  onApproveCommitment: (item: GmailDetectedItem) => Promise<void>;
}

export const GoogleWorkspacePanel: React.FC<GoogleWorkspacePanelProps> = ({
  userId,
  preferences,
  integrationMeta,
  onRefreshMeta,
  onImportCalendarEvents,
  onApproveCommitment,
}) => {
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isScanningGmail, setIsScanningGmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detectedCommitments, setDetectedCommitments] = useState<GmailDetectedItem[]>([]);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const calendarConnected = integrationMeta?.calendarConnected ?? false;
  const gmailConnected = integrationMeta?.gmailConnected ?? false;

  const handleConnect = async (scope: 'calendar' | 'gmail') => {
    setError(null);
    setSuccessMessage(null);
    if (scope === 'calendar') setIsConnectingCalendar(true);

    try {
      await ensureGoogleToken();
      await saveGoogleIntegrationMetadata(userId, {
        calendarConnected: true,
        gmailConnected: true,
        syncStatus: 'connected',
        scopesGranted: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/gmail.readonly',
        ],
      });
      await onRefreshMeta();
      setSuccessMessage('Google Workspace successfully connected with Calendar and Gmail permissions.');
    } catch (err: any) {
      const formatted = formatAuthError(err);
      setError(`${formatted.title}: ${formatted.message}${formatted.actionHint ? ` — ${formatted.actionHint}` : ''}`);
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleSyncCalendar = async () => {
    setIsSyncingCalendar(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const gEvents = await fetchGoogleCalendarEvents();
      await onImportCalendarEvents(gEvents);
      await saveGoogleIntegrationMetadata(userId, {
        calendarConnected: true,
        lastSyncedAt: Date.now(),
        syncStatus: 'connected',
      });
      await onRefreshMeta();
      setSuccessMessage(`Successfully imported ${gEvents.length} events from Google Calendar.`);
    } catch (err: any) {
      setError(err.message || 'Failed to sync Google Calendar.');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleScanGmail = async () => {
    setIsScanningGmail(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const messages = await fetchGmailMessages({ maxResults: 12 });
      if (messages.length === 0) {
        setSuccessMessage('No recent messages found in Gmail inbox.');
        return;
      }

      const detected = await detectCommitmentsFromEmails(messages, preferences.timezone);
      setDetectedCommitments(detected);
      await saveGoogleIntegrationMetadata(userId, {
        gmailConnected: true,
        lastSyncedAt: Date.now(),
        syncStatus: 'connected',
      });
      await onRefreshMeta();

      if (detected.length === 0) {
        setSuccessMessage(`Scanned ${messages.length} recent emails. No pending commitments or deadlines detected.`);
      } else {
        setSuccessMessage(`Detected ${detected.length} potential commitments from ${messages.length} recent emails.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan Gmail messages.');
    } finally {
      setIsScanningGmail(false);
    }
  };

  const handleApprove = async (item: GmailDetectedItem) => {
    setApprovingId(item.id);
    try {
      await onApproveCommitment(item);
      setApprovedIds((prev) => new Set([...prev, item.id]));
    } catch (err: any) {
      setError(`Failed to save commitment: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Calendar Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Google Calendar</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Two-way event import and schedule sync</p>
              </div>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                calendarConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
              }`}
            >
              {calendarConnected ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {calendarConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-400">
              {integrationMeta?.lastSyncedAt
                ? `Last sync: ${new Date(integrationMeta.lastSyncedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Never synced'}
            </span>

            {calendarConnected ? (
              <button
                type="button"
                disabled={isSyncingCalendar}
                onClick={handleSyncCalendar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendar ? 'animate-spin' : ''}`} />
                <span>{isSyncingCalendar ? 'Syncing...' : 'Sync Events'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isConnectingCalendar}
                onClick={() => handleConnect('calendar')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                {isConnectingCalendar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>Connect Calendar</span>
              </button>
            )}
          </div>
        </div>

        {/* Gmail Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Gmail Intelligence</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Detect commitments, tasks & deadlines</p>
              </div>
            </div>

            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                gmailConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
              }`}
            >
              {gmailConnected ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {gmailConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-3">
            <span className="text-xs text-stone-400">
              Read-only email analysis
            </span>

            {gmailConnected ? (
              <button
                type="button"
                disabled={isScanningGmail}
                onClick={handleScanGmail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isScanningGmail ? 'animate-spin' : ''}`} />
                <span>{isScanningGmail ? 'Analyzing...' : 'Scan Commitments'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleConnect('gmail')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Connect Gmail</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Gmail Detected Commitments Section */}
      {detectedCommitments.length > 0 && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Actionable Items Detected from Gmail
              </h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
              {detectedCommitments.filter((c) => !dismissedIds.has(c.id)).length} pending review
            </span>
          </div>

          <div className="space-y-3">
            {detectedCommitments
              .filter((c) => !dismissedIds.has(c.id))
              .map((item) => {
                const isApproved = approvedIds.has(item.id);
                const isProcessing = approvingId === item.id;

                return (
                  <div
                    key={item.id}
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
                              item.type === 'event'
                                ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                : item.type === 'deadline'
                                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {item.type.toUpperCase()}
                          </span>
                          <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm">{item.title}</h4>
                        </div>

                        {item.description && (
                          <p className="text-xs text-stone-600 dark:text-stone-300">{item.description}</p>
                        )}

                        {/* Email context source snippet */}
                        <div className="text-[11px] text-stone-400 bg-stone-100/80 dark:bg-stone-800/80 p-2 rounded-lg border border-stone-200/60 dark:border-stone-700/60">
                          <p className="font-medium text-stone-600 dark:text-stone-300 truncate">
                            From: {item.sourceEmail.from} • Subject: "{item.sourceEmail.subject}"
                          </p>
                          <p className="mt-0.5 text-stone-500 truncate">Reason: {item.reason}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-stone-400 pt-1">
                          {item.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span>{item.date}</span>
                            </span>
                          )}
                          {item.startTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              <span>
                                {item.startTime} {item.endTime ? `- ${item.endTime}` : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Approval Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {isApproved ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                            <Check className="w-4 h-4" />
                            <span>Saved</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDismiss(item.id)}
                              className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-700/50 transition-colors"
                              title="Dismiss commitment"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handleApprove(item)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Approve & Add</span>
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
    </div>
  );
};
