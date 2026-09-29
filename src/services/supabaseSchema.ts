export const SUPABASE_SQL_SCHEMA = `-- Rathna Supermarket Operations & Daily Checklist System
-- Supabase / PostgreSQL Schema & RLS Setup

-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  operation_manager_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  open_time TEXT DEFAULT '07:30 AM',
  close_time TEXT DEFAULT '09:30 PM',
  phone TEXT,
  manager_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL, -- 4-digit PIN bcrypt hashed
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CEO', 'OPERATION_MANAGER', 'BRANCH_MANAGER')),
  assigned_branch_id TEXT REFERENCES public.branches(id),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Duty Checklist Master Items (68 Items)
CREATE TABLE IF NOT EXISTS public.duties (
  id INT PRIMARY KEY,
  duty_number INT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  is_critical BOOLEAN DEFAULT FALSE,
  requires_temp BOOLEAN DEFAULT FALSE,
  requires_numeric BOOLEAN DEFAULT FALSE,
  numeric_unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Daily Submissions Table
CREATE TABLE IF NOT EXISTS public.daily_submissions (
  id TEXT PRIMARY KEY, -- e.g. 'mathugama_2026-09-28'
  branch_id TEXT NOT NULL REFERENCES public.branches(id),
  submission_date DATE NOT NULL,
  submitted_by TEXT,
  completion_percentage INT DEFAULT 0,
  is_locked BOOLEAN DEFAULT FALSE,
  reviewed_by_om_id TEXT,
  om_score INT,
  om_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, submission_date)
);

-- 5. Create Task Records Table
CREATE TABLE IF NOT EXISTS public.task_records (
  id BIGSERIAL PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES public.daily_submissions(id) ON DELETE CASCADE,
  duty_id INT NOT NULL REFERENCES public.duties(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'UNABLE_TO_COMPLETE', 'DELAYED')),
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  numeric_value DOUBLE PRECISION,
  notes TEXT,
  -- Internal Operation Manager Review (Restricted from Branch Managers)
  om_audit_status TEXT DEFAULT 'PENDING_REVIEW' CHECK (om_audit_status IN ('VERIFIED', 'FLAGGED', 'PENDING_REVIEW')),
  om_audit_notes TEXT,
  om_audited_by TEXT,
  om_audited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, duty_id)
);

-- 6. Create Task Proofs Table (Photo & GPS Location for Exceptions)
CREATE TABLE IF NOT EXISTS public.task_proofs (
  id BIGSERIAL PRIMARY KEY,
  task_record_id BIGINT NOT NULL REFERENCES public.task_records(id) ON DELETE CASCADE,
  image_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT NOT NULL,
  additional_notes TEXT
);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_proofs ENABLE ROW LEVEL SECURITY;

-- 8. RLS Rule: Branch Managers can only read and write their own branch tasks
-- And branch managers CANNOT read OM internal audit columns!
CREATE VIEW public.branch_manager_tasks AS
SELECT 
  id, submission_id, duty_id, status, completed_at, completed_by, numeric_value, notes
FROM public.task_records;

-- Indexes for lightning fast queries
CREATE INDEX idx_submission_branch_date ON public.daily_submissions(branch_id, submission_date);
CREATE INDEX idx_task_records_submission ON public.task_records(submission_id);
`;
