import { ALL_DUTIES, BRANCHES, DUTY_ITEMS, INITIAL_USERS, OPERATION_MANAGER_DUTIES } from '../data/initialData';
import { DailyBranchSubmission, NotificationItem, OperationalManagerDailySummary, TaskRecord, User } from '../types';
import { formatSriLankaTime, getSriLankaIsoString, getSriLankaTodayDate } from './networkTime';

const STORAGE_KEY_USERS = 'rathna_super_users_v4';
const STORAGE_KEY_SUBMISSIONS = 'rathna_super_submissions_v4';
const STORAGE_KEY_CURRENT_USER = 'rathna_super_current_user_v4';
const STORAGE_KEY_NOTIFICATIONS = 'rathna_super_notifications_v4';
const STORAGE_KEY_OM_SUMMARIES = 'rathna_super_om_summaries_v4';
const STORAGE_KEY_THEME = 'rathna_super_theme';

export function getTodayDateString(): string {
  return getSriLankaTodayDate();
}

// Default BLANK submissions: Start fresh with no pre-filled tasks
function createBlankSubmissions(): Record<string, DailyBranchSubmission> {
  const submissions: Record<string, DailyBranchSubmission> = {};
  const todayStr = getTodayDateString();

  for (const branch of BRANCHES) {
    const key = `${branch.id}_${todayStr}`;
    const tasks: Record<number, TaskRecord> = {};

    for (const duty of ALL_DUTIES) {
      tasks[duty.id] = {
        dutyId: duty.id,
        dutyNumber: duty.dutyNumber,
        dutyTitle: duty.title,
        category: duty.category,
        status: 'PENDING',
        omAuditStatus: 'PENDING_REVIEW',
      };
    }

    submissions[key] = {
      id: key,
      branchId: branch.id,
      branchName: branch.name,
      date: todayStr,
      submittedBy: branch.managerName,
      completionPercentage: 0,
      tasks,
      isLocked: false,
      totalTasks: DUTY_ITEMS.length,
      completedTasksCount: 0,
      issueTasksCount: 0,
    };
  }

  return submissions;
}

