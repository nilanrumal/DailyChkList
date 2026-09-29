import React, { useState, useEffect } from 'react';
import { BRANCHES } from './data/initialData';
import { Branch, DailyBranchSubmission, NotificationItem, User } from './types';
import {
  getCurrentUser,
  getOrCreateBranchSubmission,
  getSavedTheme,
  getTodayDateString,
  loadNotifications,
  loadSubmissions,
  loadUsers,
  setCurrentUser,
  setSavedTheme,
  seedSampleAnalyticsData,
  resetAllToBlank,
} from './services/storage';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { BranchChecklistView } from './components/BranchChecklistView';
import { OperationManagerDashboard } from './components/OperationManagerDashboard';
import { CeoExecutiveDashboard } from './components/CeoExecutiveDashboard';
import { MonthlyAuditMatrix } from './components/MonthlyAuditMatrix';
import { NotificationDrawer } from './components/NotificationDrawer';
import { SupabaseExportModal } from './components/SupabaseExportModal';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getSavedTheme);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString);
  const [submissions, setSubmissions] = useState<Record<string, DailyBranchSubmission>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Modals
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Initialize data on mount
  useEffect(() => {
    // Set theme in DOM
    setSavedTheme(theme);

    const loadedUsers = loadUsers();
    setUsers(loadedUsers);

    const loadedSubs = loadSubmissions();
    setSubmissions(loadedSubs);

    const loadedNotifs = loadNotifications();
    setNotifications(loadedNotifs);

    const savedUser = getCurrentUser();
    if (savedUser) {
      setCurrentUserState(savedUser);
      setDefaultTabForUser(savedUser);
    }
  }, []);

  const setDefaultTabForUser = (user: User) => {
    if (user.role === 'CEO') {
      setActiveTab('ceo_overview');
      setSelectedBranchId(BRANCHES[0].id);
    } else if (user.role === 'OPERATION_MANAGER') {
      setActiveTab('om_dashboard');
      if (user.assignedBranchIds && user.assignedBranchIds.length > 0) {
        setSelectedBranchId(user.assignedBranchIds[0]);
      }
    } else {
      setActiveTab('branch_checklist');
      if (user.assignedBranchId) {
        setSelectedBranchId(user.assignedBranchId);
      }
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUserState(user);
    setCurrentUser(user);
    setDefaultTabForUser(user);
  };

  const handleLogout = () => {
    setCurrentUserState(null);
    setCurrentUser(null);
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    setSavedTheme(nextTheme);
  };

  const handleSetTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    setSavedTheme(newTheme);
  };

  const handleRefreshSubmissions = () => {
    const reloaded = loadSubmissions();
    setSubmissions(reloaded);
  };

  const handleRefreshNotifications = () => {
    const reloaded = loadNotifications();
    setNotifications(reloaded);
  };

  const handleOpenChecklistForBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    setActiveTab('branch_checklist');
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  // If not logged in, render simple, modern centered login screen
  if (!currentUser) {
    return (
      <LoginScreen
        users={users}
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onSetTheme={handleSetTheme}
      />
    );
  }

  // Active branch resolution
  const activeBranch =
    BRANCHES.find((b) => b.id === selectedBranchId) ||
    BRANCHES.find((b) => b.id === currentUser.assignedBranchId) ||
    (currentUser.assignedBranchIds &&
      BRANCHES.find((b) => currentUser.assignedBranchIds?.includes(b.id))) ||
    BRANCHES[0];

  // Active submission for the selected branch and date
  const activeSubmission = getOrCreateBranchSubmission(
    activeBranch.id,
    selectedDate
  );

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-150">
      {/* 3-Zone Navigation Header */}
      <Navbar
        user={currentUser}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        unreadCount={unreadNotifCount}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {/* CEO Views */}
        {currentUser.role === 'CEO' && (
          <>
            {(activeTab === 'ceo_overview' ||
              activeTab === 'ceo_bm_summary' ||
              activeTab === 'ceo_om_summary' ||
              activeTab === 'ceo_missed_analysis') && (
              <CeoExecutiveDashboard
                submissions={submissions}
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
                initialViewMode={
                  activeTab === 'ceo_bm_summary'
                    ? 'BRANCH_MANAGERS'
                    : activeTab === 'ceo_om_summary'
                    ? 'OPERATION_MANAGERS'
                    : 'COMBINED'
                }
                onSelectBranch={(branchId) => {
                  setSelectedBranchId(branchId);
                  setActiveTab('all_branches');
                }}
                onSeedSampleData={() => {
                  const seeded = seedSampleAnalyticsData();
                  setSubmissions({ ...seeded });
                }}
                onResetAllToBlank={() => {
                  const blank = resetAllToBlank();
                  setSubmissions({ ...blank });
                }}
              />
            )}

            {activeTab === 'monthly_matrix' && (
              <MonthlyAuditMatrix
                branches={BRANCHES}
                submissions={submissions}
                userRole="CEO"
                currentBranchId={selectedBranchId || BRANCHES[0].id}
                onSelectBranchAndDate={(branchId, date) => {
                  setSelectedBranchId(branchId);
                  setSelectedDate(date);
                  setActiveTab('all_branches');
                }}
              />
            )}

            {activeTab === 'all_branches' && (
              <div className="space-y-4">
                {/* Branch Switcher for CEO */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-500">Inspecting Outlet:</span>
                    <select
                      value={activeBranch.id}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="py-1 px-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none"
                    >
                      {BRANCHES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) — OM: {b.operationManagerId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <BranchChecklistView
                  branch={activeBranch}
                  currentUser={currentUser}
                  submission={activeSubmission}
                  onRefreshSubmission={handleRefreshSubmissions}
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                />
              </div>
            )}
          </>
        )}

        {/* Operation Manager Views (Lasantha & Ranga) */}
        {currentUser.role === 'OPERATION_MANAGER' && (
          <>
            {activeTab === 'om_dashboard' && (
              <OperationManagerDashboard
                currentUser={currentUser}
                branches={BRANCHES}
                submissions={submissions}
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
                onRefreshSubmissions={handleRefreshSubmissions}
                onOpenChecklistForBranch={handleOpenChecklistForBranch}
              />
            )}

            {activeTab === 'monthly_matrix' && (
              <MonthlyAuditMatrix
                branches={BRANCHES.filter((b) =>
                  currentUser.assignedBranchIds?.includes(b.id)
                )}
                submissions={submissions}
                userRole="OPERATION_MANAGER"
                currentBranchId={selectedBranchId}
                onSelectBranchAndDate={(branchId, date) => {
                  setSelectedBranchId(branchId);
                  setSelectedDate(date);
                  setActiveTab('branch_checklist');
                }}
              />
            )}

            {activeTab === 'om_exceptions' && (
              <OperationManagerDashboard
                currentUser={currentUser}
                branches={BRANCHES}
                submissions={submissions}
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
                onRefreshSubmissions={handleRefreshSubmissions}
                onOpenChecklistForBranch={handleOpenChecklistForBranch}
              />
            )}

            {activeTab === 'branch_checklist' && (
              <div className="space-y-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-stone-500">Switch Assigned Outlet:</span>
                    <select
                      value={activeBranch.id}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="py-1 px-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg text-xs font-medium text-stone-900 dark:text-stone-100 focus:outline-none"
                    >
                      {BRANCHES.filter((b) =>
                        currentUser.assignedBranchIds?.includes(b.id)
                      ).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <BranchChecklistView
                  branch={activeBranch}
                  currentUser={currentUser}
                  submission={activeSubmission}
                  onRefreshSubmission={handleRefreshSubmissions}
                  selectedDate={selectedDate}
                  onChangeDate={setSelectedDate}
                />
              </div>
            )}
          </>
        )}

        {/* Branch Manager Views */}
        {currentUser.role === 'BRANCH_MANAGER' && (
          <>
            {activeTab === 'branch_checklist' && (
              <BranchChecklistView
                branch={activeBranch}
                currentUser={currentUser}
                submission={activeSubmission}
                onRefreshSubmission={handleRefreshSubmissions}
                selectedDate={selectedDate}
                onChangeDate={setSelectedDate}
              />
            )}

            {activeTab === 'branch_history' && (
              <MonthlyAuditMatrix
                branches={[activeBranch]}
                submissions={submissions}
                userRole="BRANCH_MANAGER"
                currentBranchId={activeBranch.id}
                onSelectBranchAndDate={(_, date) => {
                  setSelectedDate(date);
                  setActiveTab('branch_checklist');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Dynamic TeamCMS Footer */}
      <footer className="w-full border-t border-stone-200 dark:border-stone-800 py-4 text-center text-xs text-stone-500 dark:text-stone-400 bg-white/50 dark:bg-stone-900/50 backdrop-blur-sm">
        <p>
          © {new Date().getFullYear()} · System built, hosted and maintained by{' '}
          <a
            href="https://cmslk.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-700 dark:text-amber-400 hover:underline transition-colors"
          >
            TeamCMS
          </a>
        </p>
      </footer>

      {/* Slide-out Notifications Drawer */}
      <NotificationDrawer
        notifications={notifications}
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onRefresh={handleRefreshNotifications}
        onSelectBranch={(bId) => {
          setSelectedBranchId(bId);
          if (currentUser.role === 'BRANCH_MANAGER') {
            setActiveTab('branch_checklist');
          } else if (currentUser.role === 'OPERATION_MANAGER') {
            setActiveTab('om_dashboard');
          } else {
            setActiveTab('all_branches');
          }
        }}
      />

      {/* Supabase & Cloudflare Architecture Schema Modal */}
      <SupabaseExportModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
}
