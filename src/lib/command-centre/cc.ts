// Beyond Reason Command Centre — shared types, option lists, labels + badge tones.
// Owner/admin-only. Portal-side structure; no execution happens here.

export type CommandType = 'analyse' | 'report' | 'draft' | 'workflow' | 'approval_request' | 'terminal_task' | 'update_plan' | 'other';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type CommandStatus = 'queued' | 'claimed' | 'running' | 'completed' | 'failed' | 'needs_approval' | 'cancelled';
export type ExecTarget = 'mac_studio' | 'vercel' | 'manual' | 'external_api';
export type ExecMode = 'local_agent' | 'claude_code' | 'script' | 'api' | 'manual';
export type AgentStatus = 'active' | 'paused' | 'planned' | 'error';
export type AgentRisk = 'low' | 'medium' | 'high';
export type UpdateType = 'info' | 'warning' | 'success' | 'error' | 'recommendation';
export type ResultType = 'summary' | 'report' | 'task' | 'approval_request' | 'risk_alert' | 'draft' | 'file' | 'error' | 'terminal_output';
export type WorkerStatus = 'online' | 'offline' | 'busy' | 'error';
export type ApprovalType = 'supplier_payment' | 'balance_payment' | 'customer_message' | 'refund' | 'seo_change' | 'ad_budget' | 'stock_order' | 'partnership' | 'agent_action' | 'other';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'snoozed' | 'completed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'open' | 'acknowledged' | 'resolved' | 'dismissed';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type SourceModule = 'production' | 'customer_service' | 'seo' | 'marketing' | 'inventory' | 'finance' | 'partnerships' | 'command_centre' | 'other';

export type Tone = 'neutral' | 'good' | 'warn' | 'danger' | 'info' | 'honey';

// ---- Option lists for the command composer -----------------------------------
export const COMMAND_TYPE_OPTIONS: { value: CommandType; label: string }[] = [
  { value: 'analyse', label: 'Analyse' },
  { value: 'report', label: 'Report' },
  { value: 'draft', label: 'Draft' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'approval_request', label: 'Approval request' },
  { value: 'terminal_task', label: 'Terminal task' },
  { value: 'update_plan', label: 'Update plan' },
  { value: 'other', label: 'Other' },
];
export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
];
export const EXEC_TARGET_OPTIONS: { value: ExecTarget; label: string }[] = [
  { value: 'mac_studio', label: 'Mac Studio' }, { value: 'vercel', label: 'Vercel' },
  { value: 'manual', label: 'Manual' }, { value: 'external_api', label: 'External API' },
];
export const EXEC_MODE_OPTIONS: { value: ExecMode; label: string }[] = [
  { value: 'local_agent', label: 'Local agent' }, { value: 'claude_code', label: 'Claude Code' },
  { value: 'script', label: 'Script' }, { value: 'api', label: 'API' }, { value: 'manual', label: 'Manual' },
];

// ---- Labels ------------------------------------------------------------------
export const STATUS_LABEL: Record<CommandStatus, string> = {
  queued: 'QUEUED', claimed: 'CLAIMED', running: 'RUNNING', completed: 'COMPLETED',
  failed: 'FAILED', needs_approval: 'NEEDS APPROVAL', cancelled: 'CANCELLED',
};
export const MODULE_LABEL: Record<SourceModule, string> = {
  production: 'Production', customer_service: 'Customer Service', seo: 'SEO', marketing: 'Marketing',
  inventory: 'Inventory', finance: 'Finance', partnerships: 'Partnerships', command_centre: 'Command Centre', other: 'Other',
};
export const APPROVAL_TYPE_LABEL: Record<ApprovalType, string> = {
  supplier_payment: 'Supplier payment', balance_payment: 'Balance payment', customer_message: 'Customer message',
  refund: 'Refund', seo_change: 'SEO change', ad_budget: 'Ad budget', stock_order: 'Stock order',
  partnership: 'Partnership', agent_action: 'Agent action', other: 'Other',
};

// ---- Badge tones -------------------------------------------------------------
export const statusTone = (s: CommandStatus): Tone =>
  s === 'completed' ? 'good' : s === 'running' || s === 'claimed' ? 'info'
  : s === 'failed' ? 'danger' : s === 'needs_approval' ? 'warn'
  : s === 'cancelled' ? 'neutral' : 'honey'; // queued
export const priorityTone = (p: Priority): Tone =>
  p === 'urgent' ? 'danger' : p === 'high' ? 'warn' : p === 'medium' ? 'honey' : 'neutral';
export const riskTone = (r: RiskLevel): Tone =>
  r === 'critical' ? 'danger' : r === 'high' ? 'warn' : r === 'medium' ? 'honey' : 'neutral';
export const agentStatusTone = (s: AgentStatus): Tone =>
  s === 'active' ? 'good' : s === 'error' ? 'danger' : s === 'paused' ? 'warn' : 'neutral';
export const workerStatusTone = (s: WorkerStatus): Tone =>
  s === 'online' ? 'good' : s === 'busy' ? 'info' : s === 'error' ? 'danger' : 'neutral';

export const money = (v: number | null | undefined, ccy = 'AUD') =>
  v == null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: ccy }).format(Number(v));

// ---- Row types (mirror the DB tables) ----------------------------------------
export interface Agent {
  id: string; name: string; slug: string; business_area: string | null; description: string | null;
  status: AgentStatus; risk_level: AgentRisk; module_link: string | null; last_update_at: string | null;
  next_action: string | null; created_at: string; updated_at: string;
}
export interface AgentCommand {
  id: string; agent_id: string | null; created_by: string | null; title: string | null; prompt: string;
  command_type: CommandType; priority: Priority; status: CommandStatus; execution_target: ExecTarget;
  execution_mode: ExecMode; claimed_by_worker: string | null; claimed_at: string | null; started_at: string | null;
  completed_at: string | null; result_summary: string | null; error_message: string | null;
  created_at: string; updated_at: string;
}
export interface AgentUpdate {
  id: string; agent_id: string | null; title: string; summary: string | null; update_type: UpdateType;
  source_module: SourceModule | null; created_at: string;
}
export interface OwnerApproval {
  id: string; source_module: SourceModule; agent_id: string | null; command_id: string | null; title: string;
  description: string | null; approval_type: ApprovalType; priority: Priority; financial_impact: number | null;
  currency: string | null; status: ApprovalStatus; decision_note: string | null; created_at: string;
}
export interface OwnerRisk {
  id: string; source_module: SourceModule; agent_id: string | null; title: string; description: string | null;
  risk_level: RiskLevel; financial_impact: number | null; currency: string | null; status: RiskStatus; created_at: string;
}
export interface BusinessTask {
  id: string; source_module: SourceModule; agent_id: string | null; title: string; description: string | null;
  status: TaskStatus; priority: Priority; due_at: string | null; created_at: string;
}
export interface AgentWorker {
  id: string; worker_name: string; machine_name: string | null; worker_type: string; status: WorkerStatus;
  last_seen_at: string | null; current_command_id: string | null;
}
export interface FinancialSnapshot {
  id: string; snapshot_date: string; today_revenue: number; week_revenue: number; month_revenue: number;
  online_revenue: number; instore_revenue: number; outlet_revenue: number; refunds: number; net_sales: number;
  supplier_payments_due: number; balance_payments_due: number; unpaid_supplier_invoices: number;
  orders_blocked_by_payment: number; estimated_production_spend_month: number; paid_supplier_invoices_month: number; notes: string | null;
}