// Optional helper for CEO to preview demo historical analytics
export function seedSampleAnalyticsData(): Record<string, DailyBranchSubmission> {
  const submissions: Record<string, DailyBranchSubmission> = {};
  const today = new Date();

  for (let i = 14; i >= 0; i--) {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() - i);
    const dateStr = dateObj.toISOString().split('T')[0];

    for (const branch of BRANCHES) {
      const key = `${branch.id}_${dateStr}`;
      const tasks: Record<number, TaskRecord> = {};
      let completedCount = 0;
      let issueCount = 0;

      let completionRatio = 0.94;
      if (branch.id === 'mathugama') completionRatio = 0.81;
      else if (branch.id === 'egoda_uyana') completionRatio = 0.85;
      else if (branch.id === 'millagashandiya') completionRatio = 0.90;
      else if (branch.id === 'panadura_market') completionRatio = 0.97;
      else if (branch.id === 'panadura_ho') completionRatio = 0.98;

      if (i === 0) {
        completionRatio = 0.5;
      }

      for (const duty of DUTY_ITEMS) {
        const isProneToIssue = [5, 35, 56, 57, 65, 14, 48].includes(duty.id);
        const rand = Math.random();

        let status: TaskRecord['status'] = 'COMPLETED';
        let proof = undefined;
        let numericValue = undefined;

        if (rand > completionRatio) {
          if (isProneToIssue && Math.random() > 0.4) {
            status = 'UNABLE_TO_COMPLETE';
            issueCount++;
            proof = {
              capturedAt: `${dateStr}T10:35:00.000Z`,
              reason: duty.id === 5 
                ? 'Compressor defrost cycle in progress, temperature temporarily high' 
                : duty.id === 56 
                ? 'Awaiting diesel fuel delivery' 
                : duty.id === 65 
                ? 'System mismatch on barcode item, head office approval requested'
                : 'Pending head office credit note',
              location: {
                latitude: branch.coordinates.lat + (Math.random() - 0.5) * 0.001,
                longitude: branch.coordinates.lng + (Math.random() - 0.5) * 0.001,
                accuracy: 12,
                addressDescription: `Verified within ${branch.name} premises`,
              },
            };
          } else {
            status = i === 0 ? 'PENDING' : 'DELAYED';
          }
        } else {
          completedCount++;
        }

        if (duty.requiresTemp) {
          numericValue = status === 'COMPLETED' ? -18.5 : 8.2;
        }

        tasks[duty.id] = {
          dutyId: duty.id,
          dutyNumber: duty.dutyNumber,
          dutyTitle: duty.title,
          category: duty.category,
          status,
          completedAt: status === 'COMPLETED' ? `${dateStr}T08:15:00.000Z` : undefined,
          completedBy: branch.managerName,
          proof,
          numericValue,
          omAuditStatus: status === 'COMPLETED' 
            ? (Math.random() > 0.1 ? 'VERIFIED' : 'PENDING_REVIEW')
            : (status === 'UNABLE_TO_COMPLETE' ? 'FLAGGED' : 'PENDING_REVIEW'),
          omAuditNotes: status === 'UNABLE_TO_COMPLETE' ? 'Investigated by OM during branch site inspection.' : undefined,
          omAuditedBy: branch.operationManagerId === 'lasantha' ? 'Lasantha' : 'Ranga',
          omAuditedAt: `${dateStr}T16:00:00.000Z`,
        };
      }

      // Seed Operation Manager duties (34 duties)
      for (const omDuty of OPERATION_MANAGER_DUTIES) {
        const rand = Math.random();
        let status: TaskRecord['status'] = 'COMPLETED';
        let proof = undefined;

        if (rand > 0.90) {
          status = 'UNABLE_TO_COMPLETE';
          proof = {
            capturedAt: `${dateStr}T14:20:00.000Z`,
            reason: omDuty.id === 104 ? 'Freezer thermometer battery fault' : 'On-site stock check variance reported',
            location: {
              latitude: branch.coordinates.lat,
              longitude: branch.coordinates.lng,
              accuracy: 10,
              addressDescription: `OM Verified at ${branch.name}`,
            },
          };
        } else if (rand > 0.82) {
          status = i === 0 ? 'PENDING' : 'DELAYED';
        }

        tasks[omDuty.id] = {
          dutyId: omDuty.id,
          dutyNumber: omDuty.dutyNumber,
          dutyTitle: omDuty.title,
          category: omDuty.category,
          status,
          completedAt: status === 'COMPLETED' ? `${dateStr}T11:30:00.000Z` : undefined,
          completedBy: branch.operationManagerId === 'lasantha' ? 'Lasantha (OM)' : 'Ranga (OM)',
          proof,
          omAuditStatus: status === 'COMPLETED' ? 'VERIFIED' : 'FLAGGED',
          omAuditNotes: `Field check completed by ${branch.operationManagerId === 'lasantha' ? 'Lasantha' : 'Ranga'}.`,
          omAuditedBy: branch.operationManagerId === 'lasantha' ? 'Lasantha' : 'Ranga',
          omAuditedAt: `${dateStr}T15:00:00.000Z`,
        };
      }

      const total = DUTY_ITEMS.length;
      const pct = Math.round((completedCount / total) * 100);

      submissions[key] = {
        id: key,
        branchId: branch.id,
        branchName: branch.name,
        date: dateStr,
        submittedAt: i > 0 ? `${dateStr}T21:45:00.000Z` : undefined,
        submittedBy: branch.managerName,
        completionPercentage: pct,
        tasks,
        isLocked: i > 0,
        totalTasks: total,
        completedTasksCount: completedCount,
        issueTasksCount: issueCount,
        reviewedByOmId: branch.operationManagerId,
        reviewedAt: `${dateStr}T22:00:00.000Z`,
        omScore: Math.min(100, Math.max(70, pct)),
        omRemarks: issueCount > 0 ? 'Follow-up required on cold storage & inventory minus items.' : 'Satisfactory compliance today.',
      };
    }

    // Seed Operational Managers' Daily Summaries for Lasantha & Ranga
    const omSummaries = loadOmSummaries();
    
    // Lasantha summary
    const lasanthaKey = `lasantha_${dateStr}`;
    omSummaries[lasanthaKey] = {
      id: lasanthaKey,
      omId: 'lasantha',
      omName: 'Lasantha (Operation Manager)',
      date: dateStr,
      isSubmitted: i > 0,
      submittedAt: i > 0 ? `${dateStr}T21:30:00.000Z` : undefined,
      assignedBranchIds: ['panadura_market', 'millagashandiya', 'alubomulla'],
      totalOmDuties: 34 * 3,
      completedOmDuties: Math.round(34 * 3 * 0.94),
      flaggedOmIssues: 2,
      omComplianceRate: 94,
      verifiedBranchTasksCount: 182,
      flaggedBranchTasksCount: 4,
      clusterScore: 94,
      executiveNotes: 'All 3 Panadura cluster branches visited. Freezer temperatures re-calibrated at Millagashandiya. Cash balancing fully verified.',
    };

    // Ranga summary
    const rangaKey = `ranga_${dateStr}`;
    omSummaries[rangaKey] = {
      id: rangaKey,
      omId: 'ranga',
      omName: 'Ranga (Operation Manager)',
      date: dateStr,
      isSubmitted: i > 0,
      submittedAt: i > 0 ? `${dateStr}T21:45:00.000Z` : undefined,
      assignedBranchIds: ['panadura_ho', 'egoda_uyana', 'kalutara', 'mathugama'],
      totalOmDuties: 34 * 4,
      completedOmDuties: Math.round(34 * 4 * 0.89),
      flaggedOmIssues: 5,
      omComplianceRate: 89,
      verifiedBranchTasksCount: 236,
      flaggedBranchTasksCount: 9,
      clusterScore: 89,
      executiveNotes: 'Head Office and Highway belt branches inspected. Mathugama inventory stock-taking scheduled for Friday. Overall compliance strong.',
    };

    localStorage.setItem(STORAGE_KEY_OM_SUMMARIES, JSON.stringify(omSummaries));
  }

  localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
  return submissions;
}

