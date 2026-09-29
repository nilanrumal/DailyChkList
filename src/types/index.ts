export type UserRole = 'CEO' | 'OPERATION_MANAGER' | 'BRANCH_MANAGER';

export interface User {
  id: string;
  username: string;
  pin: string; // 4-digit PIN
  name: string;
  role: UserRole;
  avatar?: string;
  assignedBranchIds?: string[]; // For Operation Managers & Branch Managers
  assignedBranchId?: string; // For Branch Manager
  phone?: string;
  email?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  operationManagerId: 'lasantha' | 'ranga';
  coordinates: {
    lat: number;
    lng: number;
  };
  openTime: string;
  closeTime: string;
  phone: string;
  managerName: string;
}

export type DutyCategory =
  | 'Opening & Cleaning'
  | 'Inventory & Shelves'
  | 'Finance & Cashier'
  | 'Audits & Compliance'
  | 'Stores & Logistics'
  | 'Staff & Meals'
  | 'Quality, Temp & Maintenance'
  | 'Closing & Reports';

export interface DutyItem {
  id: number;
  dutyNumber: number;
  title: string;
  category: DutyCategory;
  isCritical?: boolean;
  requiresTemp?: boolean;
  requiresNumeric?: boolean;
  numericUnit?: string;
  description?: string;
  targetRole?: 'OPERATION_MANAGER' | 'BRANCH_MANAGER';
}

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'UNABLE_TO_COMPLETE' | 'DELAYED';

export interface ProofData {
  imageUrl?: string;
  imageFileName?: string;
  capturedAt: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    addressDescription?: string;
  };
  reason: string;
  additionalNotes?: string;
}

export interface TaskRecord {
  dutyId: number;
  dutyNumber: number;
  dutyTitle: string;
  category: DutyCategory;
  status: TaskStatus;
  completedAt?: string;
  completedBy?: string;
  proof?: ProofData;
  numericValue?: number;
  notes?: string;
  // Internal Operation Manager / CEO Audit fields (hidden from branch managers)
  omAuditStatus?: 'VERIFIED' | 'FLAGGED' | 'PENDING_REVIEW';
  omAuditNotes?: string;
  omAuditedAt?: string;
  omAuditedBy?: string;
}

export interface DailyBranchSubmission {
  id: string;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  inTime?: string; // Sri Lanka Internet Time when manager commenced duties
  inTimeRecordedBy?: string;
  submittedAt?: string;
  submittedBy: string;
  completionPercentage: number;
  tasks: Record<number, TaskRecord>; // keyed by dutyId
  isLocked: boolean;
  totalTasks: number;
  completedTasksCount: number;
  issueTasksCount: number;
  // Operation Manager review
  reviewedByOmId?: string;
  reviewedAt?: string;
  omScore?: number; // 0-100 rating
  omRemarks?: string;
}

export interface OperationalManagerDailySummary {
  id: string; // e.g. lasantha_2026-09-29
  omId: 'lasantha' | 'ranga';
  omName: string;
  date: string;
  inTime?: string; // Sri Lanka Internet Time when OM commenced field duties
  submittedAt?: string;
  isSubmitted: boolean;
  assignedBranchIds: string[];
  totalOmDuties: number;
  completedOmDuties: number;
  flaggedOmIssues: number;
  omComplianceRate: number;
  verifiedBranchTasksCount: number;
  flaggedBranchTasksCount: number;
  clusterScore: number;
  executiveNotes?: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  type: 'ALERT' | 'INFO' | 'WARNING' | 'SUCCESS';
  title: string;
  message: string;
  branchId?: string;
  branchName?: string;
  isRead: boolean;
  targetRole?: UserRole[];
}
