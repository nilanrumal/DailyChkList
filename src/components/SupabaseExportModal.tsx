import React, { useState } from 'react';
import { X, Copy, Check, Database, Terminal, Cloud } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../services/supabaseSchema';

interface SupabaseExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseExportModal: React.FC<SupabaseExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900/50">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="font-display font-semibold text-stone-900 dark:text-stone-100 text-base sm:text-lg">
                Supabase & Cloudflare Production Blueprint
              </h3>
              <p className="text-xs text-stone-500">
                Ready-to-run PostgreSQL schema, foreign keys & RLS security rules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Quick info note */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs space-y-1">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300 block">
              Machan, Supabase SQL Editor ekata meka Copy karala Run karanna:
            </span>
            <p className="text-stone-600 dark:text-stone-400">
              Tables created: <code className="font-mono text-emerald-700">branches</code>,{' '}
              <code className="font-mono text-emerald-700">users</code>,{' '}
              <code className="font-mono text-emerald-700">duties</code> (all 68 checklist duties),{' '}
              <code className="font-mono text-emerald-700">daily_submissions</code>,{' '}
              <code className="font-mono text-emerald-700">task_records</code>, and{' '}
              <code className="font-mono text-emerald-700">task_proofs</code> (photo & GPS records).
            </p>
          </div>

          {/* Code Viewer */}
          <div className="relative rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800 text-stone-400 text-xs">
              <span className="font-mono">rathna_super_supabase_schema.sql</span>
              <button
                onClick={handleCopy}
                className="py-1 px-2.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="p-4 text-stone-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 text-xs font-medium bg-stone-900 hover:bg-stone-800 dark:bg-stone-800 dark:hover:bg-stone-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
