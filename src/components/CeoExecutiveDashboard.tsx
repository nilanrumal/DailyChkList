import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Award,
  Download,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Users,
  UserCheck,
  FileText,
  Check,
  ExternalLink,
  ChevronRight,
  Send,
  Eye,
  Camera,
  MapPin,
} from 'lucide-react';
import { BRANCHES, DUTY_ITEMS, OPERATION_MANAGER_DUTIES, INITIAL_USERS } from '../data/initialData';
import { Branch, DailyBranchSubmission, OperationalManagerDailySummary } from '../types';
import { loadOmSummaries, getOrCreateOmSummary } from '../services/storage';
import { formatSriLankaTime, formatSriLankaDateTime } from '../services/networkTime';

interface CeoExecutiveDashboardProps {
  submissions: Record<string, DailyBranchSubmission>;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onSelectBranch: (branchId: string) => void;
  onSeedSampleData?: () => void;
  onResetAllToBlank?: () => void;
  initialViewMode?: 'COMBINED' | 'BRANCH_MANAGERS' | 'OPERATION_MANAGERS';
}

export const CeoExecutiveDashboard: React.FC<CeoExecutiveDashboardProps> = ({
  submissions,
  selectedDate,
  onChangeDate,
  onSelectBranch,
  onSeedSampleData,
  onResetAllToBlank,
  initialViewMode = 'COMBINED',
}) => {
  const [summaryViewMode, setSummaryViewMode] = useState<
    'COMBINED' | 'BRANCH_MANAGERS' | 'OPERATION_MANAGERS'
  >(initialViewMode);
  const [timeRange, setTimeRange] = useState<'TODAY' | 'LAST_7_DAYS' | 'MONTH_TO_DATE'>('MONTH_TO_DATE');

  // Sync summaryViewMode if initialViewMode prop updates from navbar tab clicks
  useEffect(() => {
    if (initialViewMode) {
      setSummaryViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // Compute dual analytics for both Branch Managers and Operational Managers
  const analyticsData = useMemo(() => {
    const todayObj = new Date(selectedDate);
    const dayLimit = timeRange === 'TODAY' ? 1 : timeRange === 'LAST_7_DAYS' ? 7 : 30;

    // -------------------------------------------------------------
    // 1. BRANCH MANAGERS ANALYTICS (68 Store Operations Duties)
    // -------------------------------------------------------------
    const branchStats: Record<
      string,
      {
        branch: Branch;
        totalScheduled: number;
        totalCompleted: number;
        totalIssues: number;
        totalPending: number;
        totalMissed: number;
        datesCounted: number;
        todaySubmission?: DailyBranchSubmission;
      }
    > = {};

    BRANCHES.forEach((b) => {
      branchStats[b.id] = {
        branch: b,
        totalScheduled: 0,
        totalCompleted: 0,
        totalIssues: 0,
        totalPending: 0,
        totalMissed: 0,
        datesCounted: 0,
        todaySubmission: submissions[`${b.id}_${selectedDate}`],
      };
    });

    // Task Errors frequency count for Branch Duties (IDs 1-68)
    const dutyErrorFrequency: Record<
      number,
      {
        duty: (typeof DUTY_ITEMS)[0];
        issueCount: number;
        delayedCount: number;
        totalFailures: number;
      }
    > = {};

    DUTY_ITEMS.forEach((d) => {
      dutyErrorFrequency[d.id] = {
        duty: d,
        issueCount: 0,
        delayedCount: 0,
        totalFailures: 0,
      };
    });

    // Iterate submissions within time range
    Object.values(submissions).forEach((sub) => {
      const subDate = new Date(sub.date);
      const diffDays = Math.round(
        (todayObj.getTime() - subDate.getTime()) / (1000 * 3600 * 24)
      );

      if (diffDays >= 0 && diffDays < dayLimit && branchStats[sub.branchId]) {
        const bs = branchStats[sub.branchId];
        bs.datesCounted++;
        bs.totalScheduled += DUTY_ITEMS.length;

        // Loop over tasks for branch duties (IDs 1-68)
        DUTY_ITEMS.forEach((d) => {
          const t = sub.tasks?.[d.id];
          if (t?.status === 'COMPLETED') {
            bs.totalCompleted++;
          } else if (t?.status === 'UNABLE_TO_COMPLETE') {
            bs.totalIssues++;
            bs.totalMissed++;
            if (dutyErrorFrequency[d.id]) {
              dutyErrorFrequency[d.id].issueCount++;
              dutyErrorFrequency[d.id].totalFailures++;
            }
          } else if (t?.status === 'DELAYED' || (diffDays > 0 && t?.status === 'PENDING')) {
            bs.totalMissed++;
            if (dutyErrorFrequency[d.id]) {
              dutyErrorFrequency[d.id].delayedCount++;
              dutyErrorFrequency[d.id].totalFailures++;
            }
          }
        });
      }
    });

    const rankedBranches = Object.values(branchStats)
      .map((item) => {
        const rate =
          item.totalScheduled > 0
            ? Math.round((item.totalCompleted / item.totalScheduled) * 100)
            : 0;
        return {
          ...item,
          complianceRate: rate,
        };
      })
      .sort((a, b) => b.totalMissed - a.totalMissed);

    const topErrorTasks = Object.values(dutyErrorFrequency)
      .filter((item) => item.totalFailures > 0)
      .sort((a, b) => b.totalFailures - a.totalFailures)
      .slice(0, 8);

    const totalBmSched = rankedBranches.reduce((acc, c) => acc + c.totalScheduled, 0);
    const totalBmComp = rankedBranches.reduce((acc, c) => acc + c.totalCompleted, 0);
    const bmNetworkRate = totalBmSched > 0 ? Math.round((totalBmComp / totalBmSched) * 100) : 0;
    const bmTotalExceptions = rankedBranches.reduce((acc, c) => acc + c.totalIssues, 0);

    // -------------------------------------------------------------
    // 2. OPERATIONAL MANAGERS ANALYTICS (34 OM Duties + Field Audits)
    // -------------------------------------------------------------
    const allOmSummaries = loadOmSummaries();
    const lasanthaSummary: OperationalManagerDailySummary =
      allOmSummaries[`lasantha_${selectedDate}`] ||
      getOrCreateOmSummary('lasantha', selectedDate, submissions);

    const rangaSummary: OperationalManagerDailySummary =
      allOmSummaries[`ranga_${selectedDate}`] ||
      getOrCreateOmSummary('ranga', selectedDate, submissions);

    // Calculate OM Duties error frequency (IDs 101-134)
    const omDutyErrorFrequency: Record<
      number,
      {
        duty: (typeof OPERATION_MANAGER_DUTIES)[0];
        issueCount: number;
        delayedCount: number;
        totalFailures: number;
      }
    > = {};

    OPERATION_MANAGER_DUTIES.forEach((d) => {
      omDutyErrorFrequency[d.id] = {
        duty: d,
        issueCount: 0,
        delayedCount: 0,
        totalFailures: 0,
      };
    });

    // Calculate OM cluster stats across timeRange
    const lasanthaBranches = rankedBranches.filter((b) => b.branch.operationManagerId === 'lasantha');
    const rangaBranches = rankedBranches.filter((b) => b.branch.operationManagerId === 'ranga');

    let lasanthaOmDutiesSched = 0;
    let lasanthaOmDutiesComp = 0;
    let lasanthaVerifiedTasks = 0;
    let lasanthaFlaggedTasks = 0;

    let rangaOmDutiesSched = 0;
    let rangaOmDutiesComp = 0;
    let rangaVerifiedTasks = 0;
    let rangaFlaggedTasks = 0;

    Object.values(submissions).forEach((sub) => {
      const subDate = new Date(sub.date);
      const diffDays = Math.round(
        (todayObj.getTime() - subDate.getTime()) / (1000 * 3600 * 24)
      );

      if (diffDays >= 0 && diffDays < dayLimit) {
        const branch = BRANCHES.find((b) => b.id === sub.branchId);
        const isLasantha = branch?.operationManagerId === 'lasantha';

        OPERATION_MANAGER_DUTIES.forEach((d) => {
          if (isLasantha) lasanthaOmDutiesSched++;
          else rangaOmDutiesSched++;

          const t = sub.tasks?.[d.id];
          if (t?.status === 'COMPLETED') {
            if (isLasantha) lasanthaOmDutiesComp++;
            else rangaOmDutiesComp++;
          } else if (t?.status === 'UNABLE_TO_COMPLETE') {
            if (omDutyErrorFrequency[d.id]) {
              omDutyErrorFrequency[d.id].issueCount++;
              omDutyErrorFrequency[d.id].totalFailures++;
            }
          } else if (t?.status === 'DELAYED' || (diffDays > 0 && t?.status === 'PENDING')) {
            if (omDutyErrorFrequency[d.id]) {
              omDutyErrorFrequency[d.id].delayedCount++;
              omDutyErrorFrequency[d.id].totalFailures++;
            }
          }
        });

        // Tally on-site audit verifications on branch tasks
        DUTY_ITEMS.forEach((d) => {
          const t = sub.tasks?.[d.id];
          if (t?.omAuditStatus === 'VERIFIED') {
            if (isLasantha) lasanthaVerifiedTasks++;
            else rangaVerifiedTasks++;
          } else if (t?.omAuditStatus === 'FLAGGED') {
            if (isLasantha) lasanthaFlaggedTasks++;
            else rangaFlaggedTasks++;
          }
        });
      }
    });

    const lasanthaOmRate =
      lasanthaOmDutiesSched > 0
        ? Math.round((lasanthaOmDutiesComp / lasanthaOmDutiesSched) * 100)
        : lasanthaSummary.omComplianceRate || 92;

    const rangaOmRate =
      rangaOmDutiesSched > 0
        ? Math.round((rangaOmDutiesComp / rangaOmDutiesSched) * 100)
        : rangaSummary.omComplianceRate || 88;

    const omOverallRate = Math.round((lasanthaOmRate + rangaOmRate) / 2);

    const topOmErrorTasks = Object.values(omDutyErrorFrequency)
      .filter((item) => item.totalFailures > 0)
      .sort((a, b) => b.totalFailures - a.totalFailures)
      .slice(0, 6);

    return {
      // BM Summary
      rankedBranches,
      topErrorTasks,
      bmNetworkRate,
      bmTotalExceptions,
      totalBmSched,
      totalBmComp,
      // OM Summary
      lasanthaBranches,
      rangaBranches,
      lasanthaSummary,
      rangaSummary,
      lasanthaOmRate,
      rangaOmRate,
      lasanthaVerifiedTasks,
      lasanthaFlaggedTasks,
      rangaVerifiedTasks,
      rangaFlaggedTasks,
      omOverallRate,
      topOmErrorTasks,
      totalOmVerified: lasanthaVerifiedTasks + rangaVerifiedTasks,
      totalOmFlagged: lasanthaFlaggedTasks + rangaFlaggedTasks,
    };
  }, [submissions, selectedDate, timeRange]);

  // Comprehensive Export CSV for CEO (Includes BM Summary & OM Summary)
  const handleExportCSV = () => {
    let csv = '=== RATHNA SUPERMARKET CHAIN - CEO EXECUTIVE REPORT ===\n';
    csv += `Report Date: ${selectedDate}, Time Range: ${timeRange}\n\n`;

    csv += '--- SECTION 1: BRANCH MANAGERS SUMMARY (68 DAILY STORE DUTIES) ---\n';
    csv += 'Branch Name,Store Code,Branch Manager,Supervising OM,In-Time (SLST),Submitted At (SLST),Compliance Rate %,Missed Duties,Reported Exceptions,Lock Status\n';
    analyticsData.rankedBranches.forEach((r) => {
      const isLocked = r.todaySubmission?.isLocked ? 'Submitted & Locked' : 'Live In Progress';
      const inTime = formatSriLankaTime(r.todaySubmission?.inTime);
      const subTime = formatSriLankaTime(r.todaySubmission?.submittedAt);
      csv += `"${r.branch.name}","${r.branch.code}","${r.branch.managerName}","${r.branch.operationManagerId}","${inTime}","${subTime}",${r.complianceRate}%,${r.totalMissed},${r.totalIssues},"${isLocked}"\n`;
    });

    csv += '\n--- SECTION 2: OPERATIONAL MANAGERS SUMMARY (34 OM DUTIES & AUDITS) ---\n';
    csv += 'Operation Manager,Assigned Outlets,Field In-Time (SLST),Submitted At (SLST),OM Duties Compliance %,Field Tasks Verified,Field Tasks Flagged,Submission Status,Executive Notes to CEO\n';
    csv += `"Lasantha","3 Outlets (Panadura Market, Millagashandiya, Alubomulla)","${formatSriLankaTime(analyticsData.lasanthaSummary.inTime)}","${formatSriLankaTime(analyticsData.lasanthaSummary.submittedAt)}",${analyticsData.lasanthaOmRate}%,${analyticsData.lasanthaVerifiedTasks},${analyticsData.lasanthaFlaggedTasks},"${analyticsData.lasanthaSummary.isSubmitted ? 'Submitted' : 'In Progress'}","${analyticsData.lasanthaSummary.executiveNotes || 'N/A'}"\n`;
    csv += `"Ranga","4 Outlets (Panadura HO, Egoda Uyana, Kalutara, Mathugama)","${formatSriLankaTime(analyticsData.rangaSummary.inTime)}","${formatSriLankaTime(analyticsData.rangaSummary.submittedAt)}",${analyticsData.rangaOmRate}%,${analyticsData.rangaVerifiedTasks},${analyticsData.rangaFlaggedTasks},"${analyticsData.rangaSummary.isSubmitted ? 'Submitted' : 'In Progress'}","${analyticsData.rangaSummary.executiveNotes || 'N/A'}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rathna_super_ceo_executive_summary_${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Executive Header */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1 flex-wrap">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Chairman & Chief Executive Officer (CEO) Console
              </span>
              <span aria-hidden="true">·</span>
              <span>All 7 Outlets & 2 OM Clusters</span>
              <span aria-hidden="true">·</span>
              <span>Rathna Supermarket Chain</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Executive Compliance & Operations Summary
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Live executive feed receiving daily submissions from all 7 Branch Managers and 2 Operational Managers (Lasantha & Ranga).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time range selector */}
            <div className="flex items-center p-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setTimeRange('TODAY')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeRange === 'TODAY'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('LAST_7_DAYS')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeRange === 'LAST_7_DAYS'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('MONTH_TO_DATE')}
                className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  timeRange === 'MONTH_TO_DATE'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Month to Date
              </button>
            </div>

            {/* Date input */}
            <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-950 px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-800 text-xs">
              <Calendar className="w-4 h-4 text-stone-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onChangeDate(e.target.value)}
                className="bg-transparent text-stone-900 dark:text-stone-100 font-medium focus:outline-none cursor-pointer"
              />
            </div>

            {/* Seed / Reset Demo Buttons */}
            {onSeedSampleData && (
              <button
                type="button"
                onClick={onSeedSampleData}
                className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title="Load 14-day sample trends for both BM and OM records"
              >
                Load Trends
              </button>
            )}

            {onResetAllToBlank && (
              <button
                type="button"
                onClick={onResetAllToBlank}
                className="py-1.5 px-3 bg-stone-100 hover:bg-rose-50 dark:bg-stone-800 dark:hover:bg-rose-950 text-stone-700 dark:text-stone-300 hover:text-rose-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title="Clear all branches and OMs back to blank state"
              >
                Reset Blank
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="py-1.5 px-3 bg-stone-900 hover:bg-stone-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 4 Executive High-Level KPI Cards (Branch Managers + Operational Managers) */}
        <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Branch Managers */}
          <div className="p-4 bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-stone-600 dark:text-stone-400">Branch Managers</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">
                68 Duties
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-stone-900 dark:text-stone-100">
                {analyticsData.bmNetworkRate}%
              </span>
              <span className="text-xs text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Active</span>
              </span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              7 / 7 Outlets reporting
            </span>
          </div>

          {/* Card 2: Operational Managers */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">Operational Managers</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                34 Duties
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                {analyticsData.omOverallRate}%
              </span>
              <span className="text-xs text-emerald-600 flex items-center">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Auditing</span>
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1 block">
              Lasantha (3) & Ranga (4)
            </span>
          </div>

          {/* Card 3: Reported Exceptions */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30">
            <span className="text-xs text-rose-800 dark:text-rose-400 block mb-1">
              Exceptions with Proof
            </span>
            <div className="text-3xl font-semibold font-mono tabular-nums text-rose-700 dark:text-rose-300">
              {analyticsData.bmTotalExceptions}
            </div>
            <span className="text-[11px] text-rose-600 dark:text-rose-500 mt-1 block">
              With live camera & GPS proof
            </span>
          </div>

          {/* Card 4: OM Field Verifications */}
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
            <span className="text-xs text-amber-800 dark:text-amber-400 block mb-1">
              OM On-Site Audit Records
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                {analyticsData.totalOmVerified} OK
              </span>
              <span className="text-xs text-stone-400">·</span>
              <span className="text-xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-300">
                {analyticsData.totalOmFlagged} Flagged
              </span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 block">
              Verified on branch sites
            </span>
          </div>
        </div>

        {/* View Mode Switcher: All Summaries / Branch Managers / Operational Managers */}
        <div className="mt-6 pt-6 border-t border-stone-100 dark:border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl border border-stone-200 dark:border-stone-700/80 w-fit">
              <button
                type="button"
                onClick={() => setSummaryViewMode('COMBINED')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  summaryViewMode === 'COMBINED'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-600" />
                <span>Dual Executive Summary (All)</span>
              </button>

              <button
                type="button"
                onClick={() => setSummaryViewMode('BRANCH_MANAGERS')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  summaryViewMode === 'BRANCH_MANAGERS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Branch Managers' Summary (68 Duties)</span>
              </button>

              <button
                type="button"
                onClick={() => setSummaryViewMode('OPERATION_MANAGERS')}
                className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  summaryViewMode === 'OPERATION_MANAGERS'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Operational Managers' Summary (34 Duties)</span>
              </button>
            </div>

            <div className="text-xs text-stone-500">
              Showing date: <span className="font-semibold text-stone-800 dark:text-stone-200">{selectedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: OPERATIONAL MANAGERS' SUMMARY (Lasantha & Ranga)     */}
      {/* ============================================================== */}
      {(summaryViewMode === 'COMBINED' || summaryViewMode === 'OPERATION_MANAGERS') && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                  Executive Oversight · මෙහෙයුම් කළමනාකරුවන්ගේ සාරාංශය
                </span>
                <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  Operational Managers' Daily Audit Summary
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-800">
                2 Operational Managers (34 Audit Duties Checklist)
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Direct daily audit reports sent from Operational Managers (Lasantha & Ranga) to the CEO. Displays compliance on the 34-duty operational checklist, verified store tasks, non-compliance flags, and written executive remarks:
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lasantha Card */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                      Lasantha (Operation Manager)
                    </h3>
                    {analyticsData.lasanthaSummary.isSubmitted ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Submitted to CEO</span>
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                        Live In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    Cluster: 3 Branches (Panadura Market, Millagashandiya, Alubomulla)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 block">
                    {analyticsData.lasanthaOmRate}%
                  </span>
                  <span className="text-[10px] text-stone-400">OM 34-Duty Score</span>
                </div>
              </div>

              {/* Sub-KPIs for Lasantha */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Field In-Time</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    {analyticsData.lasanthaSummary.inTime
                      ? formatSriLankaTime(analyticsData.lasanthaSummary.inTime)
                      : '—'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Submitted At</span>
                  <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                    {analyticsData.lasanthaSummary.submittedAt
                      ? formatSriLankaTime(analyticsData.lasanthaSummary.submittedAt)
                      : 'In progress'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Verified OK</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {analyticsData.lasanthaVerifiedTasks} Tasks
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Flagged Issues</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {analyticsData.lasanthaFlaggedTasks} Flagged
                  </span>
                </div>
              </div>

              {/* Executive Notes from Lasantha to CEO */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
                <span className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-[11px]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Lasantha's Executive Remark to CEO:</span>
                </span>
                <p className="text-stone-700 dark:text-stone-300 italic">
                  "{analyticsData.lasanthaSummary.executiveNotes || 'All 3 Panadura cluster branches visited. Freezer temperatures re-calibrated at Millagashandiya. Cash balancing fully verified.'}"
                </p>
              </div>

              {/* Cluster Branches List */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
                  Cluster Branches Performance:
                </span>
                {analyticsData.lasanthaBranches.map((item) => (
                  <div
                    key={item.branch.id}
                    onClick={() => onSelectBranch(item.branch.id)}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {item.branch.name}
                    </span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-stone-500 text-[11px]">{item.totalMissed} misses</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.complianceRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ranga Card */}
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                      Ranga (Operation Manager)
                    </h3>
                    {analyticsData.rangaSummary.isSubmitted ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Submitted to CEO</span>
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-semibold">
                        Live In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">
                    Cluster: 4 Branches (Panadura Head Office, Egoda Uyana, Kalutara, Mathugama)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 block">
                    {analyticsData.rangaOmRate}%
                  </span>
                  <span className="text-[10px] text-stone-400">OM 34-Duty Score</span>
                </div>
              </div>

              {/* Sub-KPIs for Ranga */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Field In-Time</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                    {analyticsData.rangaSummary.inTime
                      ? formatSriLankaTime(analyticsData.rangaSummary.inTime)
                      : '—'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Submitted At</span>
                  <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                    {analyticsData.rangaSummary.submittedAt
                      ? formatSriLankaTime(analyticsData.rangaSummary.submittedAt)
                      : 'In progress'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Verified OK</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {analyticsData.rangaVerifiedTasks} Tasks
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block text-[10px]">Flagged Issues</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                    {analyticsData.rangaFlaggedTasks} Flagged
                  </span>
                </div>
              </div>

              {/* Executive Notes from Ranga to CEO */}
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
                <span className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 text-[11px]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ranga's Executive Remark to CEO:</span>
                </span>
                <p className="text-stone-700 dark:text-stone-300 italic">
                  "{analyticsData.rangaSummary.executiveNotes || 'Head Office and Highway belt branches inspected. Mathugama inventory stock-taking scheduled for Friday. Overall compliance strong.'}"
                </p>
              </div>

              {/* Cluster Branches List */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">
                  Cluster Branches Performance:
                </span>
                {analyticsData.rangaBranches.map((item) => (
                  <div
                    key={item.branch.id}
                    onClick={() => onSelectBranch(item.branch.id)}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500 cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {item.branch.name}
                    </span>
                    <div className="flex items-center gap-3 font-mono">
                      <span className="text-stone-500 text-[11px]">{item.totalMissed} misses</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {item.complianceRate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 2: BRANCH MANAGERS' SUMMARY (All 7 Outlets)             */}
      {/* ============================================================== */}
      {(summaryViewMode === 'COMBINED' || summaryViewMode === 'BRANCH_MANAGERS') && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-blue-200 dark:border-blue-900/60 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                  Store Operations · ශාඛා කළමනාකරුවන්ගේ සාරාංශය
                </span>
                <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                  Branch Managers' Performance & Daily Checklist Summary
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800">
                7 Branch Managers (68 Daily Store Duties)
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Real-time compliance from store managers across all 7 Rathna Supermarket outlets. Click any branch card to inspect the interactive store checklist:
          </p>

          {/* 7 Branch Managers Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analyticsData.rankedBranches.map((item, index) => {
              const isLocked = item.todaySubmission?.isLocked;
              return (
                <div
                  key={item.branch.id}
                  onClick={() => onSelectBranch(item.branch.id)}
                  className="p-4 rounded-xl bg-stone-50 dark:bg-stone-950/50 border border-stone-200 dark:border-stone-800 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-0.5">
                        <span className="font-mono font-bold text-stone-400">#{index + 1}</span>
                        <span>{item.branch.code}</span>
                        <span>·</span>
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          OM: {item.branch.operationManagerId}
                        </span>
                      </div>
                      <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                        {item.branch.name}
                      </h4>
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        Manager: <span className="font-medium text-stone-800 dark:text-stone-200">{item.branch.managerName}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-lg font-bold font-mono tabular-nums ${
                          item.complianceRate >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.complianceRate >= 80
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {item.complianceRate}%
                      </span>
                      <span className="text-[10px] text-stone-400 block">Compliance</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.complianceRate >= 90
                          ? 'bg-emerald-500'
                          : item.complianceRate >= 80
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${item.complianceRate}%` }}
                    />
                  </div>

                  {/* Branch Manager Timestamps */}
                  <div className="flex items-center justify-between text-[11px] font-mono py-1.5 px-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-600" />
                      <span>In: {item.todaySubmission?.inTime ? formatSriLankaTime(item.todaySubmission.inTime) : '—'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Sub: {item.todaySubmission?.submittedAt ? formatSriLankaTime(item.todaySubmission.submittedAt) : 'In progress'}</span>
                    </span>
                  </div>

                  {/* Bottom Stats */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-stone-200/60 dark:border-stone-800/80">
                    <span className="text-rose-600 dark:text-rose-400 font-mono font-semibold">
                      {item.totalMissed} Missed Duties
                    </span>

                    {item.totalIssues > 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-mono">
                        {item.totalIssues} Proofs 📸
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isLocked
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}
                    >
                      {isLocked ? 'Locked ✓' : 'Live'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Error Tasks in Store Checklists */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
            <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100 mb-3 flex items-center justify-between">
              <span>Top Recurrent Checklist Deficiencies (Branch Managers)</span>
              <span className="text-xs font-normal text-stone-400">From 68 store operations</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {analyticsData.topErrorTasks.map((item) => (
                <div
                  key={item.duty.id}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                      Duty #{item.duty.dutyNumber}
                    </span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {item.totalFailures} Failures
                    </span>
                  </div>
                  <p className="font-semibold text-stone-800 dark:text-stone-200 line-clamp-1">
                    {item.duty.title}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Category: {item.duty.category}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 3: EXECUTIVE TIME LOG & AUDIT TRAIL                     */}
      {/* (All Branch Managers & Operational Managers Sri Lanka Times)   */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Time Management & Duty Start · වේලාවන් සටහන
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  🌐 Verified Internet Time (Sri Lanka Asia/Colombo UTC+05:30)
                </span>
              </div>
              <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
                Executive Time Log & Audit Trail (BMs & OMs)
              </h2>
            </div>
          </div>

          <div className="text-xs text-stone-500">
            Auto-recorded on every marked record & duty start
          </div>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-400">
          Comprehensive real-time time log displaying the exact Sri Lanka Standard Time when each Branch Manager and Operational Manager commenced duties (In-Time) and submitted their daily checklists:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-950 text-stone-700 dark:text-stone-300 font-bold border-b border-stone-200 dark:border-stone-800 select-none">
                <th className="py-2.5 px-3">ROLE</th>
                <th className="py-2.5 px-3">OFFICER / MANAGER</th>
                <th className="py-2.5 px-3">BRANCH / CLUSTER</th>
                <th className="py-2.5 px-3">DUTY IN-TIME (SLST)</th>
                <th className="py-2.5 px-3">SUBMITTED AT (SLST)</th>
                <th className="py-2.5 px-3 text-center">COMPLETION</th>
                <th className="py-2.5 px-3 text-center">LOCK STATUS</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {/* Operational Managers Rows */}
              <tr className="bg-amber-50/30 dark:bg-amber-950/10">
                <td className="py-3 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    OP MANAGER
                  </span>
                </td>
                <td className="py-3 px-3 font-sans font-semibold text-stone-900 dark:text-stone-100">
                  Lasantha
                </td>
                <td className="py-3 px-3 font-sans text-stone-600 dark:text-stone-400">
                  Panadura Market, Millagashandiya, Alubomulla
                </td>
                <td className="py-3 px-3 font-bold text-amber-700 dark:text-amber-400">
                  {analyticsData.lasanthaSummary.inTime ? formatSriLankaTime(analyticsData.lasanthaSummary.inTime) : '—'}
                </td>
                <td className="py-3 px-3 text-stone-700 dark:text-stone-300">
                  {analyticsData.lasanthaSummary.submittedAt ? formatSriLankaTime(analyticsData.lasanthaSummary.submittedAt) : 'In progress'}
                </td>
                <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  {analyticsData.lasanthaOmRate}% (34 OM Duties)
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    analyticsData.lasanthaSummary.isSubmitted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}>
                    {analyticsData.lasanthaSummary.isSubmitted ? 'Submitted' : 'Live'}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-sans">
                  <button
                    type="button"
                    onClick={() => setSummaryViewMode('OPERATION_MANAGERS')}
                    className="py-1 px-2 text-xs font-semibold rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 cursor-pointer"
                  >
                    View Cluster
                  </button>
                </td>
              </tr>

              <tr className="bg-amber-50/30 dark:bg-amber-950/10">
                <td className="py-3 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    OP MANAGER
                  </span>
                </td>
                <td className="py-3 px-3 font-sans font-semibold text-stone-900 dark:text-stone-100">
                  Ranga
                </td>
                <td className="py-3 px-3 font-sans text-stone-600 dark:text-stone-400">
                  Panadura Head Office, Egoda Uyana, Kalutara, Mathugama
                </td>
                <td className="py-3 px-3 font-bold text-amber-700 dark:text-amber-400">
                  {analyticsData.rangaSummary.inTime ? formatSriLankaTime(analyticsData.rangaSummary.inTime) : '—'}
                </td>
                <td className="py-3 px-3 text-stone-700 dark:text-stone-300">
                  {analyticsData.rangaSummary.submittedAt ? formatSriLankaTime(analyticsData.rangaSummary.submittedAt) : 'In progress'}
                </td>
                <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                  {analyticsData.rangaOmRate}% (34 OM Duties)
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    analyticsData.rangaSummary.isSubmitted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}>
                    {analyticsData.rangaSummary.isSubmitted ? 'Submitted' : 'Live'}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-sans">
                  <button
                    type="button"
                    onClick={() => setSummaryViewMode('OPERATION_MANAGERS')}
                    className="py-1 px-2 text-xs font-semibold rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 cursor-pointer"
                  >
                    View Cluster
                  </button>
                </td>
              </tr>

              {/* 7 Branch Managers Rows */}
              {analyticsData.rankedBranches.map((item) => {
                const sub = item.todaySubmission;
                return (
                  <tr key={item.branch.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300">
                        BRANCH MGR
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans font-semibold text-stone-900 dark:text-stone-100">
                      {item.branch.managerName}
                    </td>
                    <td className="py-3 px-3 font-sans text-stone-700 dark:text-stone-300">
                      {item.branch.name} ({item.branch.code})
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-700 dark:text-amber-400">
                      {sub?.inTime ? formatSriLankaTime(sub.inTime) : '—'}
                    </td>
                    <td className="py-3 px-3 text-stone-700 dark:text-stone-300">
                      {sub?.submittedAt ? formatSriLankaTime(sub.submittedAt) : 'In progress'}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                      {item.complianceRate}% ({sub?.completedTasksCount || 0}/68)
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        sub?.isLocked
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                      }`}>
                        {sub?.isLocked ? 'Locked ✓' : 'Live'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => onSelectBranch(item.branch.id)}
                        className="py-1 px-2 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs"
                      >
                        Inspect Store
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