export function resetAllToBlank(): Record<string, DailyBranchSubmission> {
  const blank = createBlankSubmissions();
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(blank));
  localStorage.removeItem(STORAGE_KEY_OM_SUMMARIES);
  return blank;
}

// Operational Manager Summaries storage functions
export function loadOmSummaries(): Record<string, OperationalManagerDailySummary> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OM_SUMMARIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading OM summaries', e);
  }
  return {};
}

export function saveOmSummary(summary: OperationalManagerDailySummary) {
  try {
    const summaries = loadOmSummaries();
    summaries[summary.id] = summary;
    localStorage.setItem(STORAGE_KEY_OM_SUMMARIES, JSON.stringify(summaries));
  } catch (e) {
    console.error('Failed saving OM summary', e);
  }
}

export function getOrCreateOmSummary(
  omId: 'lasantha' | 'ranga',
  date: string,
  submissionsRecord?: Record<string, DailyBranchSubmission>
): OperationalManagerDailySummary {
  const key = `${omId}_${date}`;
  const allOmSummaries = loadOmSummaries();
  if (allOmSummaries[key]) {
    return allOmSummaries[key];
  }

  const submissions = submissionsRecord || loadSubmissions();
  const omUser = INITIAL_USERS.find((u) => u.id === omId);
  const assignedBranchIds = omUser?.assignedBranchIds || (omId === 'lasantha' ? ['panadura_market', 'millagashandiya', 'alubomulla'] : ['panadura_ho', 'egoda_uyana', 'kalutara', 'mathugama']);
  
  let totalOmDuties = 0;
  let completedOmDuties = 0;
  let flaggedOmIssues = 0;
  let verifiedBranchTasksCount = 0;
  let flaggedBranchTasksCount = 0;

  assignedBranchIds.forEach((branchId) => {
    const sub = submissions[`${branchId}_${date}`];
    if (sub && sub.tasks) {
      OPERATION_MANAGER_DUTIES.forEach((d) => {
        totalOmDuties++;
        const t = sub.tasks[d.id];
        if (t?.status === 'COMPLETED') completedOmDuties++;
        if (t?.status === 'UNABLE_TO_COMPLETE') flaggedOmIssues++;
      });

      DUTY_ITEMS.forEach((d) => {
        const t = sub.tasks[d.id];
        if (t?.omAuditStatus === 'VERIFIED') verifiedBranchTasksCount++;
        if (t?.omAuditStatus === 'FLAGGED') flaggedBranchTasksCount++;
      });
    } else {
      totalOmDuties += OPERATION_MANAGER_DUTIES.length;
    }
  });

  const omComplianceRate = totalOmDuties > 0 ? Math.round((completedOmDuties / totalOmDuties) * 100) : 0;
  const clusterScore = Math.min(100, Math.max(60, omComplianceRate));

  const newSummary: OperationalManagerDailySummary = {
    id: key,
    omId,
    omName: omUser?.name || (omId === 'lasantha' ? 'Lasantha (Operation Manager)' : 'Ranga (Operation Manager)'),
    date,
    isSubmitted: false,
    assignedBranchIds,
    totalOmDuties,
    completedOmDuties,
    flaggedOmIssues,
    omComplianceRate,
    verifiedBranchTasksCount,
    flaggedBranchTasksCount,
    clusterScore,
    executiveNotes: '',
  };

  return newSummary;
}

