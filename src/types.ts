export type MoodType =
  | 'reflective'
  | 'energized'
  | 'calm'
  | 'anxious'
  | 'creative'
  | 'grateful'
  | 'focused';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type TaskCategory = 'work' | 'personal' | 'urgent' | 'health' | 'learning' | 'errand';

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
}

export type ScheduleItemType = 'task' | 'event' | 'deadline' | 'routine' | 'break' | 'focus';
export type RepeatPattern = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly';

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: PriorityLevel;
  category: TaskCategory;
  itemType?: ScheduleItemType;
  dueDate?: string; // YYYY-MM-DD or readable
  dueTime?: string; // HH:mm
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  estimatedMinutes?: number;
  completed: boolean;
  repeatPattern?: RepeatPattern;
  repeatDays?: string[];
  reminderMinutesBefore?: number;
  location?: string;
  subtasks?: TaskSubtask[];
  createdAt: number;
  completedAt?: number;
  tags?: string[];
  source?: 'manual' | 'journal_extracted' | 'chat_import' | 'ai_breakdown' | 'gmail' | 'live_search';
  journalEntryId?: string;
  sourceEntryId?: string;
  googleMessageId?: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
  type: 'task' | 'meeting' | 'break' | 'focus' | 'deadline' | 'routine';
  priority?: PriorityLevel;
  completed?: boolean;
  description?: string;
  taskId?: string;
}

export interface DailyPlan {
  id: string;
  userId: string;
  dateStr: string; // YYYY-MM-DD
  blocks: ScheduleBlock[];
  summary: string;
  energyStrategy: string;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface FocusSession {
  id: string;
  userId: string;
  taskId?: string;
  taskTitle: string;
  durationMinutes: number;
  completedAt: number;
  notes?: string;
  interrupted?: boolean;
}

export interface MorningBriefPriorityItem {
  id?: string;
  title: string;
  reason: string;
  priority: PriorityLevel;
  estimatedMinutes?: number;
}

export interface MorningBriefConflictItem {
  description: string;
  recommendation: string;
}

export interface MorningBriefSuggestedOrderItem {
  timeSlot?: string;
  title: string;
  type: 'task' | 'meeting' | 'focus' | 'break' | 'routine';
}

export interface MorningBriefSequenceStep {
  step: number;
  activity: string;
  type: string;
  durationMinutes?: number;
  notes?: string;
}

export interface MorningBriefData {
  headline: string;
  summary: string;
  priorities: MorningBriefPriorityItem[];
  potentialConflicts: Array<MorningBriefConflictItem | string>;
  suggestedOrder?: MorningBriefSuggestedOrderItem[];
  weatherTravelContext?: {
    weatherAdvisory?: string;
    travelBufferNotes?: string;
  };
  travelOrWeatherContext?: string;
  mindsetNote?: string;
  mindset?: string;
  suggestedSequence?: MorningBriefSequenceStep[];
}

export interface EveningReviewIncompleteItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  suggestMoveToTomorrow: boolean;
  reason?: string;
  dueDate?: string;
}

export interface EveningReviewData {
  headline: string;
  summary: string;
  completedSummary: string;
  completedCount: number;
  incompleteTasks: EveningReviewIncompleteItem[];
  overdueItems?: string[];
  journalInsights: string[];
  progressHighlights: string[];
  productivityScore?: number;
  windDownAdvice: string;
}

export interface DetectedActionItem {
  id: string;
  title: string;
  type: 'task' | 'event' | 'deadline' | 'goal';
  dueDate?: string;
  dueTime?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  priority: PriorityLevel;
  category?: TaskCategory;
  estimatedMinutes?: number;
  confidence?: number;
  contextSnippet?: string;
  approved?: boolean;
}

export interface RecurringPatternItem {
  id: string;
  tag: string;
  theme: string;
  description: string;
  frequencyText: string;
  suggestion: string;
}

