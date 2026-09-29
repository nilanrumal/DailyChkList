import React, { useState, useRef } from 'react';
import { Calendar, Download, Printer, Check, RotateCcw, Sparkles, Clock, Eye, X } from 'lucide-react';
import { DUTY_ITEMS, OPERATION_MANAGER_DUTIES, BRANCH_MANAGER_DUTIES } from '../data/initialData';
import { Branch, DailyBranchSubmission, DutyItem, TaskRecord } from '../types';
import { updateBranchTask } from '../services/storage';
import { playAlertTone } from '../services/notifications';
import { formatSriLankaTime } from '../services/networkTime';

interface MonthlyAuditMatrixProps {
  branches: Branch[];
  submissions: Record<string, DailyBranchSubmission>;
  userRole: 'CEO' | 'OPERATION_MANAGER' | 'BRANCH_MANAGER';
  currentBranchId?: string;
  onRefreshSubmissions?: () => void;
  onSelectBranchAndDate?: (branchId: string, date: string) => void;
}

export const MonthlyAuditMatrix: React.FC<MonthlyAuditMatrixProps> = ({
  branches,
  submissions,
  userRole,
  currentBranchId,
  onRefreshSubmissions,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranchId || branches[0]?.id || 'panadura_market'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [checklistType, setChecklistType] = useState<'OPERATION_MANAGER' | 'BRANCH_MANAGER'>(
    userRole === 'OPERATION_MANAGER' || userRole === 'CEO' ? 'OPERATION_MANAGER' : 'BRANCH_MANAGER'
  );
  const [dutyRange, setDutyRange] = useState<'PART_1' | 'PART_2' | 'ALL'>('ALL');
  const [selectedDayForBatch, setSelectedDayForBatch] = useState<number | null>(null);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(true);
  const [inspectedCell, setInspectedCell] = useState<{
    duty: DutyItem;
    day: number;
    dateStr: string;
    task?: TaskRecord;
    submission?: DailyBranchSubmission;
  } | null>(null);

  // Click timer to cleanly separate Single Click (Select/Done) vs Double Click (Cross/Issue)
  const clickTimerRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  // Days in month calculation (1..30 or 1..31)
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  // We show duties based on active checklist (Operation Manager 34 or Branch Manager 68)
  const displayDuties: DutyItem[] =
    checklistType === 'OPERATION_MANAGER'
      ? OPERATION_MANAGER_DUTIES
      : dutyRange === 'PART_1'
      ? BRANCH_MANAGER_DUTIES.slice(0, 34)
      : dutyRange === 'PART_2'
      ? BRANCH_MANAGER_DUTIES.slice(34, 68)
      : BRANCH_MANAGER_DUTIES;

  const handleExportCSV = () => {
    let csv = `Rathna Supermarket Audit Sheet - ${activeBranch.name} (${selectedMonth})\n`;
    csv += `Duty Number,Duty Title,Category,${daysArray.map((d) => `Day ${d}`).join(',')}\n`;

    displayDuties.forEach((duty: DutyItem) => {
      const rowVals = daysArray.map((day) => {
        const dayFormatted = day < 10 ? `0${day}` : `${day}`;
        const dateStr = `${selectedMonth}-${dayFormatted}`;
        const submissionKey = `${selectedBranchId}_${dateStr}`;
        const sub = submissions[submissionKey];
        const task = sub?.tasks?.[duty.id];
        if (task?.status === 'COMPLETED') {
          return task.completedAt ? `"DONE (${formatSriLankaTime(task.completedAt)})"` : 'DONE';
        }
        if (task?.status === 'UNABLE_TO_COMPLETE') {
          return task.completedAt ? `"ISSUE (${formatSriLankaTime(task.completedAt)})"` : 'ISSUE';
        }
        return 'BLANK';
      });

      csv += `"${duty.dutyNumber}","${duty.title.replace(/"/g, '""')}","${duty.category}",${rowVals.join(',')}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rathna_Super_Audit_${activeBranch.name.replace(/\s+/g, '_')}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Single click: Select / Completed (✓). If already completed, toggle to Blank (·)
  const handleCellSingleClick = (dutyId: number, day: number) => {
    const dayFormatted = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${selectedMonth}-${dayFormatted}`;
    const submissionKey = `${selectedBranchId}_${dateStr}`;
    const sub = submissions[submissionKey];
    const task = sub?.tasks?.[dutyId];
    const currentStatus = task?.status || 'PENDING';

    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';

    if (nextStatus === 'COMPLETED') {
      playAlertTone('SUCCESS');
    }

    const slTime = new Date().toISOString();
    updateBranchTask(selectedBranchId, dateStr, dutyId, {
      status: nextStatus,
      completedAt: nextStatus === 'COMPLETED' ? slTime : undefined,
      completedBy: activeBranch.managerName,
    });
    onRefreshSubmissions?.();
  };

  // Double click: Mark Cross (✕ - Issue / UNABLE_TO_COMPLETE)
  // Restricted exclusively to Operational Managers and CEO
  const handleCellDoubleClick = (dutyId: number, day: number) => {
    const isAuthorized = userRole === 'OPERATION_MANAGER' || userRole === 'CEO';
    if (!isAuthorized) {
      playAlertTone('ALERT');
      setPermissionNotice('Notice: Marking an Issue / Cross (✕) is restricted to Operational Managers.');
      setTimeout(() => setPermissionNotice(null), 4000);
      return;
    }

    const dayFormatted = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${selectedMonth}-${dayFormatted}`;
    const submissionKey = `${selectedBranchId}_${dateStr}`;
    const sub = submissions[submissionKey];
    const task = sub?.tasks?.[dutyId];
    const currentStatus = task?.status || 'PENDING';

    const nextStatus = currentStatus === 'UNABLE_TO_COMPLETE' ? 'PENDING' : 'UNABLE_TO_COMPLETE';

    if (nextStatus === 'UNABLE_TO_COMPLETE') {
      playAlertTone('ALERT');
    }

    updateBranchTask(selectedBranchId, dateStr, dutyId, {
      status: nextStatus,
      completedAt: nextStatus === 'UNABLE_TO_COMPLETE' ? new Date().toISOString() : undefined,
      completedBy: activeBranch.managerName,
    });
    onRefreshSubmissions?.();
  };

  // Cell Click Orchestrator: Dispatches Single Click vs Double Click
  const onCellClick = (duty: DutyItem, day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const dutyId = duty.id;
    const cellKey = `${dutyId}_${day}`;
    const dayFormatted = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${selectedMonth}-${dayFormatted}`;
    const submissionKey = `${selectedBranchId}_${dateStr}`;
    const sub = submissions[submissionKey];
    const task = sub?.tasks?.[dutyId];

    // Always inspect this cell on click
    setInspectedCell({
      duty,
      day,
      dateStr,
      task,
      submission: sub,
    });

    if (clickTimerRef.current[cellKey]) {
      // Second click within 230ms: Trigger Double-Click (Cross)
      clearTimeout(clickTimerRef.current[cellKey]);
      delete clickTimerRef.current[cellKey];
      handleCellDoubleClick(dutyId, day);
    } else {
      // First click: Schedule Single-Click (Check)
      clickTimerRef.current[cellKey] = setTimeout(() => {
        delete clickTimerRef.current[cellKey];
        handleCellSingleClick(dutyId, day);
      }, 230);
    }
  };

  const onCellDoubleClick = (duty: DutyItem, day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const dutyId = duty.id;
    const cellKey = `${dutyId}_${day}`;
    if (clickTimerRef.current[cellKey]) {
      clearTimeout(clickTimerRef.current[cellKey]);
      delete clickTimerRef.current[cellKey];
    }
    handleCellDoubleClick(dutyId, day);
  };

  // Batch action: Mark entire day as completed
  const handleBatchMarkDay = (day: number, status: 'COMPLETED' | 'PENDING') => {
    const dayFormatted = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${selectedMonth}-${dayFormatted}`;

    displayDuties.forEach((duty: DutyItem) => {
      updateBranchTask(selectedBranchId, dateStr, duty.id, {
        status,
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined,
      });
    });

    playAlertTone(status === 'COMPLETED' ? 'SUCCESS' : 'INFO');
    setSelectedDayForBatch(null);
    onRefreshSubmissions?.();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Permission Banner if non-OM tries to double click */}
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

      {/* Header Controls */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
              <span>Rathna Super Internal Audit System</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-medium">Monthly 1-31 Matrix</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2.5">
              <span>{checklistType === 'OPERATION_MANAGER' ? 'Operation Managers Check List' : 'Daily Outlet Managers Check List'}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-sans font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {checklistType === 'OPERATION_MANAGER' ? '34 OM Duties' : '68 Branch Duties'}
              </span>
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Location :- Rathna Super <strong className="text-stone-700 dark:text-stone-200">{activeBranch.name.toUpperCase()}</strong> · Month :- <strong className="text-stone-700 dark:text-stone-200">{selectedMonth}</strong>
            </p>
          </div>

          {/* Quick branch & month picker */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Checklist Mode Switcher */}
            <div className="flex items-center bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl border border-stone-200 dark:border-stone-700">
              <button
                type="button"
                onClick={() => setChecklistType('OPERATION_MANAGER')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  checklistType === 'OPERATION_MANAGER'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Operation Managers 34 Audit Checklist (Matches Google Sheet)"
              >
                Operation Managers (34)
              </button>
              <button
                type="button"
                onClick={() => setChecklistType('BRANCH_MANAGER')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  checklistType === 'BRANCH_MANAGER'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
                title="Branch Managers 68 Operational Checklist"
              >
                Branch Managers (68)
              </button>
            </div>

            {/* Branch selector */}
            <div className="flex items-center bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs text-stone-400 mr-2 font-medium">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="text-xs font-semibold bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="dark:bg-stone-900 text-stone-900 dark:text-stone-100">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Month selector */}
            <div className="flex items-center bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-3 py-1.5 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-stone-400 mr-2" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold bg-transparent text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
              />
            </div>

            {/* Duties range selector - Only shown for Branch Manager list (68 items) */}
            {checklistType === 'BRANCH_MANAGER' && (
              <div className="flex items-center bg-stone-100 dark:bg-stone-800/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDutyRange('PART_1')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    dutyRange === 'PART_1'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  title="Duties 1 - 34"
                >
                  Part 1 (1-34)
                </button>
                <button
                  type="button"
                  onClick={() => setDutyRange('PART_2')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    dutyRange === 'PART_2'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  title="Duties 35 - 68"
                >
                  Part 2 (35-68)
                </button>
                <button
                  type="button"
                  onClick={() => setDutyRange('ALL')}
                  className={`py-1 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    dutyRange === 'ALL'
                      ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                  title="All 68 Duties"
                >
                  All (1-68)
                </button>
              </div>
            )}

            {/* Actions: Export, Print, and Toggle Timestamps */}
            <button
              type="button"
              onClick={() => setShowTimestamps(!showTimestamps)}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                showTimestamps
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
              }`}
              title="Toggle display of exact recorded Sri Lanka Standard Time (Asia/Colombo UTC+05:30) on marked cells"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{showTimestamps ? 'Timestamps: ON' : 'Show Timestamps (SLST)'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        </div>

        {/* Branch Context Info Bar & Interactive Tip */}
        <div className="pt-4 flex flex-wrap items-center justify-between text-xs text-stone-600 dark:text-stone-400 gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-stone-400">Location: </span>
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                {activeBranch?.name}
              </span>
            </div>
            <div>
              <span className="text-stone-400">Assigned OM: </span>
              <span className="font-semibold text-stone-800 dark:text-stone-200 capitalize">
                {activeBranch?.operationManagerId}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-emerald-200 dark:border-emerald-900/60">
              <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>
                <strong>Auto-Timestamp:</strong> Every marked task records exact Sri Lanka Time (SLST UTC+05:30)
              </span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-amber-200 dark:border-amber-900/60">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>
                <strong>Single Click:</strong> ✓ Done | <strong>Double Click:</strong> ✕ Issue
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-emerald-700 dark:text-emerald-400">✓ Completed (Done)</span>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="text-rose-700 dark:text-rose-400">✕ Issue / Missed</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-stone-300 dark:bg-stone-700 inline-block" />
              <span className="text-stone-500">· Pending</span>
            </span>
          </div>
        </div>

        {/* Day Column Quick-Fill Selector Popover */}
        {selectedDayForBatch && (
          <div className="mt-3 p-3 bg-amber-50 dark:bg-stone-950 border border-amber-300 dark:border-amber-900 rounded-xl flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              Quick Actions for Day {selectedDayForBatch} ({selectedMonth}-{selectedDayForBatch < 10 ? `0${selectedDayForBatch}` : selectedDayForBatch}):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchMarkDay(selectedDayForBatch, 'COMPLETED')}
                className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark All Done (✓)</span>
              </button>
              <button
                type="button"
                onClick={() => handleBatchMarkDay(selectedDayForBatch, 'PENDING')}
                className="py-1 px-3 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-800 dark:text-stone-200 font-medium rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Blank</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayForBatch(null)}
                className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs ml-2 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* The 1-31 Interactive Spreadsheet Matrix */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-stone-100 dark:bg-stone-950 text-stone-700 dark:text-stone-300 font-semibold border-b border-stone-200 dark:border-stone-800">
                <th className="py-2.5 px-3 w-10 text-center border-r border-stone-200 dark:border-stone-800">
                  NO
                </th>
                <th className="py-2.5 px-3 min-w-[240px] max-w-[320px] sticky left-0 bg-stone-100 dark:bg-stone-950 border-r border-stone-200 dark:border-stone-800 z-10 shadow-sm">
                  DUTY
                </th>
                {daysArray.map((day) => (
                  <th
                    key={day}
                    onClick={() => setSelectedDayForBatch(selectedDayForBatch === day ? null : day)}
                    className="py-2.5 px-1 min-w-[34px] text-center font-mono tabular-nums border-r border-stone-200 dark:border-stone-800 text-[11px] cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
                    title={`Click to mark or clear entire Day ${day}`}
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
              {displayDuties.map((duty: DutyItem) => (
                <tr
                  key={duty.id}
                  className="hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition-colors"
                >
                  <td className="py-2 px-2 text-center font-mono tabular-nums text-stone-500 border-r border-stone-100 dark:border-stone-800">
                    {duty.dutyNumber}
                  </td>
                  <td className="py-2 px-3 font-medium text-stone-800 dark:text-stone-200 truncate sticky left-0 bg-white dark:bg-stone-900 border-r border-stone-100 dark:border-stone-800 z-10">
                    <span className="font-semibold text-stone-900 dark:text-stone-100">{duty.title}</span>
                  </td>
                  {daysArray.map((day) => {
                    const dayFormatted = day < 10 ? `0${day}` : `${day}`;
                    const dateStr = `${selectedMonth}-${dayFormatted}`;
                    const submissionKey = `${selectedBranchId}_${dateStr}`;
                    const sub = submissions[submissionKey];
                    const task = sub?.tasks?.[duty.id];
                    const isCompleted = task?.status === 'COMPLETED';
                    const isIssue = task?.status === 'UNABLE_TO_COMPLETE';
                    const isInspected = inspectedCell?.duty.id === duty.id && inspectedCell?.day === day;

                    return (
                      <td
                        key={day}
                        onClick={(e) => onCellClick(duty, day, e)}
                        onDoubleClick={(e) => onCellDoubleClick(duty, day, e)}
                        className={`py-1.5 px-1 text-center border-r border-stone-100 dark:border-stone-800/80 cursor-pointer transition-all active:scale-95 ${
                          isInspected
                            ? 'ring-2 ring-amber-500 z-10 relative'
                            : ''
                        } ${
                          isCompleted
                            ? 'text-emerald-700 bg-emerald-100/50 dark:bg-emerald-950/40 font-bold hover:bg-emerald-200/60'
                            : isIssue
                            ? 'text-rose-700 bg-rose-100/60 dark:bg-rose-950/40 font-bold hover:bg-rose-200/60'
                            : 'text-stone-300 dark:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                        }`}
                        title={`Duty #${duty.dutyNumber}: ${duty.title}
Date: ${dateStr} (Day ${day})
Status: ${isCompleted ? '✓ COMPLETED (DONE)' : isIssue ? '✕ UNABLE / ISSUE' : 'PENDING / BLANK'}
${task?.completedAt ? `Recorded Time: ${formatSriLankaTime(task.completedAt)} (Sri Lanka Standard Time)\nRecorded By: ${task.completedBy || activeBranch.managerName}` : 'No timestamp recorded yet'}
${task?.numericValue !== undefined ? `Reading: ${task.numericValue} ${duty.numericUnit || '°C'}\n` : ''}${task?.notes ? `Remarks: ${task.notes}\n` : ''}${task?.proof?.reason ? `Issue Reason: ${task.proof.reason}\n` : ''}
• Click to inspect details & exact timestamp
• Single Click: Toggle Done (✓)
• Double Click: Toggle Issue (✕)`}
                      >
                        {showTimestamps && (isCompleted || isIssue) ? (
                          <div className="flex flex-col items-center justify-center py-0.5 leading-tight">
                            <span className="text-xs font-bold leading-none">{isCompleted ? '✓' : '✕'}</span>
                            <span className="text-[9px] font-mono font-semibold tracking-tight text-stone-700 dark:text-stone-300 mt-0.5 whitespace-nowrap block">
                              {task?.completedAt ? formatSriLankaTime(task.completedAt).replace(/:[0-9]{2} /, ' ') : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block w-full h-full text-sm leading-none font-bold">
                            {isCompleted ? '✓' : isIssue ? '✕' : '·'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Time & Record Inspector Drawer when any cell is clicked */}
      {inspectedCell && (
        <div className="p-5 bg-white dark:bg-stone-900 rounded-2xl border border-amber-300 dark:border-amber-900/60 shadow-lg space-y-3 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-xs ${
                  inspectedCell.task?.status === 'COMPLETED'
                    ? 'bg-emerald-600'
                    : inspectedCell.task?.status === 'UNABLE_TO_COMPLETE'
                    ? 'bg-rose-600'
                    : 'bg-stone-400'
                }`}
              >
                {inspectedCell.task?.status === 'COMPLETED' ? (
                  <Check className="w-5 h-5 stroke-[3]" />
                ) : inspectedCell.task?.status === 'UNABLE_TO_COMPLETE' ? (
                  <X className="w-5 h-5 stroke-[3]" />
                ) : (
                  '·'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono font-bold px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                    Duty #{inspectedCell.duty.dutyNumber}
                  </span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    Day {inspectedCell.day} ({inspectedCell.dateStr})
                  </span>
                  <span className="text-stone-300 dark:text-stone-700">·</span>
                  <span className="text-stone-500 font-medium">
                    Branch: {activeBranch.name} (Manager: {activeBranch.managerName})
                  </span>
                </div>
                <h3 className="font-display font-semibold text-base text-stone-900 dark:text-stone-100 mt-0.5">
                  {inspectedCell.duty.title}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setInspectedCell(null)}
              className="py-1 px-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 rounded-lg text-xs font-semibold cursor-pointer self-start sm:self-center"
            >
              Close Inspector
            </button>
          </div>

          {/* Time & Record Details Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. Recorded Sri Lanka Time */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 space-y-1">
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Task Recorded Time (SLST):</span>
              </span>
              <div className="font-mono font-bold text-sm text-stone-900 dark:text-stone-100">
                {inspectedCell.task?.completedAt ? (
                  formatSriLankaTime(inspectedCell.task.completedAt)
                ) : (
                  <span className="text-stone-400 font-normal italic">Not recorded yet</span>
                )}
              </div>
              <span className="text-[10px] text-stone-500 block">
                Sri Lanka Standard Time (Asia/Colombo UTC+05:30)
              </span>
            </div>

            {/* 2. Submitter / Marked By */}
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
              <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                Recorded By Officer:
              </span>
              <div className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                {inspectedCell.task?.completedBy || activeBranch.managerName}
              </div>
              <span className="text-[10px] text-stone-500 block">
                Branch Manager / In-Charge
              </span>
            </div>

            {/* 3. Daily In-Time & Submission status */}
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
              <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                Branch Duty In-Time:
              </span>
              <div className="font-mono font-semibold text-sm text-stone-900 dark:text-stone-100">
                {inspectedCell.submission?.inTime ? (
                  formatSriLankaTime(inspectedCell.submission.inTime)
                ) : (
                  <span className="text-stone-400 font-normal italic">—</span>
                )}
              </div>
              <span className="text-[10px] text-stone-500 block">
                {inspectedCell.submission?.isLocked
                  ? `Submitted at ${formatSriLankaTime(inspectedCell.submission.submittedAt)} (Locked)`
                  : 'In Progress'}
              </span>
            </div>

            {/* 4. Current Status */}
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 space-y-1">
              <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                Task Status:
              </span>
              <div
                className={`font-bold text-sm ${
                  inspectedCell.task?.status === 'COMPLETED'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : inspectedCell.task?.status === 'UNABLE_TO_COMPLETE'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-stone-500'
                }`}
              >
                {inspectedCell.task?.status === 'COMPLETED'
                  ? '✓ COMPLETED'
                  : inspectedCell.task?.status === 'UNABLE_TO_COMPLETE'
                  ? '✕ UNABLE TO COMPLETE'
                  : 'PENDING / BLANK'}
              </div>
              <span className="text-[10px] text-stone-500 block">
                Category: {inspectedCell.duty.category}
              </span>
            </div>
          </div>

          {/* Reading, Notes or Proof info if present */}
          {(inspectedCell.task?.numericValue !== undefined ||
            inspectedCell.task?.notes ||
            inspectedCell.task?.proof) && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 text-xs flex flex-wrap items-center gap-4">
              {inspectedCell.task.numericValue !== undefined && (
                <div>
                  <span className="text-stone-500 font-medium">Recorded Reading: </span>
                  <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                    {inspectedCell.task.numericValue} {inspectedCell.duty.numericUnit || '°C'}
                  </span>
                </div>
              )}
              {inspectedCell.task.notes && (
                <div>
                  <span className="text-stone-500 font-medium">Remark: </span>
                  <span className="text-stone-800 dark:text-stone-200 italic">
                    "{inspectedCell.task.notes}"
                  </span>
                </div>
              )}
              {inspectedCell.task.proof?.reason && (
                <div>
                  <span className="text-rose-600 font-medium">Issue Reason: </span>
                  <span className="text-rose-700 dark:text-rose-300 font-semibold">
                    {inspectedCell.task.proof.reason}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