export function recordOmInTime(omId: 'lasantha' | 'ranga', date: string): OperationalManagerDailySummary {
  const summary = getOrCreateOmSummary(omId, date);
  if (!summary.inTime) {
    const slTime = getSriLankaIsoString();
    summary.inTime = slTime;
    saveOmSummary(summary);

    addNotification({
      type: 'INFO',
      title: `Field In-Time: ${summary.omName}`,
      message: `${summary.omName} commenced operational field duties and inspections at ${formatSriLankaTime(slTime)} (Sri Lanka Standard Time).`,
      targetRole: ['CEO'],
    });
  }
  return summary;
}

export function submitAndLockOmSummary(
  omId: 'lasantha' | 'ranga',
  date: string,
  executiveNotes?: string
): OperationalManagerDailySummary {
  const summary = getOrCreateOmSummary(omId, date);
  const slTime = getSriLankaIsoString();
  summary.isSubmitted = true;
  summary.submittedAt = slTime;
  if (!summary.inTime) {
    summary.inTime = slTime;
  }
  if (executiveNotes !== undefined) {
    summary.executiveNotes = executiveNotes;
  }
  saveOmSummary(summary);

  addNotification({
    type: 'SUCCESS',
    title: `Daily Operational Summary Submitted: ${summary.omName}`,
    message: `${summary.omName} has submitted daily operational field audit summary for ${date}. In-Time: ${formatSriLankaTime(summary.inTime)}, Submitted: ${formatSriLankaTime(slTime)}. OM Score: ${summary.omComplianceRate}%. Verified tasks: ${summary.verifiedBranchTasksCount}, Flagged: ${summary.flaggedBranchTasksCount}. Auto-routed to Executive Console.`,
    targetRole: ['CEO'],
  });

  return summary;
}

export function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading users', e);
  }
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(INITIAL_USERS));
  return INITIAL_USERS;
}

export function loadSubmissions(): Record<string, DailyBranchSubmission> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading submissions', e);
  }
  // Default is completely BLANK as requested by user
  const blank = createBlankSubmissions();
  localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(blank));
  return blank;
}

export function saveSubmissions(submissions: Record<string, DailyBranchSubmission>) {
  try {
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
  } catch (e) {
    console.error('Failed saving submissions', e);
  }
}