export interface JournalAnalysisResult {
  journalEntryId: string;
  goals: string[];
  tasks: DetectedActionItem[];
  events: DetectedActionItem[];
  deadlines: DetectedActionItem[];
  recurringThemes: string[];
  patterns: RecurringPatternItem[];
  sentimentSynthesis: string;
  confidence: number;
}

export interface AiInsightItem {
  id: string;
  userId: string;
  period: 'daily' | 'weekly';
  dateStr: string;
  title: string;
  summary: string;
  priorities: string[];
  unfinishedItems: Array<{ id?: string; title: string; priority?: string; reason?: string }>;
  recurringPatterns: string[];
  meaningfulProgress: string[];
  goalsIdentified: string[];
  relevantMemoryContext?: string[];
  recommendedActions?: DetectedActionItem[];
  productivityScore?: number;
  dismissed?: boolean;
  createdAt: number;
}

export interface DailyReview {
  id: string;
  userId: string;
  dateStr: string;
  type: 'morning_brief' | 'evening_review' | 'daily_insight' | 'weekly_insight';
  headline: string;
  summary: string;
  highlights: string[];
  recommendations: string[];
  productivityScore?: number; // 1-100
  morningBriefData?: MorningBriefData;
  morningBrief?: MorningBriefData;
  eveningReviewData?: EveningReviewData;
  eveningReview?: EveningReviewData;
  insightData?: AiInsightItem;
  status?: 'active' | 'dismissed';
  createdAt: number;
}

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'pending' | 'unread' | 'read' | 'snoozed' | 'dismissed';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  scheduledAt: number; // Unix epoch ms
  priority: NotificationPriority;
  relatedTaskId?: string;
  relatedEventId?: string;
  relatedDeadlineId?: string;
  status: NotificationStatus;
  createdAt: number;
  readAt?: number;
  deliveredAt?: number;
  deliveryConfirmed?: boolean;
  snoozedUntil?: number;
  originalScheduledAt?: number;
  delayedReason?: string;
  itemType?: ScheduleItemType;
  repeatPattern?: RepeatPattern;
  channel?: 'browser_push' | 'in_app' | 'both';
}

export interface UserPreferences {
  // PROFILE
  name: string;
  profileImage: string;
  language: string;

  // TIME & DATE
  timeFormat: '12h' | '24h';
  timezone: string;
  dateFormat: string; // 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'MMM D, YYYY'
  weekStartsOn: 'monday' | 'sunday' | 'saturday';
  firstDayOfWeek: number;
  defaultCalendarView: 'day' | 'week' | 'month' | 'timeline';

  // SCHEDULE
  workingDays: string[]; // e.g. ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  workdayStart: string; // e.g. "09:00"
  workdayEnd: string; // e.g. "18:00"
  workStartHour?: number;
  workEndHour?: number;
  preferredFocusStart: string; // e.g. "09:30"
  preferredFocusEnd: string; // e.g. "12:00"
  preferredMeetingStart: string; // e.g. "14:00"
  preferredMeetingEnd: string; // e.g. "17:00"
  defaultTaskDuration: number; // in minutes
  defaultBreakDuration: number; // in minutes
  travelBufferMinutes: number; // in minutes

  // REMINDERS
  defaultReminderMinutesBefore: number; // e.g. 15, 30
  customReminderTimes: number[]; // e.g. [5, 15, 30, 60]
  snoozeDurationMinutes: number; // e.g. 10
  recurringRemindersEnabled: boolean;
  deadlineRemindersEnabled: boolean;

  // NOTIFICATIONS
  notificationsEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // e.g. "22:00"
  quietHoursEnd: string; // e.g. "07:00"
  meetingProtection: boolean;
  focusModeProtection: boolean;
  urgentExceptions: boolean;
  soundPreference: 'chime' | 'subtle' | 'bell' | 'none';
  vibrationPreference: boolean;
  priorityThreshold: 'low' | 'normal' | 'high' | 'urgent';

