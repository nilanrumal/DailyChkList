import React, { useState, useMemo, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Search,
  Filter,
  Thermometer,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Table,
  LayoutList,
  Check,
  X,
  Volume2,
  VolumeX,
  Database,
  Clock,
  Lock,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { Branch, DailyBranchSubmission, DutyCategory, DutyItem, ProofData, TaskRecord, User } from '../types';
import { DUTY_ITEMS, CATEGORIES, OPERATION_MANAGER_DUTIES, BRANCH_MANAGER_DUTIES } from '../data/initialData';
import { updateBranchTask, addNotification, recordBranchInTime, submitAndLockBranchChecklist } from '../services/storage';
import { formatSriLankaTime, getSriLankaIsoString } from '../services/networkTime';
import { ProofModal } from './ProofModal';

// Audio feedback chime for rapid ticking satisfaction
function playChime(type: 'success' | 'issue' | 'reset') {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'issue') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(311.13, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      osc.frequency.setValueAtTime(350, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  } catch {
    // Audio Context blocked or unavailable
  }
}

interface BranchChecklistViewProps {
  branch: Branch;
  currentUser: User;
  submission: DailyBranchSubmission;
  selectedDate: string;
  onRefreshSubmission: () => void;
  onChangeDate: (date: string) => void;
  onOpenSupabaseModal?: () => void;
}

export const BranchChecklistView: React.FC<BranchChecklistViewProps> = ({
  branch,
  currentUser,
  submission,
  selectedDate,
  onRefreshSubmission,
  onChangeDate,
  onOpenSupabaseModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'ISSUES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProofDuty, setActiveProofDuty] = useState<DutyItem | null>(null);
  const [viewMode, setViewMode] = useState<'SHEET' | 'CARDS'>('SHEET');
  const [rapidTickSound, setRapidTickSound] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const isOperationalManager = currentUser.role === 'OPERATION_MANAGER' || currentUser.role === 'CEO';
  const [activeListType, setActiveListType] = useState<'OPERATION_MANAGER' | 'BRANCH_MANAGER'>(
    isOperationalManager ? 'OPERATION_MANAGER' : 'BRANCH_MANAGER'
  );
  const clickTimerRef = useRef<{ [dutyId: number]: ReturnType<typeof setTimeout> }>({});
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);

  const baseDuties = activeListType === 'OPERATION_MANAGER' ? OPERATION_MANAGER_DUTIES : BRANCH_MANAGER_DUTIES;

  // Filtered duties
  const filteredDuties = useMemo(() => {
    return baseDuties.filter((duty) => {
      // Category filter
      if (selectedCategory !== 'All' && duty.category !== selectedCategory) {
        return false;
      }

      // Status filter
      const task = submission.tasks[duty.id];
      const status = task ? task.status : 'PENDING';
      if (statusFilter === 'COMPLETED' && status !== 'COMPLETED') return false;
      if (statusFilter === 'PENDING' && status !== 'PENDING') return false;
      if (statusFilter === 'ISSUES' && status !== 'UNABLE_TO_COMPLETE') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNumber = duty.dutyNumber.toString() === q;
        const matchesTitle = duty.title.toLowerCase().includes(q);
        const matchesCategory = duty.category.toLowerCase().includes(q);
        if (!matchesNumber && !matchesTitle && !matchesCategory) return false;
      }

      return true;
    });
  }, [selectedCategory, statusFilter, searchQuery, submission]);

  // Record Duty In-Time (Work Start) in Sri Lanka Standard Internet Time
  const handleRecordInTime = () => {
    if (submission.isLocked) return;
    recordBranchInTime(branch.id, selectedDate, currentUser.name);
    if (rapidTickSound) playChime('success');
    setPermissionNotice(`✓ In-Time recorded: ${formatSriLankaTime(getSriLankaIsoString())} (Sri Lanka Standard Time). Started duty.`);
    setTimeout(() => setPermissionNotice(null), 4000);
    onRefreshSubmission();
  };

  // Submit and permanently lock the daily checklist
  const handleSubmitAndLock = () => {
    if (submission.isLocked) return;
    const confirmMsg = `Are you sure you want to submit and lock the daily checklist for ${branch.name}? Once submitted, entered records cannot be modified and reports are automatically routed to OM & CEO.`;
    if (!window.confirm(confirmMsg)) return;

    submitAndLockBranchChecklist(branch.id, selectedDate, currentUser.name);
    if (rapidTickSound) playChime('success');
    setPermissionNotice(`✓ Daily checklist submitted and permanently locked. Reports automatically routed.`);
    setTimeout(() => setPermissionNotice(null), 5000);
    onRefreshSubmission();
  };

  // Handle single-tap rapid ticking (Done / Blank toggle)
  const handleSingleClick = (duty: DutyItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    // Auto-record In-Time if not already recorded
    if (!submission.inTime) {
      recordBranchInTime(branch.id, selectedDate, currentUser.name);
    }

    const existing = submission.tasks[duty.id];
    const isCurrentlyCompleted = existing?.status === 'COMPLETED';

    const newStatus = isCurrentlyCompleted ? 'PENDING' : 'COMPLETED';

    if (newStatus === 'COMPLETED' && rapidTickSound) {
      playChime('success');
    } else if (newStatus === 'PENDING' && rapidTickSound) {
      playChime('reset');
    }

    const slTime = getSriLankaIsoString();

    updateBranchTask(branch.id, selectedDate, duty.id, {
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? slTime : undefined,
      completedBy: currentUser.name,
      proof: newStatus === 'COMPLETED' ? undefined : existing?.proof,
    });

    setLastSavedTime(formatSriLankaTime(slTime));
    onRefreshSubmission();
  };

  // Double-tap: Mark Issue / Cross (✕)
  // Restricted exclusively to Operational Managers & CEO
  const handleDoubleClick = (duty: DutyItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    if (!isOperationalManager) {
      if (rapidTickSound) playChime('issue');
      setPermissionNotice('Notice: Marking an Issue / Cross (✕) is restricted to Operational Managers.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    const existing = submission.tasks[duty.id];
    const isCurrentlyUnable = existing?.status === 'UNABLE_TO_COMPLETE';
    const newStatus = isCurrentlyUnable ? 'PENDING' : 'UNABLE_TO_COMPLETE';

    if (newStatus === 'UNABLE_TO_COMPLETE' && rapidTickSound) {
      playChime('issue');
    } else if (newStatus === 'PENDING' && rapidTickSound) {
      playChime('reset');
    }

    const slTime = getSriLankaIsoString();

    updateBranchTask(branch.id, selectedDate, duty.id, {
      status: newStatus,
      completedAt: newStatus === 'UNABLE_TO_COMPLETE' ? slTime : undefined,
      completedBy: currentUser.name,
      proof: newStatus === 'UNABLE_TO_COMPLETE' ? existing?.proof : undefined,
    });

    setLastSavedTime(formatSriLankaTime(slTime));
    onRefreshSubmission();
  };

  const onDutyClick = (duty: DutyItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = duty.id;

    if (clickTimerRef.current[id]) {
      clearTimeout(clickTimerRef.current[id]);
      delete clickTimerRef.current[id];
      handleDoubleClick(duty, e);
    } else {
      clickTimerRef.current[id] = setTimeout(() => {
        delete clickTimerRef.current[id];
        handleSingleClick(duty, e);
      }, 230);
    }
  };

  const onDutyDoubleClick = (duty: DutyItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = duty.id;
    if (clickTimerRef.current[id]) {
      clearTimeout(clickTimerRef.current[id]);
      delete clickTimerRef.current[id];
    }
    handleDoubleClick(duty, e);
  };

  // Handle resetting a task back to Blank/Pending
  const handleResetTask = (dutyId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    if (rapidTickSound) playChime('reset');

    updateBranchTask(branch.id, selectedDate, dutyId, {
      status: 'PENDING',
      completedAt: undefined,
      proof: undefined,
      numericValue: undefined,
      notes: undefined,
    });
    setLastSavedTime(formatSriLankaTime(getSriLankaIsoString()));
    onRefreshSubmission();
  };

  // Handle temperature / numeric input change
  const handleNumericChange = (duty: DutyItem, value: number) => {
    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    if (!submission.inTime) {
      recordBranchInTime(branch.id, selectedDate, currentUser.name);
    }

    const slTime = getSriLankaIsoString();
    updateBranchTask(branch.id, selectedDate, duty.id, {
      numericValue: isNaN(value) ? undefined : value,
      completedAt: slTime,
      completedBy: currentUser.name,
    });
    setLastSavedTime(formatSriLankaTime(slTime));
    onRefreshSubmission();
  };

  // Handle inline remarks / notes
  const handleNotesChange = (duty: DutyItem, notes: string) => {
    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    updateBranchTask(branch.id, selectedDate, duty.id, {
      notes,
    });
    setLastSavedTime(formatSriLankaTime(getSriLankaIsoString()));
    onRefreshSubmission();
  };

  // Handle proof save (Red Issue)
  const handleSaveProof = (proof: ProofData) => {
    if (!activeProofDuty) return;

    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be modified.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    if (!submission.inTime) {
      recordBranchInTime(branch.id, selectedDate, currentUser.name);
    }

    if (rapidTickSound) playChime('issue');

    const slTime = getSriLankaIsoString();
    updateBranchTask(branch.id, selectedDate, activeProofDuty.id, {
      status: 'UNABLE_TO_COMPLETE',
      proof,
      completedBy: currentUser.name,
      completedAt: slTime,
    });

    // Automatically notify Operation Manager and CEO of this exception
    addNotification({
      type: 'ALERT',
      title: `Exception Reported: ${branch.name}`,
      message: `${branch.name} unable to complete Duty #${activeProofDuty.dutyNumber} (${activeProofDuty.title}). Reason: ${proof.reason}. Photo & GPS attached. Sri Lanka Time: ${formatSriLankaTime(slTime)}.`,
      branchId: branch.id,
      branchName: branch.name,
      targetRole: ['OPERATION_MANAGER', 'CEO'],
    });

    setActiveProofDuty(null);
    setLastSavedTime(formatSriLankaTime(slTime));
    onRefreshSubmission();
  };

  // Reset all duties for this date to Blank
  const handleResetAllToBlank = () => {
    if (submission.isLocked) {
      setPermissionNotice('Notice: This daily checklist has been submitted and locked. Entered records cannot be reset.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    if (window.confirm(`Are you sure you want to reset all 68 duties for ${branch.name} on ${selectedDate} back to BLANK?`)) {
      if (rapidTickSound) playChime('reset');
      for (const duty of DUTY_ITEMS) {
        updateBranchTask(branch.id, selectedDate, duty.id, {
          status: 'PENDING',
          completedAt: undefined,
          proof: undefined,
          numericValue: undefined,
          notes: undefined,
        });
      }
      setLastSavedTime(formatSriLankaTime(getSriLankaIsoString()));
      onRefreshSubmission();
    }
  };

  // Completion calculation
  const totalCount = DUTY_ITEMS.length;
  const completedCount = submission.completedTasksCount || 0;
  const issueCount = submission.issueTasksCount || 0;
  const pendingCount = totalCount - completedCount - issueCount;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* Branch & Checklist Header Banner */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-sm transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {branch.code}
              </span>
              <span className="text-xs text-stone-500 font-mono">
                {branch.location}
              </span>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <span className="text-xs text-stone-500 font-medium">
                Manager: {branch.managerName}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-3">
              <span>{branch.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-sans font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {activeListType === 'OPERATION_MANAGER' ? '34 OM Duties' : '68 Branch Duties'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              {activeListType === 'OPERATION_MANAGER'
                ? 'Operational Managers Check List — Total 34 Audit Duties (Google Sheet Synced)'
                : 'Daily Outlet Managers Check List — Total 68 Operational Duties'}
            </p>
          </div>

          {/* Date Picker, Checklist Switcher, Database Sync Indicator & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Checklist Mode Switcher */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setActiveListType('OPERATION_MANAGER')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeListType === 'OPERATION_MANAGER'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Operation Managers 34 Audit Checklist (Matches Google Sheet)"
              >
                Operation Managers (34)
              </button>
              <button
                type="button"
                onClick={() => setActiveListType('BRANCH_MANAGER')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeListType === 'BRANCH_MANAGER'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Branch Managers 68 Operational Checklist"
              >
                Branch Managers (68)
              </button>
            </div>

            {/* Database Access Status Indicator */}
            <div
              onClick={onOpenSupabaseModal}
              title="Click to view Database & Supabase connection"
              className="py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <div className="flex flex-col text-[11px] leading-tight">
                <span className="font-bold">Database: Synced</span>
                {lastSavedTime && <span className="text-[9px] text-emerald-600 dark:text-emerald-400">Saved {lastSavedTime}</span>}
              </div>
            </div>

            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-950/80 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-800">
              <Calendar className="w-4 h-4 text-stone-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                className="text-xs sm:text-sm font-medium bg-transparent text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setRapidTickSound(!rapidTickSound)}
              title={rapidTickSound ? 'Rapid Tick Sound: ON' : 'Rapid Tick Sound: OFF'}
              className="p-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl transition-colors cursor-pointer"
            >
              {rapidTickSound ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('SHEET')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'SHEET'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title="Spreadsheet / Attachment Sheet View"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Checklist Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'CARDS'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
                title="Cards View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>

            {/* Clear All to Blank */}
            <button
              type="button"
              onClick={handleResetAllToBlank}
              className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset all tasks to blank"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear to Blank</span>
            </button>
          </div>
        </div>

        {/* Progress Metrics & Vivid Green/Red Scorecard */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-stone-50 dark:bg-stone-950/60 rounded-2xl border border-stone-100 dark:border-stone-800/80">
            <span className="text-xs text-stone-500 block mb-1">Today's Progress</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                {percentage}%
              </span>
              <span className="text-xs text-stone-400">({completedCount}/{totalCount})</span>
            </div>
            <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Completed (Vivid Emerald Green) */}
          <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/30">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
              ✓ Completed (Done)
            </span>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {completedCount}
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Verified & green checked
            </span>
          </div>

          {/* Issues (Vivid Rose Red) */}
          <div className="p-3.5 bg-rose-500/10 dark:bg-rose-950/30 rounded-2xl border border-rose-500/30">
            <span className="text-xs font-bold text-rose-800 dark:text-rose-400 block mb-1">
              ✗ Unable / Issues (Proof)
            </span>
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">
              {issueCount}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
              Photo & GPS recorded
            </span>
          </div>

          {/* Blank / Pending */}
          <div className="p-3.5 bg-stone-50 dark:bg-stone-950/60 rounded-2xl border border-stone-200 dark:border-stone-800">
            <span className="text-xs text-stone-500 block mb-1">Pending / Blank</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-stone-700 dark:text-stone-300">
              {pendingCount}
            </div>
            <span className="text-[11px] text-stone-500">Awaiting store check</span>
          </div>
        </div>

        {/* Duty In-Time (Work Start) & Submit Daily Checklist (Lock) Bar */}
        <div className="mt-5 pt-5 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* In-Time Status / Button */}
            {submission.inTime ? (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400 block leading-tight font-medium">
                    Duty In-Time (Start of Work)
                  </span>
                  <span className="font-mono font-bold text-amber-900 dark:text-amber-300 text-sm">
                    {formatSriLankaTime(submission.inTime)}
                  </span>
                  {submission.inTimeRecordedBy && (
                    <span className="text-[11px] text-stone-500 ml-1.5 font-sans">
                      · by {submission.inTimeRecordedBy}
                    </span>
                  )}
                </div>
              </div>
            ) : !submission.isLocked ? (
              <button
                type="button"
                onClick={handleRecordInTime}
                className="py-2 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                title="Record Start of Duty (In-Time) in Sri Lanka Standard Internet Time"
              >
                <Clock className="w-4 h-4" />
                <span>Record In-Time (Start Duty)</span>
              </button>
            ) : null}

            <div className="flex items-center gap-1.5 text-xs text-stone-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sri Lanka Internet Time (Asia/Colombo UTC+05:30)</span>
            </div>
          </div>

          {/* Submit Daily Checklist & Lock Button */}
          <div>
            {submission.isLocked ? (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold shadow-xs">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                <div>
                  <span className="block font-bold">Checklist Submitted & Locked</span>
                  <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-300">
                    {formatSriLankaTime(submission.submittedAt)} by {submission.submittedBy} · Cannot be modified
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSubmitAndLock}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Submit today's checklist and lock entered tasks (Auto-sent to OM & CEO)"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Submit Daily Checklist (Lock)</span>
              </button>
            )}
          </div>
        </div>

        {/* Locked Banner */}
        {submission.isLocked && (
          <div className="mt-4 p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[10px]">
                🔒 LOCKED
              </span>
              <span>
                This daily checklist was submitted at <strong>{formatSriLankaTime(submission.submittedAt)}</strong> by <strong>{submission.submittedBy}</strong> (In-Time: <strong>{formatSriLankaTime(submission.inTime)}</strong>). All entered records are locked and cannot be changed. Reports are automatically synced with Operational Managers & CEO.
              </span>
            </div>
          </div>
        )}
      </div>

      {permissionNotice && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-sm animate-in fade-in">
          <span>{permissionNotice}</span>
          <button
            type="button"
            onClick={() => setPermissionNotice(null)}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-900 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Category Tabs & Quick Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === 'All'
                ? 'bg-stone-900 text-white dark:bg-emerald-600'
                : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
            }`}
          >
            All Duties ({baseDuties.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = baseDuties.filter((d) => d.category === cat).length;
            const isCatActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer ${
                  isCatActive
                    ? 'bg-stone-900 text-white dark:bg-emerald-600 font-semibold'
                    : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search duty number or title (e.g. 5, freezer, cash book, seal, expiry)..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-stone-900 p-1 rounded-xl border border-stone-200 dark:border-stone-800 text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-white' : 'text-stone-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'PENDING' ? 'bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200' : 'text-stone-500'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                statusFilter === 'COMPLETED' ? 'bg-emerald-600 text-white shadow-sm' : 'text-stone-500 hover:text-emerald-600'
              }`}
            >
              ✓ Done ({completedCount})
            </button>
            <button
              onClick={() => setStatusFilter('ISSUES')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                statusFilter === 'ISSUES' ? 'bg-rose-600 text-white shadow-sm' : 'text-stone-500 hover:text-rose-600'
              }`}
            >
              ✗ Issues ({issueCount})
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: SPREADSHEET FORM VIEW (Exact replica of WhatsApp Daily Outlet Managers Checklist) */}
      {viewMode === 'SHEET' ? (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-950 text-stone-700 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-800 select-none">
                  <th className="py-3 px-3 w-16 text-center border-r border-stone-200 dark:border-stone-800">
                    TICK
                  </th>
                  <th className="py-3 px-2 w-12 text-center border-r border-stone-200 dark:border-stone-800">
                    NO
                  </th>
                  <th className="py-3 px-4 min-w-[260px] border-r border-stone-200 dark:border-stone-800">
                    DUTY / OPERATIONAL CHECKLIST ITEM
                  </th>
                  <th className="py-3 px-3 min-w-[125px] text-center border-r border-stone-200 dark:border-stone-800">
                    TIME (SLST)
                  </th>
                  <th className="py-3 px-3 min-w-[120px] text-center border-r border-stone-200 dark:border-stone-800">
                    READING / TEMP
                  </th>
                  <th className="py-3 px-3 min-w-[180px] border-r border-stone-200 dark:border-stone-800">
                    REMARKS / NOTES
                  </th>
                  <th className="py-3 px-3 w-28 text-center">
                    EXCEPTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {filteredDuties.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-stone-500">
                      No checklist duties matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredDuties.map((duty) => {
                    const task = submission.tasks[duty.id];
                    const isCompleted = task?.status === 'COMPLETED';
                    const isUnable = task?.status === 'UNABLE_TO_COMPLETE';
                    const isCritical = duty.isCritical;

                    return (
                      <tr
                        key={duty.id}
                        onClick={(e) => onDutyClick(duty, e)} onDoubleClick={(e) => onDutyDoubleClick(duty, e)}
                        className={`transition-colors cursor-pointer select-none ${
                          isCompleted
                            ? 'bg-emerald-50/70 hover:bg-emerald-100/60 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50'
                            : isUnable
                            ? 'bg-rose-50/70 hover:bg-rose-100/60 dark:bg-rose-950/30 dark:hover:bg-rose-950/50'
                            : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                        }`}
                      >
                        {/* Column 1: Big Instant Tick Checkbox (One-Tap Done!) */}
                        <td className="py-3 px-3 text-center border-r border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            disabled={submission.isLocked}
                            onClick={(e) => onDutyClick(duty, e)} onDoubleClick={(e) => onDutyDoubleClick(duty, e)}
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all ${
                              submission.isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                            } ${
                              isCompleted
                                ? 'bg-emerald-600 text-white shadow-sm scale-110 ring-2 ring-emerald-500/30'
                                : isUnable
                                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                                : 'border-2 border-stone-300 dark:border-stone-700 hover:border-emerald-600 dark:hover:border-emerald-500 bg-white dark:bg-stone-900 text-transparent'
                            }`}
                            title={submission.isLocked ? 'Locked (Checklist submitted)' : isCompleted ? 'Click to unmark' : 'Tap to mark Done (Green Tick)'}
                          >
                            {isCompleted ? (
                              <Check className="w-4 h-4 stroke-[3]" />
                            ) : isUnable ? (
                              <X className="w-4 h-4 stroke-[3]" />
                            ) : (
                              <Check className="w-4 h-4 opacity-0 hover:opacity-40 text-emerald-600" />
                            )}
                          </button>
                        </td>

                        {/* Column 2: Number (1-68) */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-stone-700 dark:text-stone-300 border-r border-stone-100 dark:border-stone-800 text-xs">
                          {duty.dutyNumber}
                        </td>

                        {/* Column 3: Duty Title & Category */}
                        <td className="py-3 px-4 border-r border-stone-100 dark:border-stone-800">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold transition-colors ${
                                isCompleted
                                  ? 'text-emerald-950 dark:text-emerald-200'
                                  : isUnable
                                  ? 'text-rose-950 dark:text-rose-200 line-through'
                                  : 'text-stone-900 dark:text-stone-100'
                              }`}
                            >
                              {duty.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5 flex-wrap">
                            <span>{duty.category}</span>
                            {isCritical && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-700 dark:text-amber-400 font-medium">Critical</span>
                              </>
                            )}
                            {task?.completedAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{isCompleted ? '✓ Done' : 'Marked'}: {formatSriLankaTime(task.completedAt)}</span>
                                  {task.completedBy && <span>by {task.completedBy}</span>}
                                </span>
                              </>
                            )}
                            {task?.omAuditedAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-purple-700 dark:text-purple-400 font-mono font-medium flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>OM {task.omAuditStatus}: {formatSriLankaTime(task.omAuditedAt)} ({task.omAuditedBy})</span>
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Column: Recorded Time in Sri Lanka Standard Time */}
                        <td className="py-3 px-2 text-center border-r border-stone-100 dark:border-stone-800 font-mono text-[11px]">
                          {task?.completedAt ? (
                            <div className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/80">
                              <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>{formatSriLankaTime(task.completedAt)}</span>
                            </div>
                          ) : (
                            <span className="text-stone-400 dark:text-stone-600 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Column 4: Readings / Temp */}
                        <td
                          className="py-3 px-3 text-center border-r border-stone-100 dark:border-stone-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {duty.requiresTemp ? (
                            <div className="flex items-center justify-center gap-1">
                              <Thermometer className="w-3.5 h-3.5 text-stone-400" />
                              <input
                                type="number"
                                step="0.5"
                                placeholder="-18.0"
                                disabled={submission.isLocked}
                                defaultValue={task?.numericValue !== undefined ? task.numericValue : ''}
                                onBlur={(e) => handleNumericChange(duty, parseFloat(e.target.value))}
                                className={`w-16 py-1 px-1.5 text-xs font-mono text-center bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                                  submission.isLocked ? 'cursor-not-allowed opacity-80' : ''
                                }`}
                              />
                              <span className="text-xs text-stone-500 font-mono">°C</span>
                            </div>
                          ) : duty.requiresNumeric ? (
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                placeholder="Units"
                                disabled={submission.isLocked}
                                defaultValue={task?.numericValue !== undefined ? task.numericValue : ''}
                                onBlur={(e) => handleNumericChange(duty, parseFloat(e.target.value))}
                                className={`w-16 py-1 px-1.5 text-xs font-mono text-center bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                                  submission.isLocked ? 'cursor-not-allowed opacity-80' : ''
                                }`}
                              />
                              <span className="text-xs text-stone-500 font-mono">{duty.numericUnit || ''}</span>
                            </div>
                          ) : (
                            <span className="text-stone-300 dark:text-stone-700 text-xs">—</span>
                          )}
                        </td>

                        {/* Column 5: Remarks / Notes */}
                        <td
                          className="py-3 px-3 border-r border-stone-100 dark:border-stone-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            placeholder={submission.isLocked ? 'No remarks' : 'Add remark...'}
                            disabled={submission.isLocked}
                            defaultValue={task?.notes || ''}
                            onBlur={(e) => handleNotesChange(duty, e.target.value)}
                            className={`w-full py-1 px-2 text-xs bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-lg text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 ${
                              submission.isLocked ? 'cursor-not-allowed opacity-80' : ''
                            }`}
                          />
                        </td>

                        {/* Column 6: Exception / Issue Button (Red) */}
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isUnable ? (
                            <button
                              type="button"
                              onClick={() => setActiveProofDuty(duty)}
                              className="py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 mx-auto cursor-pointer"
                              title="View Proof Photo & GPS"
                            >
                              <Camera className="w-3 h-3" />
                              <span>Proof</span>
                            </button>
                          ) : isOperationalManager ? (
                            <button
                              type="button"
                              disabled={submission.isLocked}
                              onClick={() => setActiveProofDuty(duty)}
                              className={`py-1 px-2 rounded-lg bg-stone-100 hover:bg-rose-100 dark:bg-stone-800 dark:hover:bg-rose-950/80 text-stone-600 dark:text-stone-400 hover:text-rose-700 text-[11px] font-semibold transition-colors ${
                                submission.isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                              }`}
                              title="Report unable to complete with photo proof"
                            >
                              <span>Issue?</span>
                            </button>
                          ) : (
                            <span className="text-stone-300 dark:text-stone-700 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: INTERACTIVE CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDuties.map((duty) => {
            const task = submission.tasks[duty.id];
            const isCompleted = task?.status === 'COMPLETED';
            const isUnable = task?.status === 'UNABLE_TO_COMPLETE';
            const isCritical = duty.isCritical;

            return (
              <div
                key={duty.id}
                onClick={(e) => onDutyClick(duty, e)} onDoubleClick={(e) => onDutyDoubleClick(duty, e)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isCompleted
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                    : isUnable
                    ? 'bg-rose-50/80 dark:bg-rose-950/20 border-rose-500/40 shadow-sm'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-emerald-600/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {duty.dutyNumber}
                    </span>
                    <div>
                      <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                        {duty.title}
                      </h4>
                      <span className="text-[11px] text-stone-500 block mt-0.5">
                        {duty.category}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0">
                    {isCompleted ? (
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : isUnable ? (
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center">
                        <X className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full border-2 border-stone-300 dark:border-stone-700 flex items-center justify-center" />
                    )}
                  </div>
                </div>

                {/* Timestamp in Card */}
                {task?.completedAt && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                    <Clock className="w-3 h-3" />
                    <span>{isCompleted ? '✓ Done' : 'Marked'}: {formatSriLankaTime(task.completedAt)}</span>
                    {task.completedBy && <span className="font-sans text-stone-500">by {task.completedBy}</span>}
                  </div>
                )}

                {/* Card Controls */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={submission.isLocked}
                    onClick={(e) => onDutyClick(duty, e)} onDoubleClick={(e) => onDutyDoubleClick(duty, e)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      submission.isLocked
                        ? 'opacity-80 cursor-not-allowed bg-stone-100 dark:bg-stone-800 text-stone-500'
                        : isCompleted
                        ? 'bg-emerald-600 text-white cursor-pointer'
                        : 'bg-stone-100 hover:bg-emerald-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:text-emerald-700 cursor-pointer'
                    }`}
                  >
                    {isCompleted ? '✓ Done' : submission.isLocked ? 'Locked' : 'Tap to Complete'}
                  </button>

                  {isOperationalManager ? (
                    <button
                      type="button"
                      disabled={submission.isLocked}
                      onClick={() => setActiveProofDuty(duty)}
                      className={`px-2.5 py-1.5 rounded-lg text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 font-medium transition-colors ${
                        submission.isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      Report Issue
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exception Photo & Location Proof Modal */}
      {activeProofDuty && (
        <ProofModal
          duty={activeProofDuty}
          branch={branch}
          existingProof={submission.tasks[activeProofDuty.id]?.proof}
          onSaveProof={handleSaveProof}
          onClose={() => setActiveProofDuty(null)}
        />
      )}
    </div>
  );
};