export function getOrCreateBranchSubmission(branchId: string, date: string): DailyBranchSubmission {
  const key = `${branchId}_${date}`;
  const submissions = loadSubmissions();

  if (submissions[key]) {
    const sub = submissions[key];
    let changed = false;
    for (const duty of ALL_DUTIES) {
      if (!sub.tasks[duty.id]) {
        sub.tasks[duty.id] = {
          dutyId: duty.id,
          dutyNumber: duty.dutyNumber,
          dutyTitle: duty.title,
          category: duty.category,
          status: 'PENDING',
          omAuditStatus: 'PENDING_REVIEW',
        };
        changed = true;
      }
    }
    if (changed) {
      saveSubmissions(submissions);
    }
    return sub;
  }

  const branch = BRANCHES.find((b) => b.id === branchId);
  const branchName = branch ? branch.name : branchId;

  const tasks: Record<number, TaskRecord> = {};
  for (const duty of ALL_DUTIES) {
    tasks[duty.id] = {
      dutyId: duty.id,
      dutyNumber: duty.dutyNumber,
      dutyTitle: duty.title,
      category: duty.category,
      status: 'PENDING',
      omAuditStatus: 'PENDING_REVIEW',
    };
  }

  const newSub: DailyBranchSubmission = {
    id: key,
    branchId,
    branchName,
    date,
    submittedBy: branch?.managerName || 'Branch Manager',
    completionPercentage: 0,
    tasks,
    isLocked: false,
    totalTasks: DUTY_ITEMS.length,
    completedTasksCount: 0,
    issueTasksCount: 0,
  };

  submissions[key] = newSub;
  saveSubmissions(submissions);
  return newSub;
}

export function recordBranchInTime(
  branchId: string,
  date: string,
  recordedByName: string
): DailyBranchSubmission {
  const submissions = loadSubmissions();
  const sub = getOrCreateBranchSubmission(branchId, date);

  if (!sub.inTime) {
    const slTime = getSriLankaIsoString();
    sub.inTime = slTime;
    sub.inTimeRecordedBy = recordedByName;
    submissions[sub.id] = sub;
    saveSubmissions(submissions);

    addNotification({
      type: 'INFO',
      title: `Duty In-Time: ${sub.branchName}`,
      message: `${recordedByName} commenced duties at ${sub.branchName} at ${formatSriLankaTime(slTime)} (Sri Lanka Standard Time).`,
      branchId,
      branchName: sub.branchName,
      targetRole: ['OPERATION_MANAGER', 'CEO'],
    });
  }

  return sub;
}

export function submitAndLockBranchChecklist(
  branchId: string,
  date: string,
  submittedByName: string
): DailyBranchSubmission {
  const submissions = loadSubmissions();
  const sub = getOrCreateBranchSubmission(branchId, date);
  const slTime = getSriLankaIsoString();

  sub.isLocked = true;
  sub.submittedAt = slTime;
  sub.submittedBy = submittedByName;
  if (!sub.inTime) {
    sub.inTime = slTime;
    sub.inTimeRecordedBy = submittedByName;
  }

  submissions[sub.id] = sub;
  saveSubmissions(submissions);

  // Automatically dispatch reports and notifications to OM and CEO
  addNotification({
    type: 'SUCCESS',
    title: `Daily Checklist Submitted: ${sub.branchName}`,
    message: `${submittedByName} has submitted and locked the daily checklist for ${sub.branchName}. In-Time: ${formatSriLankaTime(sub.inTime)}, Submitted: ${formatSriLankaTime(slTime)}. Tasks Done: ${sub.completedTasksCount}/${sub.totalTasks} (${sub.completionPercentage}%). Exceptions: ${sub.issueTasksCount}. Reports auto-routed to OM & CEO.`,
    branchId,
    branchName: sub.branchName,
    targetRole: ['OPERATION_MANAGER', 'CEO'],
  });

  return sub;
}