  // AI PREFERENCES
  aiPlanningEnabled: boolean;
  morningBriefEnabled: boolean;
  eveningReviewEnabled: boolean;
  automaticRescheduling: boolean;
  askBeforeChangingSchedule: boolean;
  aiMemoryEnabled: boolean;
  aiSuggestionsEnabled: boolean;
  planningStyle: 'balanced' | 'morning_heavy' | 'afternoon_heavy' | 'deep_work' | 'sprint';

  // PRIVACY & PERMISSIONS
  permissionCalendar: boolean;
  permissionLocation: boolean;
  permissionWeather: boolean;
  permissionSearch: boolean;
  permissionNotifications: boolean;
  permissionAiMemory: boolean;

  // Backwards compatibility
  locationCity?: string;
  focusDurationMinutes?: number;
  breakDurationMinutes?: number;
  energyPacing?: 'morning_heavy' | 'balanced' | 'afternoon_heavy';
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  name: '',
  profileImage: '',
  language: 'auto',
  timeFormat: '12h',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  dateFormat: 'MMM D, YYYY',
  weekStartsOn: 'monday',
  firstDayOfWeek: 1,
  defaultCalendarView: 'day',
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  workdayStart: '09:00',
  workdayEnd: '18:00',
  preferredFocusStart: '09:30',
  preferredFocusEnd: '12:00',
  preferredMeetingStart: '14:00',
  preferredMeetingEnd: '17:00',
  defaultTaskDuration: 30,
  defaultBreakDuration: 10,
  travelBufferMinutes: 15,
  defaultReminderMinutesBefore: 15,
  customReminderTimes: [5, 15, 30, 60],
  snoozeDurationMinutes: 10,
  recurringRemindersEnabled: true,
  deadlineRemindersEnabled: true,
  notificationsEnabled: true,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  meetingProtection: true,
  focusModeProtection: true,
  urgentExceptions: true,
  soundPreference: 'subtle',
  vibrationPreference: true,
  priorityThreshold: 'low',
  aiPlanningEnabled: true,
  morningBriefEnabled: true,
  eveningReviewEnabled: true,
  automaticRescheduling: true,
  askBeforeChangingSchedule: true,
  aiMemoryEnabled: true,
  aiSuggestionsEnabled: true,
  planningStyle: 'balanced',
  permissionCalendar: true,
  permissionLocation: true,
  permissionWeather: true,
  permissionSearch: true,
  permissionNotifications: true,
  permissionAiMemory: true,
  locationCity: '',
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  energyPacing: 'balanced',
};

export interface ActionProposal {
  id: string;
  tool: string;
  title: string;
  description: string;
  params: any;
  requiresConfirmation: boolean;
  status: 'pending' | 'applied' | 'dismissed';
}

export interface LocationInfo {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  origin?: string;
  originCoords?: { lat: number; lng: number };
  distanceKm?: number;
  distanceMiles?: number;
  durationMinutes?: number;
  mode?: string;
  suggestedDepartureTime?: string;
  weatherAdvisory?: string;
  routeGeometry?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  type?: 'reflection' | 'brainstorm' | 'summary' | 'search_context' | 'extraction' | 'plan' | 'what_now';
  actionProposal?: ActionProposal;
  locationInfo?: LocationInfo;
  whatNowData?: WhatNowRecommendation;
}

export interface ExtractedTask {
  id: string;
  title: string;
  completed: boolean;
  priority: PriorityLevel;
  category?: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  estimatedMinutes?: number;
  sourceEntryId?: string;
  journalEntryId?: string;
}

export interface ExtractedEvent {
  id: string;
  title: string;
  dateTime: string;
  location?: string;
}

export interface ExtractedDeadline {
  id: string;
  title: string;
  deadline: string;
  priority: 'medium' | 'critical';
}

