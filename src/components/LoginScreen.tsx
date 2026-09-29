import React, { useState, useEffect, useRef } from 'react';
import { Lock, User as UserIcon, ArrowRight, Sun, Moon } from 'lucide-react';
import { User } from '../types';
import { RathnaSuperLogo } from './RathnaSuperLogo';

interface LoginScreenProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSetTheme?: (theme: 'light' | 'dark') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  onLoginSuccess,
  theme,
  onToggleTheme,
  onSetTheme,
}) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const transitionTimerRef = useRef<any>(null);

  const handleSelectTheme = (targetTheme: 'light' | 'dark') => {
    if (theme === targetTheme) return;

    // Apply the 20-second smooth CSS transition class
    document.documentElement.classList.add('theme-fading-20s');
    if (document.body) {
      document.body.classList.add('theme-fading-20s');
    }

    if (transitionTimerRef.current) {
      clearTimeout(transitionTimerRef.current);
    }

    // Set a timer to remove the 20-second transition class after exactly 20s
    transitionTimerRef.current = setTimeout(() => {
      document.documentElement.classList.remove('theme-fading-20s');
      if (document.body) {
        document.body.classList.remove('theme-fading-20s');
      }
    }, 20000);

    // Switch theme
    if (onSetTheme) {
      onSetTheme(targetTheme);
    } else {
      onToggleTheme();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      document.documentElement.classList.remove('theme-fading-20s');
      if (document.body) {
        document.body.classList.remove('theme-fading-20s');
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!cleanUsername) {
      setErrorMessage('Please enter your username');
      return;
    }

    if (!cleanPin) {
      setErrorMessage('Please enter your PIN');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find matching user by username, id, or assigned branch code aliases
      const matchedUser = users.find((u) => {
        const uName = u.username.toLowerCase();
        const uId = u.id.toLowerCase();
        const bId = u.assignedBranchId?.toLowerCase() || '';

        if (uName === cleanUsername || uId === cleanUsername || bId === cleanUsername) {
          return true;
        }

        // Branch aliases for fast access
        if (cleanUsername === 'pms' && (uName === 'pms' || bId === 'panadura_market')) return true;
        if (cleanUsername === 'milla' && (uName === 'milla' || bId === 'millagashandiya')) return true;
        if (cleanUsername === 'alu' && (uName === 'alu' || bId === 'alubomulla')) return true;
        if (cleanUsername === 'pho' && (uName === 'pho' || bId === 'panadura_ho')) return true;
        if (cleanUsername === 'egoda' && (uName === 'egoda' || bId === 'egoda_uyana')) return true;
        if (cleanUsername === 'kalu' && (uName === 'kalu' || bId === 'kalutara')) return true;
        if (cleanUsername === 'mathu' && (uName === 'mathu' || bId === 'mathugama')) return true;

        return false;
      });

      if (!matchedUser) {
        setErrorMessage('Invalid username or PIN. Please try again.');
        setIsLoading(false);
        return;
      }

      if (matchedUser.pin !== cleanPin) {
        setErrorMessage('Invalid username or PIN. Please try again.');
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLoginSuccess(matchedUser);
    }, 250);
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden flex flex-col justify-between items-center p-4 bg-stone-100 dark:bg-stone-950 transition-colors duration-[20000ms] ease-in-out select-none">
      {/* Normal Professional Ambient Lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-20 transition-opacity duration-[20000ms] ease-in-out">
        <div className="absolute -top-[25%] -left-[10%] w-[650px] h-[650px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[650px] h-[650px] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      {/* Top spacer */}
      <div className="w-full h-8 shrink-0 pointer-events-none" />

      {/* Clean & Professional Theme Switcher (Dark & Light) */}
      <aside
        aria-label="Theme Switcher"
        className="fixed top-5 right-5 sm:top-6 sm:right-8 z-30 pointer-events-auto"
      >
        <div className="inline-flex items-center p-1 rounded-xl bg-stone-200/70 dark:bg-stone-800/80 border border-stone-300/70 dark:border-stone-700/70 backdrop-blur-md shadow-sm transition-colors duration-[20000ms] ease-in-out">
          {/* Light Mode Button */}
          <button
            type="button"
            onClick={() => handleSelectTheme('light')}
            aria-pressed={theme === 'light'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-300 focus:outline-none focus:ring-0 select-none ${
              theme === 'light'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>

          {/* Dark Mode Button */}
          <button
            type="button"
            onClick={() => handleSelectTheme('dark')}
            aria-pressed={theme === 'dark'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-300 focus:outline-none focus:ring-0 select-none ${
              theme === 'dark'
                ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-700'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
        </div>
      </aside>

      {/* Central Login Card */}
      <main className="w-full max-w-md relative z-10 my-auto shrink-0 px-2 sm:px-0">
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200/80 dark:border-stone-800 p-7 sm:p-9 transition-colors duration-[20000ms] ease-in-out">
          {/* Logo & Header - cleanly displayed with zero surrounding border box or highlight */}
          <div className="text-center mb-6 flex flex-col items-center">
            <RathnaSuperLogo size="lg" className="mb-3.5" showUploadOption={true} />
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 transition-colors duration-[20000ms] ease-in-out">
              Operations & Checklist System
            </h1>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 transition-colors duration-[20000ms] ease-in-out">
              Rathna Supermarket Operations Management
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 transition-colors duration-[20000ms] ease-in-out"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder=""
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-stone-50 dark:bg-stone-950/80 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors duration-[20000ms] ease-in-out"
                />
              </div>
            </div>

            {/* PIN Input */}
            <div>
              <label
                htmlFor="pin"
                className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 transition-colors duration-[20000ms] ease-in-out"
              >
                Enter Your PIN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="pin"
                  type="password"
                  maxLength={10}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  autoComplete="current-password"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tracking-widest bg-stone-50 dark:bg-stone-950/80 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder-transparent focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors duration-[20000ms] ease-in-out text-center sm:text-left"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage ? (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 text-center animate-in fade-in duration-150">
                {errorMessage}
              </div>
            ) : null}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60 active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Required Dynamic Footer */}
      <footer className="w-full text-center py-3 shrink-0 z-10 text-xs text-stone-500 dark:text-stone-400 transition-colors duration-[20000ms] ease-in-out">
        <p>
          © {currentYear} · System built, hosted and maintained by{' '}
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
    </div>
  );
};
