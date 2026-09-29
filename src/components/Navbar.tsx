import React from 'react';
import { Bell, LogOut, Database, Sun, Moon } from 'lucide-react';
import { User } from '../types';
import { RathnaSuperLogo } from './RathnaSuperLogo';

interface NavbarProps {
  user: User;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenSupabaseModal: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  theme,
  onToggleTheme,
  onLogout,
  unreadCount,
  onOpenNotifications,
  onOpenSupabaseModal,
  activeTab,
  onSelectTab,
}) => {
  // Navigation tabs based on user role
  const getNavLinks = () => {
    if (user.role === 'CEO') {
      return [
        { id: 'ceo_overview', label: 'Dual Executive Overview' },
        { id: 'ceo_bm_summary', label: 'Branch Managers Summary' },
        { id: 'ceo_om_summary', label: 'Operational Managers Summary' },
        { id: 'monthly_matrix', label: '1-31 Month Audit' },
        { id: 'all_branches', label: 'Branch Feeds' },
      ];
    } else if (user.role === 'OPERATION_MANAGER') {
      return [
        { id: 'om_dashboard', label: 'My Branches & Audit' },
        { id: 'branch_checklist', label: 'OM Daily Checklist' },
        { id: 'monthly_matrix', label: '1-31 Audit Matrix' },
        { id: 'om_exceptions', label: 'Issues & Proofs' },
      ];
    } else {
      return [
        { id: 'branch_checklist', label: 'Daily Checklist' },
        { id: 'branch_history', label: 'Past Submissions' },
      ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title with Uploaded Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <RathnaSuperLogo size="sm" className="!w-9 !h-9 p-0.5 rounded-lg" />
          <button
            onClick={() => onSelectTab(navLinks[0]?.id || 'dashboard')}
            className="text-left group cursor-pointer"
          >
            <span className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100 block">
              Rathna Super
            </span>
          </button>
        </div>

        {/* Zone 2: Clean Nav links with subtle underlines */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                onClick={() => onSelectTab(link.id)}
                className={`transition-colors relative py-1 text-sm whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1-2 primary actions & User controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Supabase Schema Helper */}
          <button
            onClick={onOpenSupabaseModal}
            title="View Supabase / PostgreSQL Schema"
            className="p-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Clean standard Theme Toggle in Navbar */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-stone-700" />
            )}
          </button>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            title="Operational Alerts"
            className="relative p-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white dark:ring-stone-900" />
            )}
          </button>

          {/* User info separator */}
          <div className="h-5 w-px bg-stone-200 dark:bg-stone-800 mx-1 hidden sm:block" />

          {/* User badge */}
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 leading-tight truncate max-w-[140px]">
              {user.name}
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 capitalize">
              {user.role === 'OPERATION_MANAGER'
                ? 'Operation Manager'
                : user.role === 'CEO'
                ? 'Chief Executive Officer (CEO)'
                : 'Branch Manager'}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Log Out"
            className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
        {navLinks.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <button
              key={link.id}
              onClick={() => onSelectTab(link.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-amber-600 text-white'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
            >
              {link.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