export interface StructuredExtraction {
  tasks: ExtractedTask[];
  events: ExtractedEvent[];
  deadlines: ExtractedDeadline[];
  confidence: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  summary?: string;
  sentiment?: string;
  messages: ChatMessage[];
  extractedTasks?: ExtractedTask[];
  extractedEvents?: ExtractedEvent[];
  extractedDeadlines?: ExtractedDeadline[];
  linkedEntryIds?: string[];
  timezone?: string;
  embedding?: number[];
  hasMemoryEmbedding?: boolean;
}

export interface JournalMemory {
  id: string;
  userId: string;
  entryId: string;
  title: string;
  content: string;
  summary?: string;
  mood?: MoodType;
  tags: string[];
  createdAt: number;
  embedding?: number[];
  similarity?: number;
}

export interface ThreatZoneReview {
  zone: string;
  threat: string;
  countermeasure: string;
  status: 'active' | 'enforced';
}

export interface ForecastDay {
  day: string;
  condition: string;
  icon: string;
  tempC: number;
  tempF: number;
  rainProb: number;
}

export interface WeatherData {
  city: string;
  tempC: number;
  tempF: number;
  minTempC?: number;
  maxTempC?: number;
  minTempF?: number;
  maxTempF?: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeedKmh?: number;
  windKph?: number;
  precipitationChance?: number;
  summary: string;
  advisory?: string;
  isAdverse?: boolean;
  forecast?: ForecastDay[];
  updatedAt?: number;
}

export interface TravelEstimate {
  origin: string;
  destination: string;
  durationMinutes: number;
  bufferMinutes: number;
  totalEstimatedMinutes: number;
  distanceKm: number;
  distanceMiles?: number;
  distanceText: string;
  mode: 'driving' | 'transit' | 'walking' | 'bicycling';
  suggestedDepartureTime?: string; // e.g. "13:35"
  hasConflict?: boolean;
  conflictDetails?: string;
  weatherWarning?: string;
  liveRoutingAvailable?: boolean;
  error?: string;
  originCoords?: { lat: number; lng: number };
  destinationCoords?: { lat: number; lng: number };
  routeGeometry?: any;
}

export type ActiveNavTab =
  | 'home'
  | 'search'
  | 'calendar'
  | 'tasks'
  | 'planner'
  | 'focus'
  | 'journal'
  | 'insights'
  | 'import'
  | 'history'
  | 'settings';

export type CalendarViewMode = 'month' | 'week' | 'day';

export type RepeatFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'weekdays'
  | 'monthly'
  | 'yearly'
  | 'custom';

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval?: number; // e.g. 1 = every week, 2 = every 2 weeks
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayOfMonth?: number; // e.g. 15 for "every 15th"
  monthOfYear?: number; // 0-11
  endType?: 'never' | 'until' | 'count';
  untilDate?: string; // YYYY-MM-DD
  count?: number;
  exceptions?: string[]; // YYYY-MM-DD dates skipped or modified
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  priority: PriorityLevel;
  repeat: RepeatRule;
  reminder: number[]; // e.g. [5, 15, 30] minutes before
  color?: string;
  createdAt: number;
  updatedAt: number;
  seriesId?: string;
  recurrenceId?: string;
  googleEventId?: string;
  syncStatus?: 'synced' | 'local' | 'pending' | 'error';
  lastSyncedAt?: number;
  htmlLink?: string;
}

export interface CalendarOccurrence {
  occurrenceId: string;
  originalEvent: CalendarEvent;
  eventId: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location?: string;
  priority: PriorityLevel;
  reminder: number[];
  color?: string;
  isRecurringInstance: boolean;
  seriesId?: string;
}

export type GeminiToolName =
  | 'createTask'
  | 'updateTask'
  | 'deleteTask'
  | 'completeTask'
  | 'getTasks'
  | 'createEvent'
  | 'updateEvent'
  | 'deleteEvent'
  | 'getTodayContext'
  | 'generateDailyPlan'
  | 'reschedulePlan';

export interface GeminiToolCall {
  id: string;
  tool: GeminiToolName;
  params: Record<string, any>;
  description: string;
}

