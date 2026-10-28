export type ID = string;
export type CaseStatus = "New" | "Working" | "Escalated" | "Waiting for Customer" | "Resolved" | "Closed";
export type Priority = "Critical" | "High" | "Medium" | "Low";
export type Category =
  | "Product Defect"
  | "Order Tracking"
  | "Shipping Delay"
  | "Warranty"
  | "Refund"
  | "Technical"
  | "General";
export type Origin = "Email" | "Phone" | "Web" | "Chat";
export type Role = "Administrator" | "Support Manager" | "Support Agent" | "Warranty Specialist" | "Approver";

export const CASE_STATUSES: CaseStatus[] = ["New", "Working", "Escalated", "Waiting for Customer", "Resolved", "Closed"];
export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];
export const CATEGORIES: Category[] = ["Product Defect", "Order Tracking", "Shipping Delay", "Warranty", "Refund", "Technical", "General"];
export const ORIGINS: Origin[] = ["Email", "Phone", "Web", "Chat"];
export const ROLES: Role[] = ["Administrator", "Support Manager", "Support Agent", "Warranty Specialist", "Approver"];

export interface Customer {
  id: ID; name: string; email: string; phone: string; country: string;
  type: "Individual" | "Business" | "VIP"; since: string; status: "Active" | "Inactive"; createdAt: string;
}
export interface Product {
  id: ID; name: string; sku: string; category: string; brand: string; price: number;
  warrantyMonths: number; stock: number; status: "Active" | "Discontinued";
}
export type ShippingStatus = "Confirmed" | "Processing" | "Shipped" | "In Transit" | "Delayed" | "Delivered" | "Cancelled";
export const SHIPPING_FLOW: ShippingStatus[] = ["Confirmed", "Processing", "Shipped", "In Transit", "Delivered"];
export interface Order {
  id: ID; customerId: ID; number: string; date: string; lines: { productId: ID; qty: number }[]; total: number;
  payment: "Paid" | "Pending" | "Refund Pending" | "Refunded"; shipping: ShippingStatus; tracking: string; eta: string;
  events: { at: string; status: string; note: string }[]; reminderSentAt?: string;
}
export interface CaseNote { id: ID; at: string; by: ID; text: string; kind: "internal" | "resolution" | "system" | "reply" }
export interface SupportCase {
  id: ID; number: string; subject: string; description: string; customerId: ID; orderId?: ID; productId?: ID;
  origin: Origin; category: Category; priority: Priority; status: CaseStatus; queueId?: ID; agentId?: ID;
  createdAt: string; updatedAt: string; firstResponseAt?: string; resolvedAt?: string; slaDeadline: string;
  escalated: boolean; urgent?: boolean; aiSummary?: string; aiResponse?: string; resolutionNotes?: string;
  rating?: number; followUpAt?: string; followUpDone?: boolean; slaNotified?: boolean; notes: CaseNote[];
}
export type WarrantyStatus = "Eligible" | "Ineligible" | "Requires Review" | "Pending Check";
export interface WarrantyClaim {
  id: ID; number: string; customerId: ID; productId: ID; orderId: ID; purchaseDate: string; claimDate: string;
  reason: string; warrantyStatus: WarrantyStatus; eligibilityReason?: string;
  approvalStatus: "Not Submitted" | "Pending" | "Approved" | "Rejected"; decisionNotes?: string; queueId?: ID;
}
export interface Article { id: ID; title: string; category: string; keywords: string[]; content: string; published: boolean; updatedAt: string }
export type ApprovalType = "Refund" | "Cancellation" | "Warranty Replacement";
export interface Approval {
  id: ID; caseId?: ID; claimId?: ID; type: ApprovalType; reason: string; requestedBy: ID; approverId: ID;
  status: "Pending" | "Approved" | "Rejected"; comments?: string; createdAt: string; decidedAt?: string; decidedBy?: ID;
}
export interface AutomationLog {
  id: ID; automation: string; recordId?: ID; trigger: string; status: "Success" | "Skipped" | "Failed"; at: string; details: string; error?: string;
}
export interface AuditEntry {
  id: ID; at: string; action: string; recordType: string; recordId?: ID; userId: ID; outcome: "Success" | "Denied" | "Failed"; details: string;
}
export interface User { id: ID; name: string; email: string; role: Role; active: boolean; title: string }
export interface Queue { id: ID; name: string; description: string; members: ID[]; rule: string }
export type TemplateKind = "summary" | "response" | "warranty" | "escalation" | "custom";
export interface PromptTemplate { id: ID; name: string; recordType: "Case" | "Warranty Claim"; body: string; active: boolean; kind: TemplateKind }
export interface Notification { id: ID; at: string; title: string; body: string; read: boolean; level: "info" | "warning" | "critical" }
export interface Settings { sla: Record<Priority, number>; warrantyGraceDays: number; reminderDays: number }

export interface AppState {
  version: number; clockOffset: number; currentUserId: ID; caseSeq: number; claimSeq: number;
  customers: Customer[]; products: Product[]; orders: Order[]; cases: SupportCase[]; claims: WarrantyClaim[];
  articles: Article[]; approvals: Approval[]; logs: AutomationLog[]; audit: AuditEntry[]; users: User[];
  queues: Queue[]; templates: PromptTemplate[]; notifications: Notification[]; settings: Settings;
}

export interface Result<T = unknown> { ok: boolean; message: string; data?: T }