export function updateBranchTask(
  branchId: string,
  date: string,
  dutyId: number,
  updates: Partial<TaskRecord>,
  allowIfLocked: boolean = false
): DailyBranchSubmission {
  const submissions = loadSubmissions();
  const sub = getOrCreateBranchSubmission(branchId, date);

  // Strict Lock: If submitted, entered items CANNOT be modified
  if (sub.isLocked && !allowIfLocked) {
    return sub;
  }

  const existingTask = sub.tasks[dutyId] || {
    dutyId,
    dutyNumber: dutyId,
    dutyTitle: DUTY_ITEMS.find((d) => d.id === dutyId)?.title || `Duty #${dutyId}`,
    category: DUTY_ITEMS.find((d) => d.id === dutyId)?.category || 'Opening & Cleaning',
    status: 'PENDING',
  };

  const slTime = getSriLankaIsoString();

  // Sri Lanka standard time auto-saved on every completed/issue task
  let completedAt = updates.completedAt;
  if (updates.status === 'COMPLETED' && !completedAt) {
    completedAt = existingTask.completedAt || slTime;
  } else if (updates.status === 'UNABLE_TO_COMPLETE' && !completedAt) {
    completedAt = existingTask.completedAt || slTime;
  } else if (updates.status === 'PENDING') {
    completedAt = undefined;
  }

  // Auto-record In-Time if not already recorded when the first task is marked
  if (!sub.inTime && (updates.status === 'COMPLETED' || updates.status === 'UNABLE_TO_COMPLETE')) {
    sub.inTime = slTime;
    sub.inTimeRecordedBy = updates.completedBy || sub.submittedBy;
  }

  sub.tasks[dutyId] = {
    ...existingTask,
    ...updates,
    completedAt,
  };

  let completed = 0;
  let issues = 0;
  const total = DUTY_ITEMS.length;

  for (const task of Object.values(sub.tasks)) {
    if (task.status === 'COMPLETED') completed++;
    if (task.status === 'UNABLE_TO_COMPLETE') issues++;
  }

  sub.completedTasksCount = completed;
  sub.issueTasksCount = issues;
  sub.completionPercentage = Math.round((completed / total) * 100);

  submissions[sub.id] = sub;
  saveSubmissions(submissions);
  return sub;
}

export function updateOmAuditRecord(
  branchId: string,
  date: string,
  dutyId: number,
  auditStatus: 'VERIFIED' | 'FLAGGED' | 'PENDING_REVIEW',
  auditNotes: string,
  omName: string
): DailyBranchSubmission {
  const submissions = loadSubmissions();
  const key = `${branchId}_${date}`;
  const sub = submissions[key] || getOrCreateBranchSubmission(branchId, date);
  const slTime = getSriLankaIsoString();

  if (sub.tasks[dutyId]) {
    sub.tasks[dutyId].omAuditStatus = auditStatus;
    sub.tasks[dutyId].omAuditNotes = auditNotes;
    sub.tasks[dutyId].omAuditedBy = omName;
    sub.tasks[dutyId].omAuditedAt = slTime;
  }

  submissions[key] = sub;
  saveSubmissions(submissions);
  return sub;
}

export function loadNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading notifications', e);
  }

  const initialNotifs: NotificationItem[] = [
    {
      id: 'notif_1',
      timestamp: new Date().toISOString(),
      type: 'INFO',
      title: 'Operations System Ready',
      message: 'Rathna Super daily checklist system ready for today. All 7 branches online.',
      isRead: false,
      targetRole: ['CEO', 'OPERATION_MANAGER'],
    },
  ];

  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(initialNotifs));
  return initialNotifs;
}

export function addNotification(notif: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>): NotificationItem {
  const notifs = loadNotifications();
  const newItem: NotificationItem = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    isRead: false,
  };
  notifs.unshift(newItem);
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifs.slice(0, 50)));
  return newItem;
}

export function markNotificationAsRead(id: string) {
  const notifs = loadNotifications();
  const updated = notifs.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading current user', e);
  }
  return null;
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
  }
}

// Theme handling
export function getSavedTheme(): 'light' | 'dark' {
  const theme = localStorage.getItem(STORAGE_KEY_THEME);
  if (theme === 'dark' || theme === 'light') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setSavedTheme(theme: 'light' | 'dark') {
  localStorage.setItem(STORAGE_KEY_THEME, theme);
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  if (document.body) {
    document.body.classList.toggle('dark', isDark);
  }
}