export interface ProposedChangeItem {
  id: string;
  toolCallId: string;
  tool: GeminiToolName;
  type: 'create' | 'update' | 'delete' | 'reschedule' | 'plan';
  title: string;
  details: string;
  params: Record<string, any>;
  isEditable?: boolean;
}

export interface WhatNowRecommendation {
  actionTitle: string;
  reason: string;
  estimatedMinutes: number;
  priority: PriorityLevel;
  taskId?: string;
  quickTips: string[];
}

export interface GeminiCommandResponse {
  intent: 'read_only' | 'create' | 'update' | 'delete' | 'reschedule' | 'plan' | 'query';
  summary: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  toolCalls: GeminiToolCall[];
  directAnswer?: string;
  whatNowData?: WhatNowRecommendation;
  rescheduledBlocks?: ScheduleBlock[];
}

export interface ContextTaskItem {
  id: string;
  title: string;
  priority: PriorityLevel;
  category: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  estimatedMinutes?: number;
  completed: boolean;
}

export interface ContextEventItem {
  id: string;
  title: string;
  dateTime?: string;
  location?: string;
}

export interface ContextDeadlineItem {
  id: string;
  title: string;
  deadline?: string;
  priority: PriorityLevel;
}

export interface CommandCenterContext {
  currentDateTime: string;
  currentTime: string;
  currentDate: string;
  timezone: string;
  tasks: ContextTaskItem[];
  events: ContextEventItem[];
  deadlines: ContextDeadlineItem[];
  currentPlan: {
    id?: string;
    dateStr?: string;
    summary?: string;
    blocks: ScheduleBlock[];
  } | null;
  userPreferences: {
    workdayStart: string;
    workdayEnd: string;
    energyPacing: string;
    focusDurationMinutes: number;
    breakDurationMinutes: number;
  };
  weather?: WeatherData | null;
  travelEstimates?: TravelEstimate[];
  retrievedMemories?: JournalMemory[];
}

export interface StrategicInsights {
  id?: string;
  period: 'daily' | 'weekly';
  generatedAt: number;
  title?: string;
  headline?: string;
  summary: string;
  priorities: string[];
  unfinishedItems: string[];
  recurringPatterns: string[];
  meaningfulProgress: string[];
  goals?: string[];
  goalsIdentified?: string[];
  relevantMemoryContext?: string[];
  memoryCitations?: Array<{ title: string; snippet: string }>;
  recommendedActions?: Array<{ id: string; title: string; type: string; priority?: string; estimatedMinutes?: number }>;
  productivityScore?: number;
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface SuggestedAction {
  id: string;
  type: 'task' | 'event' | 'reminder';
  title: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  location?: string;
  priority?: PriorityLevel;
  category?: TaskCategory;
  minutesBefore?: number;
  reason: string;
  sourceQuery?: string;
}

export interface LiveSearchResult {
  query: string;
  answer: string;
  sources: GroundingSource[];
  searchQueries: string[];
  suggestedActions: SuggestedAction[];
  contextUsed?: {
    tasksCount: number;
    eventsCount: number;
    location?: string;
    timezone?: string;
  };
  routeInfo?: {
    origin: string;
    destination: string;
    distanceKm: number;
    distanceMiles: number;
    durationMinutes: number;
    mode: string;
    liveRoutingAvailable: boolean;
  };
  requiresLocationPermission?: boolean;
  timestamp: number;
}

export interface GoogleIntegrationMetadata {
  calendarConnected: boolean;
  gmailConnected: boolean;
  email?: string;
  lastSyncedAt?: number;
  calendarId?: string;
  syncStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  lastError?: string;
  scopesGranted?: string[];
}

export interface GmailDetectedItem {
  id: string;
  type: 'task' | 'event' | 'deadline';
  title: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  priority: PriorityLevel;
  sourceEmail: {
    messageId: string;
    subject: string;
    from: string;
    date: string;
  };
  confidence: number;
  reason: string;
}



