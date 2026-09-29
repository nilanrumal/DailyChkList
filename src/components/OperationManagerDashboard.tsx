import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Camera,
  MapPin,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Calendar,
  MessageSquare,
  Sparkles,
  Check,
  X,
  RotateCcw,
  Send,
  FileText,
} from 'lucide-react';
import { Branch, DailyBranchSubmission, DutyItem, OperationalManagerDailySummary, ProofData, TaskRecord, User } from '../types';
import { DUTY_ITEMS, OPERATION_MANAGER_DUTIES, BRANCH_MANAGER_DUTIES } from '../data/initialData';
import {
  updateOmAuditRecord,
  updateBranchTask,
  addNotification,
  getOrCreateOmSummary,
  saveOmSummary,
  loadOmSummaries,
  recordOmInTime,
  submitAndLockOmSummary,
} from '../services/storage';
import { formatSriLankaTime, getSriLankaIsoString } from '../services/networkTime';
import { ProofModal } from './ProofModal';

interface OperationManagerDashboardProps {
  currentUser: User;
  branches: Branch[];
  submissions: Record<string, DailyBranchSubmission>;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onRefreshSubmissions: () => void;
  onOpenChecklistForBranch: (branchId: string) => void;
}

export const OperationManagerDashboard: React.FC<OperationManagerDashboardProps> = ({
  currentUser,
  branches,
  submissions,
  selectedDate,
  onChangeDate,
  onRefreshSubmissions,
  onOpenChecklistForBranch,
}) => {
  // Only show branches assigned to this OM (or all if CEO is viewing)
  const assignedBranches = branches.filter((b) =>
    currentUser.assignedBranchIds ? currentUser.assignedBranchIds.includes(b.id) : true
  );

  const [inspectBranchId, setInspectBranchId] = useState<string>(
    assignedBranches[0]?.id || ''
  );
  const [inspectDutyId, setInspectDutyId] = useState<number | null>(null);
  const [auditNotesInput, setAuditNotesInput] = useState('');
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'ISSUES_ONLY' | 'PENDING_REVIEW'>('ALL');
  const [auditChecklistType, setAuditChecklistType] = useState<'OPERATION_MANAGER' | 'BRANCH_MANAGER'>('OPERATION_MANAGER');
  const [selectedProofPreview, setSelectedProofPreview] = useState<TaskRecord | null>(null);
  const [activeProofDuty, setActiveProofDuty] = useState<DutyItem | null>(null);

  const activeBranch = branches.find((b) => b.id === inspectBranchId) || assignedBranches[0];
  const activeSubmissionKey = `${activeBranch?.id}_${selectedDate}`;
  const activeSubmission = submissions[activeSubmissionKey];

  const auditDuties = auditChecklistType === 'OPERATION_MANAGER' ? OPERATION_MANAGER_DUTIES : BRANCH_MANAGER_DUTIES;

  // Current OM ID
  const currentOmId = (currentUser.id === 'lasantha' || currentUser.id === 'ranga') ? (currentUser.id as 'lasantha' | 'ranga') : 'lasantha';

  // OM 34 duties specific stats across all assigned branches
  let omDutiesTotal = 0;
  let omDutiesCompleted = 0;
  let omDutiesIssues = 0;
  let branchTasksVerified = 0;
  let branchTasksFlagged = 0;

  assignedBranches.forEach((b) => {
    const key = `${b.id}_${selectedDate}`;
    const sub = submissions[key];
    if (sub && sub.tasks) {
      OPERATION_MANAGER_DUTIES.forEach((d) => {
        omDutiesTotal++;
        const t = sub.tasks[d.id];
        if (t?.status === 'COMPLETED') omDutiesCompleted++;
        if (t?.status === 'UNABLE_TO_COMPLETE') omDutiesIssues++;
      });

      DUTY_ITEMS.forEach((d) => {
        const t = sub.tasks[d.id];
        if (t?.omAuditStatus === 'VERIFIED') branchTasksVerified++;
        if (t?.omAuditStatus === 'FLAGGED') branchTasksFlagged++;
      });
    } else {
      omDutiesTotal += OPERATION_MANAGER_DUTIES.length;
    }
  });

  const omRate = omDutiesTotal > 0 ? Math.round((omDutiesCompleted / omDutiesTotal) * 100) : 0;

  // Saved OM summary from storage
  const savedOmSummary = getOrCreateOmSummary(currentOmId, selectedDate, submissions);
  const [executiveNotesInput, setExecutiveNotesInput] = useState<string>(savedOmSummary.executiveNotes || '');
  const [isSummarySubmitted, setIsSummarySubmitted] = useState<boolean>(savedOmSummary.isSubmitted);
  const [submittedAtTime, setSubmittedAtTime] = useState<string | undefined>(savedOmSummary.submittedAt);
  const [omInTime, setOmInTime] = useState<string | undefined>(savedOmSummary.inTime);
  const [justSubmittedFeedback, setJustSubmittedFeedback] = useState<boolean>(false);

  // Sync state when selectedDate changes
  React.useEffect(() => {
    const s = getOrCreateOmSummary(currentOmId, selectedDate, submissions);
    setExecutiveNotesInput(s.executiveNotes || '');
    setIsSummarySubmitted(s.isSubmitted);
    setSubmittedAtTime(s.submittedAt);
    setOmInTime(s.inTime);
    setJustSubmittedFeedback(false);
  }, [selectedDate, currentOmId]);

  const handleRecordInTime = () => {
    const updated = recordOmInTime(currentOmId, selectedDate);
    setOmInTime(updated.inTime);
    onRefreshSubmissions();
  };

  const handleSubmitDailySummary = () => {
    const slTime = getSriLankaIsoString();
    const updatedSummary: OperationalManagerDailySummary = {
      id: `${currentOmId}_${selectedDate}`,
      omId: currentOmId,
      omName: currentUser.name,
      date: selectedDate,
      inTime: omInTime || slTime,
      submittedAt: slTime,
      isSubmitted: true,
      assignedBranchIds: assignedBranches.map((b) => b.id),
      totalOmDuties: omDutiesTotal,
      completedOmDuties: omDutiesCompleted,
      flaggedOmIssues: omDutiesIssues,
      omComplianceRate: omRate,
      verifiedBranchTasksCount: branchTasksVerified,
      flaggedBranchTasksCount: branchTasksFlagged,
      clusterScore: aggregatePercentage,
      executiveNotes: executiveNotesInput,
    };

    saveOmSummary(updatedSummary);
    setIsSummarySubmitted(true);
    setSubmittedAtTime(slTime);
    if (!omInTime) setOmInTime(slTime);
    setJustSubmittedFeedback(true);

    addNotification({
      type: 'SUCCESS',
      title: `Daily Operational Summary: ${currentUser.name}`,
      message: `${currentUser.name} has submitted the daily operational summary for ${assignedBranches.length} branches (${assignedBranches.map(b => b.name).join(', ')}). In-Time: ${formatSriLankaTime(omInTime || slTime)}, Submitted: ${formatSriLankaTime(slTime)}. Cluster Compliance: ${omRate}%, Tasks Verified: ${branchTasksVerified}, Flagged: ${branchTasksFlagged}. Automatically routed to Executive Console.`,
      branchName: assignedBranches.map((b) => b.name).join(', '),
      targetRole: ['CEO', 'OPERATION_MANAGER'],
    });

    onRefreshSubmissions();
    setTimeout(() => setJustSubmittedFeedback(false), 5000);
  };

  // Calculate aggregated stats for this OM based on the selected checklist type
  let totalTasks = 0;
  let totalCompleted = 0;
  let totalIssues = 0;

  assignedBranches.forEach((b) => {
    const key = `${b.id}_${selectedDate}`;
    const sub = submissions[key];
    if (sub && sub.tasks) {
      auditDuties.forEach((d) => {
        totalTasks++;
        const t = sub.tasks[d.id];
        if (t?.status === 'COMPLETED') totalCompleted++;
        if (t?.status === 'UNABLE_TO_COMPLETE') totalIssues++;
      });
    } else {
      totalTasks += auditDuties.length;
    }
  });

  const aggregatePercentage = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  // Audit status toggle by OM
  const handleUpdateAudit = (dutyId: number, status: 'VERIFIED' | 'FLAGGED') => {
    if (!activeBranch) return;
    updateOmAuditRecord(
      activeBranch.id,
      selectedDate,
      dutyId,
      status,
      auditNotesInput || (status === 'VERIFIED' ? 'Verified on-site by OM.' : 'Flagged for branch follow-up.'),
      currentUser.name
    );
    setInspectDutyId(null);
    setAuditNotesInput('');
    onRefreshSubmissions();
  };

  // Direct checklist item status toggle by OM (Mark Done / Mark Issue / Reset)
  const handleToggleComplete = (dutyId: number) => {
    if (!activeBranch) return;
    const currentTask = activeSubmission?.tasks?.[dutyId];
    const isCompleted = currentTask?.status === 'COMPLETED';
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED';

    updateBranchTask(activeBranch.id, selectedDate, dutyId, {
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? new Date().toISOString() : undefined,
      completedBy: currentUser.name,
      proof: newStatus === 'COMPLETED' ? undefined : currentTask?.proof,
    });
    onRefreshSubmissions();
  };

  const handleToggleIssue = (duty: DutyItem) => {
    if (!activeBranch) return;
    const currentTask = activeSubmission?.tasks?.[duty.id];
    const isIssue = currentTask?.status === 'UNABLE_TO_COMPLETE';

    if (isIssue) {
      // If already an issue, clicking Issue clears/resets to PENDING
      updateBranchTask(activeBranch.id, selectedDate, duty.id, {
        status: 'PENDING',
        completedAt: undefined,
        completedBy: currentUser.name,
        proof: undefined,
      });
      onRefreshSubmissions();
    } else {
      // Turn on camera and open ProofModal to capture proof photo
      setActiveProofDuty(duty);
    }
  };

  const handleSaveProof = (proof: ProofData) => {
    if (!activeBranch || !activeProofDuty) return;

    updateBranchTask(activeBranch.id, selectedDate, activeProofDuty.id, {
      status: 'UNABLE_TO_COMPLETE',
      proof,
      completedBy: currentUser.name,
      completedAt: undefined,
    });

    addNotification({
      type: 'ALERT',
      title: `Exception Reported: ${activeBranch.name}`,
      message: `${currentUser.name} (Operation Manager) reported exception for Duty #${activeProofDuty.dutyNumber} (${activeProofDuty.title}) at ${activeBranch.name}. Reason: ${proof.reason}. Photo proof & GPS attached.`,
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      targetRole: ['OPERATION_MANAGER', 'CEO'],
    });

    setActiveProofDuty(null);
    onRefreshSubmissions();
  };

  const handleNumericInput = (dutyId: number, valueStr: string) => {
    if (!activeBranch) return;
    const num = parseFloat(valueStr);
    updateBranchTask(activeBranch.id, selectedDate, dutyId, {
      numericValue: isNaN(num) ? undefined : num,
      completedAt: new Date().toISOString(),
      completedBy: currentUser.name,
    });
    onRefreshSubmissions();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
              <span className="font-semibold text-amber-700 dark:text-amber-400">Operation Manager View</span>
              <span aria-hidden="true">·</span>
              <span>{currentUser.name}</span>
              <span aria-hidden="true">·</span>
              <span>{assignedBranches.length} Assigned Outlets</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Assigned Branches Monitoring & Audit
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-950 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs">
              <Calendar className="w-4 h-4 text-stone-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                className="bg-transparent text-stone-900 dark:text-stone-100 font-medium focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Aggregated Cluster Scorecard */}
        <div className="pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-100 dark:border-stone-800/80">
            <span className="text-xs text-stone-500 block mb-1">Overall Cluster Progress</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                {aggregatePercentage}%
              </span>
              <span className="text-xs text-stone-500">
                ({totalCompleted} / {totalTasks} duties checked)
              </span>
            </div>
            <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${aggregatePercentage}%` }}
              />
            </div>
          </div>

          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <span className="text-xs text-emerald-800 dark:text-emerald-400 block mb-1">Total Verified Completed</span>
            <div className="text-3xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
              {totalCompleted}
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-500">Across your assigned branches</span>
          </div>

          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
            <span className="text-xs text-rose-800 dark:text-rose-400 block mb-1">Exceptions & Proofs Pending</span>
            <div className="text-3xl font-semibold font-mono tabular-nums text-rose-700 dark:text-rose-300">
              {totalIssues}
            </div>
            <span className="text-xs text-rose-600 dark:text-rose-500">Non-completed tasks with proof</span>
          </div>
        </div>

        {/* OM Daily Summary & Field In-Time Bar */}
        <div className="mt-6 pt-6 border-t border-stone-200 dark:border-stone-800">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-stone-50 to-emerald-500/10 dark:from-amber-950/20 dark:via-stone-900 dark:to-emerald-950/20 border border-amber-200 dark:border-amber-900/50">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Daily Operational Summary</span>
                  </span>
                  {isSummarySubmitted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      <span>Daily Summary Finalized & Synced</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Live Cluster Auto-Sync</span>
                    </span>
                  )}
                  {/* Field In-Time Badge */}
                  {omInTime ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Field In-Time: {formatSriLankaTime(omInTime)} (SLST)</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRecordInTime}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                      title="Log In-Time (Start of Field Duties) in Sri Lanka Standard Internet Time"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Log Field In-Time</span>
                    </button>
                  )}
                </div>
                <h3 className="font-display font-semibold text-lg text-stone-900 dark:text-stone-100">
                  Daily Operational Audit & Field Summary
                </h3>
                <p className="text-xs text-stone-600 dark:text-stone-400">
                  Compiles your 34 OM checklist items, store audits, exception flags, and field observations. Reports automatically route to executive management upon submission.
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-stone-500 mb-1">
                  {isSummarySubmitted && submittedAtTime
                    ? `Submitted: ${formatSriLankaTime(submittedAtTime)} (SLST)`
                    : 'Ready to submit'}
                </div>
                <button
                  type="button"
                  onClick={handleSubmitDailySummary}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isSummarySubmitted
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSummarySubmitted ? 'Update Daily Summary' : 'Submit Daily Operational Summary'}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 pb-4 border-t border-amber-200/60 dark:border-stone-800/80 text-xs">
              <div className="bg-white dark:bg-stone-900/80 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 block text-[11px]">OM 34-Duties Progress</span>
                <span className="font-mono font-bold text-sm text-stone-900 dark:text-stone-100">
                  {omDutiesCompleted} / {omDutiesTotal} ({omRate}%)
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900/80 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 block text-[11px]">Field Verifications (OK)</span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {branchTasksVerified} Verified
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900/80 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 block text-[11px]">Flagged Non-Compliances</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {branchTasksFlagged} Flagged
                </span>
              </div>
              <div className="bg-white dark:bg-stone-900/80 p-2.5 rounded-xl border border-stone-200 dark:border-stone-800">
                <span className="text-stone-500 block text-[11px]">Assigned Outlets</span>
                <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400">
                  {assignedBranches.length} Outlets Reporting
                </span>
              </div>
            </div>

            {/* Field Remarks / Observations */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-stone-800 dark:text-stone-200">
                Executive Remark & Field Action Plan:
              </label>
              <textarea
                rows={2}
                value={executiveNotesInput}
                onChange={(e) => setExecutiveNotesInput(e.target.value)}
                placeholder="Write your remarks and field audit findings (e.g., Visited Panadura Market and Millagashandiya; freezer temperatures verified; cash balancing inspected with zero issues)..."
                className="w-full py-2 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {justSubmittedFeedback && (
              <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  ✓ Daily operational summary finalized! Reports automatically synchronized with Executive Console.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Individual Branch Cards Grid */}
      <div>
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-4 flex items-center justify-between">
          <span>Individual Branch Performance & Timestamps (Real-time)</span>
          <span className="text-xs font-normal text-stone-500">Click a branch to inspect & audit</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedBranches.map((branch) => {
            const key = `${branch.id}_${selectedDate}`;
            const sub = submissions[key];
            const pct = sub ? sub.completionPercentage : 0;
            const completed = sub ? sub.completedTasksCount : 0;
            const issues = sub ? sub.issueTasksCount : 0;
            const isInspecting = branch.id === inspectBranchId;

            return (
              <div
                key={branch.id}
                onClick={() => setInspectBranchId(branch.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isInspecting
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono text-stone-500 block">{branch.code}</span>
                    <h3 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100">
                      {branch.name}
                    </h3>
                    <p className="text-xs text-stone-500 truncate max-w-[200px]">
                      Mgr: {branch.managerName}
                    </p>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-lg font-bold ${
                      pct >= 90
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : pct >= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Branch Manager Timestamps (In-Time & Submitted) */}
                <div className="flex items-center justify-between text-[11px] font-mono py-1.5 px-2 mb-2 rounded-lg bg-stone-50 dark:bg-stone-950/80 border border-stone-100 dark:border-stone-800 text-stone-600 dark:text-stone-300">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>In: {sub?.inTime ? formatSriLankaTime(sub.inTime) : '—'}</span>
                  </span>
                  <span>
                    Sub: {sub?.submittedAt ? formatSriLankaTime(sub.submittedAt) : 'In progress'}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800/80">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{completed} Done</span>
                  </span>

                  {issues > 0 && (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{issues} Issues</span>
                    </span>
                  )}

                  <span className="text-[11px] text-stone-400">
                    {sub?.isLocked ? 'Submitted & Locked' : 'Live In Progress'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Branch Inspection & Operation Manager Internal Audit Panel */}
      {activeBranch && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Operation Manager Audit Layer
                </span>
                <span className="text-stone-300 dark:text-stone-700">·</span>
                <span className="text-xs text-stone-500">Internal Review (Hidden from Branch Mgrs)</span>
              </div>
              <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                Auditing: {activeBranch.name} ({selectedDate})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Button to open full spreadsheet-style interactive checklist */}
              <button
                type="button"
                onClick={() => onOpenChecklistForBranch(activeBranch.id)}
                className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer mr-1"
                title="Open full interactive checklist view for this branch"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Full Checklist View</span>
              </button>

              {/* Checklist Mode Switcher */}
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200 dark:border-stone-700 mr-1">
                <button
                  type="button"
                  onClick={() => setAuditChecklistType('OPERATION_MANAGER')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    auditChecklistType === 'OPERATION_MANAGER'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  OM List (34)
                </button>
                <button
                  type="button"
                  onClick={() => setAuditChecklistType('BRANCH_MANAGER')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    auditChecklistType === 'BRANCH_MANAGER'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                  }`}
                >
                  Branch List (68)
                </button>
              </div>

              <button
                onClick={() => setAuditFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  auditFilter === 'ALL'
                    ? 'bg-stone-900 dark:bg-amber-600 text-white'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
                }`}
              >
                All ({auditDuties.length})
              </button>
              <button
                onClick={() => setAuditFilter('ISSUES_ONLY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  auditFilter === 'ISSUES_ONLY'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
                }`}
              >
                Exceptions with Proof Only
              </button>
              <button
                onClick={() => setAuditFilter('PENDING_REVIEW')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  auditFilter === 'PENDING_REVIEW'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
                }`}
              >
                Pending OM Review
              </button>
            </div>
          </div>

          {/* Audit items list */}
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {auditDuties.filter((duty) => {
              const task = activeSubmission?.tasks?.[duty.id];
              if (auditFilter === 'ISSUES_ONLY') return task?.status === 'UNABLE_TO_COMPLETE';
              if (auditFilter === 'PENDING_REVIEW') return task?.omAuditStatus !== 'VERIFIED';
              return true;
            }).map((duty) => {
              const task = activeSubmission?.tasks?.[duty.id];
              const isCompleted = task?.status === 'COMPLETED';
              const isUnable = task?.status === 'UNABLE_TO_COMPLETE';
              const auditStatus = task?.omAuditStatus || 'PENDING_REVIEW';
              const isInspectingThisDuty = inspectDutyId === duty.id;

              return (
                <div key={duty.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {/* One-Click Tick Checkbox for OM */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(duty.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer shrink-0 mt-0.5 ${
                          isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs scale-105'
                            : isUnable
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'border-2 border-stone-300 dark:border-stone-700 hover:border-emerald-500 bg-white dark:bg-stone-900 text-transparent'
                        }`}
                        title={isCompleted ? 'Completed (Click to unmark)' : 'Click to Mark Done (✓)'}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : isUnable ? (
                          <X className="w-4 h-4 stroke-[2.5]" />
                        ) : null}
                      </button>

                      <span className="font-mono tabular-nums text-xs font-semibold px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0">
                        #{duty.dutyNumber}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {duty.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-0.5">
                          <span>{duty.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Status:{' '}
                            <span
                              className={`font-semibold ${
                                isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isUnable
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-stone-500'
                              }`}
                            >
                              {task?.status || 'PENDING'}
                            </span>
                          </span>

                          {task?.completedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Marked: {formatSriLankaTime(task.completedAt)}</span>
                                {task.completedBy && <span>by {task.completedBy}</span>}
                              </span>
                            </>
                          )}

                          {task?.omAuditedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-purple-700 dark:text-purple-400 font-mono font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>OM {task.omAuditStatus}: {formatSriLankaTime(task.omAuditedAt)}</span>
                                {task.omAuditedBy && <span>({task.omAuditedBy})</span>}
                              </span>
                            </>
                          )}

                          {/* Inline temperature or numeric reading input */}
                          {(duty.requiresTemp || duty.requiresNumeric) && (
                            <div className="flex items-center gap-1.5 ml-1 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700">
                              <span className="font-medium text-[11px] text-stone-600 dark:text-stone-300">
                                {duty.requiresTemp ? 'Reading (°C):' : `${duty.numericUnit}:`}
                              </span>
                              <input
                                type="number"
                                step="0.1"
                                placeholder={duty.requiresTemp ? '°C' : duty.numericUnit}
                                value={task?.numericValue !== undefined ? task.numericValue : ''}
                                onChange={(e) => handleNumericInput(duty.id, e.target.value)}
                                className="w-16 py-0.5 px-1 text-xs rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 font-mono text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* OM Direct Action Buttons & Audit Badge */}
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                      {/* Mark Done button */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(duty.id)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCompleted ? 'Done' : 'Mark Done'}</span>
                      </button>

                      {/* Mark Issue button */}
                      <button
                        type="button"
                        onClick={() => handleToggleIssue(duty)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isUnable
                            ? 'bg-rose-600 text-white shadow-xs hover:bg-rose-700'
                            : 'border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                        title={isUnable ? 'Click to clear issue' : 'Report Issue with Camera Photo Proof'}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{isUnable ? 'Issue ✕' : 'Issue'}</span>
                      </button>

                      {/* View / Retake Camera Proof Button when duty is an Issue */}
                      {isUnable && (
                        <button
                          type="button"
                          onClick={() => setActiveProofDuty(duty)}
                          className="py-1 px-2 rounded-lg text-xs font-bold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900 text-rose-800 dark:text-rose-300 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          title="Open Camera to View or Retake Photo Proof"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{task?.proof?.imageUrl ? 'Proof 📸' : 'Cam Proof'}</span>
                        </button>
                      )}

                      {/* OM Audit Badge */}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-md font-medium border ${
                          auditStatus === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : auditStatus === 'FLAGGED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                            : 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
                        }`}
                      >
                        Audit: {auditStatus}
                      </span>

                      <button
                        onClick={() => setInspectDutyId(isInspectingThisDuty ? null : duty.id)}
                        className="py-1 px-2.5 text-xs bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-md transition-colors cursor-pointer"
                      >
                        {isInspectingThisDuty ? 'Close' : 'Audit Notes'}
                      </button>
                    </div>
                  </div>

                  {/* Exception Proof Details if Present */}
                  {task?.proof && (
                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Exception Reason: {task.proof.reason}</span>
                        </span>

                        {task.proof.location && (
                          <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {task.proof.location.latitude.toFixed(4)}, {task.proof.location.longitude.toFixed(4)}
                            </span>
                          </span>
                        )}
                      </div>

                      {task.proof.additionalNotes && (
                        <p className="text-xs text-stone-700 dark:text-stone-300">
                          Branch Remark: "{task.proof.additionalNotes}"
                        </p>
                      )}

                      {task.proof.imageUrl && (
                        <div className="pt-1 flex items-center gap-2">
                          <button
                            onClick={() => setSelectedProofPreview(task)}
                            className="py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3 h-3" />
                            <span>View Captured Proof Photo</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OM Audit Form Drawer */}
                  {isInspectingThisDuty && (
                    <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-stone-950 border border-amber-200/80 dark:border-stone-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                          Operation Manager Assessment ({currentUser.name})
                        </span>
                        <span className="text-[11px] text-stone-500">
                          Visible to OM & CEO only
                        </span>
                      </div>

                      <input
                        type="text"
                        value={auditNotesInput}
                        onChange={(e) => setAuditNotesInput(e.target.value)}
                        placeholder="Internal notes, e.g. Checked physical store, compressor replacement requested..."
                        className="w-full py-1.5 px-3 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-amber-600"
                      />

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateAudit(duty.id, 'FLAGGED')}
                          className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-medium cursor-pointer"
                        >
                          Flag Non-Compliance
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateAudit(duty.id, 'VERIFIED')}
                          className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium cursor-pointer"
                        >
                          Approve / Verify OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proof Photo Preview Lightbox */}
      {selectedProofPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-800">
            <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                  {selectedProofPreview.dutyTitle}
                </h3>
                <p className="text-xs text-stone-500">
                  Proof recorded at {new Date(selectedProofPreview.proof?.capturedAt || '').toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedProofPreview(null)}
                className="text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-stone-950 flex items-center justify-center">
              <img
                src={selectedProofPreview.proof?.imageUrl}
                alt="Proof"
                className="max-h-80 w-auto rounded object-contain"
              />
            </div>
            <div className="p-4 bg-stone-50 dark:bg-stone-900 text-xs space-y-1">
              <p className="font-semibold text-rose-700 dark:text-rose-400">
                Reason: {selectedProofPreview.proof?.reason}
              </p>
              {selectedProofPreview.proof?.location && (
                <p className="text-stone-500 font-mono">
                  GPS: {selectedProofPreview.proof.location.latitude.toFixed(6)},{' '}
                  {selectedProofPreview.proof.location.longitude.toFixed(6)} (
                  {selectedProofPreview.proof.location.addressDescription})
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Camera Proof Capture Modal for Operation Manager */}
      {activeProofDuty && activeBranch && (
        <ProofModal
          duty={activeProofDuty}
          branch={activeBranch}
          existingProof={activeSubmission?.tasks?.[activeProofDuty.id]?.proof}
          onSaveProof={handleSaveProof}
          onClose={() => setActiveProofDuty(null)}
        />
      )}
    </div>
  );
};
