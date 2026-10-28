import type { AppState, Article, Customer, Order, Product, PromptTemplate, Queue, SupportCase, User, WarrantyClaim, Approval, AutomationLog, Priority, Category, CaseStatus } from "./types";

export const STORAGE_VERSION = 1;
const SLA: Record<Priority, number> = { Critical: 15, High: 60, Medium: 240, Low: 480 };

export function buildSeed(base: number = Date.now()): AppState {
  const t = (daysAgo: number, hours = 0, mins = 0) => new Date(base - daysAgo * 86400000 - hours * 3600000 - mins * 60000).toISOString();
  const fut = (days: number) => new Date(base + days * 86400000).toISOString();

  const users: User[] = [
    { id: "u-admin", name: "Alex Morgan", email: "alex.morgan@voltgear.demo", role: "Administrator", active: true, title: "Platform Administrator" },
    { id: "u-mgr", name: "Daniel Okafor", email: "daniel.okafor@voltgear.demo", role: "Support Manager", active: true, title: "Support Manager" },
    { id: "u-a1", name: "Sofia Reyes", email: "sofia.reyes@voltgear.demo", role: "Support Agent", active: true, title: "Senior Support Agent" },
    { id: "u-a2", name: "Kenji Tanaka", email: "kenji.tanaka@voltgear.demo", role: "Support Agent", active: true, title: "Technical Support Agent" },
    { id: "u-a3", name: "Amara Nwosu", email: "amara.nwosu@voltgear.demo", role: "Support Agent", active: true, title: "Order Support Agent" },
    { id: "u-ws", name: "Lukas Weber", email: "lukas.weber@voltgear.demo", role: "Warranty Specialist", active: true, title: "Warranty Specialist" },
    { id: "u-appr", name: "Meera Kapoor", email: "meera.kapoor@voltgear.demo", role: "Approver", active: true, title: "Refunds Approver" },
  ];
  const queues: Queue[] = [
    { id: "q-general", name: "General Support", description: "General inquiries and account questions.", members: ["u-a1", "u-a3"], rule: "Category = General" },
    { id: "q-order", name: "Order Support", description: "Tracking, delays, refunds and cancellations.", members: ["u-a3", "u-a1"], rule: "Category in (Order Tracking, Shipping Delay, Refund)" },
    { id: "q-tech", name: "Technical Support", description: "Product defects and troubleshooting.", members: ["u-a2"], rule: "Category in (Product Defect, Technical)" },
    { id: "q-warranty", name: "Warranty Support", description: "Warranty eligibility and claims.", members: ["u-ws"], rule: "Category = Warranty" },
  ];
  const cust = (id: string, name: string, email: string, phone: string, country: string, type: Customer["type"], sinceDays: number): Customer =>
    ({ id, name, email, phone, country, type, since: t(sinceDays).slice(0, 10), status: "Active", createdAt: t(sinceDays) });
  const customers: Customer[] = [
    cust("c-001", "Priya Sharma", "priya.sharma@example.com", "+91 98200 11223", "India", "Individual", 400),
    cust("c-002", "James Carter", "james.carter@example.com", "+1 415 555 0142", "United States", "VIP", 900),
    cust("c-003", "Elena Rossi", "elena.rossi@example.com", "+39 06 5550 1234", "Italy", "Individual", 300),
    cust("c-004", "Mohammed Al-Farsi", "m.alfarsi@example.com", "+971 4 555 0199", "UAE", "Business", 700),
    cust("c-005", "Hannah Schmidt", "hannah.schmidt@example.com", "+49 30 5550 7788", "Germany", "Individual", 200),
    cust("c-006", "Lucas Martin", "lucas.martin@example.com", "+33 1 5550 4455", "France", "Individual", 520),
    cust("c-007", "Aiko Suzuki", "aiko.suzuki@example.com", "+81 3 5550 6611", "Japan", "VIP", 1100),
    cust("c-008", "Oliver Bennett", "oliver.bennett@example.com", "+44 20 5550 3322", "United Kingdom", "Individual", 150),
    cust("c-009", "Camila Souza", "camila.souza@example.com", "+55 11 5550 8899", "Brazil", "Individual", 610),
    cust("c-010", "Noah Williams", "noah.williams@example.com", "+61 2 5550 2211", "Australia", "Business", 820),
    cust("c-011", "Fatima Zahra", "fatima.zahra@example.com", "+212 5 5550 7766", "Morocco", "Individual", 90),
    cust("c-012", "Ravi Menon", "ravi.menon@example.com", "+91 99860 44551", "India", "Individual", 260),
  ];
  const prod = (id: string, name: string, sku: string, category: string, brand: string, price: number, warrantyMonths: number, stock: number, status: Product["status"] = "Active"): Product =>
    ({ id, name, sku, category, brand, price, warrantyMonths, stock, status });
  const products: Product[] = [
    prod("p-001", "AuraSound Pro Wireless Headphones", "VG-HP-200", "Audio", "AuraSound", 189, 12, 140),
    prod("p-002", "NovaBook 14 Laptop", "VG-LT-140", "Computers", "Nova", 1249, 24, 35),
    prod("p-003", "BoomCube Bluetooth Speaker", "VG-SP-050", "Audio", "BoomCube", 79, 12, 260),
    prod("p-004", "PulseFit Smartwatch S2", "VG-SW-220", "Wearables", "PulseFit", 229, 12, 90),
    prod("p-005", "Zephyr 5G Smartphone", "VG-PH-500", "Phones", "Zephyr", 799, 24, 60),
    prod("p-006", "TapPad 11 Tablet", "VG-TB-110", "Tablets", "TapPad", 499, 12, 48),
    prod("p-007", "AirBuds Lite Earbuds", "VG-EB-030", "Audio", "AuraSound", 59, 6, 400),
    prod("p-008", "HomeHub Smart Display", "VG-HH-080", "Smart Home", "HomeHub", 149, 12, 0, "Discontinued"),
    prod("p-009", "SnapCam 4K Action Camera", "VG-AC-400", "Cameras", "SnapCam", 329, 12, 75),
    prod("p-010", "VoltCharge 65W GaN Charger", "VG-CH-065", "Accessories", "VoltGear", 45, 18, 520),
  ];
  const price = (id: string) => products.find((p) => p.id === id)!.price;
  const ord = (id: string, customerId: string, n: number, daysAgo: number, lines: [string, number][], shipping: Order["shipping"], payment: Order["payment"] = "Paid"): Order => {
    const flow = ["Confirmed", "Processing", "Shipped", "In Transit", "Delivered"];
    const idx = shipping === "Delayed" ? 3 : shipping === "Cancelled" ? 0 : flow.indexOf(shipping);
    const events = flow.slice(0, idx + 1).map((st, i) => ({ at: t(daysAgo - i * 0.8 < 0 ? 0 : daysAgo - i * 0.8), status: st, note: `Order ${st.toLowerCase()} (simulated carrier event)` }));
    if (shipping === "Delayed") events.push({ at: t(Math.max(daysAgo - 3, 0)), status: "Delayed", note: "Carrier reported a hub delay (simulated)" });
    if (shipping === "Cancelled") events.push({ at: t(Math.max(daysAgo - 1, 0)), status: "Cancelled", note: "Order cancelled" });
    return {
      id, customerId, number: `ORD-${n}`, date: t(daysAgo), lines: lines.map(([productId, qty]) => ({ productId, qty })),
      total: lines.reduce((a, [p, q]) => a + price(p) * q, 0), payment, shipping, tracking: `TRK${(n * 7919).toString().padStart(9, "0")}`,
      eta: shipping === "Delivered" ? t(Math.max(daysAgo - 4, 0)) : new Date(new Date(t(daysAgo)).getTime() + 6 * 86400000).toISOString(), events,
    };
  };
  const orders: Order[] = [
    ord("o-1001", "c-001", 50211, 10, [["p-001", 1]], "Delivered"),
    ord("o-1002", "c-002", 50212, 4, [["p-005", 1], ["p-010", 1]], "In Transit"),
    ord("o-1003", "c-003", 50213, 420, [["p-002", 1]], "Delivered"),
    ord("o-1004", "c-004", 50214, 9, [["p-006", 2]], "Delayed"),
    ord("o-1005", "c-005", 50215, 14, [["p-004", 1]], "Delivered"),
    ord("o-1006", "c-006", 50216, 30, [["p-003", 1]], "Delivered"),
    ord("o-1007", "c-007", 50217, 5, [["p-009", 1]], "Shipped"),
    ord("o-1008", "c-008", 50218, 4, [["p-007", 2]], "Confirmed"),
    ord("o-1009", "c-009", 50219, 200, [["p-001", 1]], "Delivered"),
    ord("o-1010", "c-010", 50220, 60, [["p-002", 3]], "Delivered"),
    ord("o-1011", "c-011", 50221, 2, [["p-003", 1], ["p-010", 2]], "Processing"),
    ord("o-1012", "c-012", 50222, 380, [["p-005", 1]], "Delivered"),
    ord("o-1013", "c-002", 50223, 20, [["p-004", 1]], "Delivered"),
    ord("o-1014", "c-005", 50224, 6, [["p-006", 1]], "Cancelled", "Refund Pending"),
    ord("o-1015", "c-003", 50225, 3, [["p-007", 1]], "In Transit"),
  ];

  const mk = (n: number, subject: string, description: string, customerId: string, orderId: string | undefined, productId: string | undefined, category: Category, priority: Priority, status: CaseStatus, queueId: string | undefined, agentId: string | undefined, created: string, extra: Partial<SupportCase> = {}): SupportCase => ({
    id: `case-${n}`, number: `CS-${n}`, subject, description, customerId, orderId, productId, origin: (["Email", "Web", "Phone", "Chat"] as const)[n % 4],
    category, priority, status, queueId, agentId, createdAt: created, updatedAt: extra.resolvedAt ?? created,
    slaDeadline: new Date(new Date(created).getTime() + SLA[priority] * 60000).toISOString(), escalated: status === "Escalated", notes: [], ...extra,
  });
  const resolved = (createdDaysAgo: number, hoursToResolve: number, rating?: number, notes = "Issue resolved and confirmed with the customer.") => {
    const created = t(createdDaysAgo);
    const res = new Date(new Date(created).getTime() + hoursToResolve * 3600000).toISOString();
    return { created, extra: { firstResponseAt: new Date(new Date(created).getTime() + 20 * 60000).toISOString(), resolvedAt: res, resolutionNotes: notes, rating, followUpAt: res, followUpDone: true } };
  };
  const r1 = resolved(6, 26, 5), r2 = resolved(5, 8, 4), r3 = resolved(4, 50, 3), r4 = resolved(3, 5, 5), r5 = resolved(2, 30, 2), r6 = resolved(8, 12, 4);
  const cases: SupportCase[] = [
    mk(1001, "Wireless headphones will not connect over Bluetooth", "My AuraSound Pro headphones stopped pairing with my phone two days ago. The LED blinks red and the device never appears in the Bluetooth list. I already tried restarting my phone.", "c-001", "o-1001", "p-001", "Product Defect", "High", "New", undefined, undefined, t(0, 0, 25)),
    mk(1002, "Where is my Zephyr phone order?", "I ordered a Zephyr 5G four days ago and would like a tracking update.", "c-002", "o-1002", "p-005", "Order Tracking", "Medium", "Working", "q-order", "u-a3", t(0, 3), { firstResponseAt: t(0, 2, 40) }),
    mk(1003, "NovaBook laptop screen flickering — warranty claim", "The laptop screen flickers constantly. I bought it a little over a year ago and want a warranty repair.", "c-003", "o-1003", "p-002", "Warranty", "Medium", "Working", "q-warranty", "u-ws", t(1, 2), { firstResponseAt: t(1, 1) }),
    mk(1004, "Tablet shipment delayed for over a week", "Two TapPad tablets for our office are more than a week late. We need them urgently for onboarding.", "c-004", "o-1004", "p-006", "Shipping Delay", "Critical", "Escalated", "q-order", "u-a3", t(0, 0, 50), {}),
    mk(1005, "Refund request for cancelled tablet order", "I cancelled my TapPad order and would like a refund to my card.", "c-005", "o-1014", "p-006", "Refund", "Medium", "Waiting for Customer", "q-order", "u-a1", t(1, 5), { firstResponseAt: t(1, 4) }),
    mk(1006, "Bluetooth speaker cuts out after 10 minutes", "My BoomCube speaker disconnects and powers off after about ten minutes of playback, even when charged.", "c-006", "o-1006", "p-003", "Product Defect", "Medium", "Working", "q-tech", "u-a2", t(0, 6), { firstResponseAt: t(0, 5, 30) }),
    mk(1007, "Action camera not received yet", "Shipment shows shipped, but no movement for two days.", "c-007", "o-1007", "p-009", "Order Tracking", "High", "New", "q-order", undefined, t(0, 0, 48)),
    mk(1008, "Smartwatch heart-rate sensor inaccurate", "The PulseFit S2 shows a heart rate of 180 while resting. AI draft pending agent review.", "c-005", "o-1005", "p-004", "Technical", "Low", "Working", "q-tech", "u-a2", t(0, 4), { firstResponseAt: t(0, 3), aiResponse: "Hi Hannah, thank you for reporting the heart-rate readings on your PulseFit Smartwatch S2. Please try re-seating the strap and updating the firmware; if the readings remain inaccurate we will arrange a diagnostic return.\n\n— Draft generated by simulated AI. Requires agent review before sending." }),
    mk(1009, "Earbuds pairing issue resolved", "AirBuds Lite would only connect one bud.", "c-008", "o-1008", "p-007", "Product Defect", "Low", "Resolved", "q-tech", "u-a2", r1.created, r1.extra),
    mk(1010, "Change shipping address", "Please update my delivery address.", "c-011", "o-1011", undefined, "General", "Low", "Closed", "q-general", "u-a1", r2.created, r2.extra),
    mk(1011, "Laptop bulk order invoice copy", "Need a VAT invoice for our NovaBook purchase.", "c-010", "o-1010", "p-002", "General", "Low", "Resolved", "q-general", "u-a1", r3.created, r3.extra),
    mk(1012, "Headphones left ear cup crackles", "Crackling in the left ear cup at higher volume.", "c-009", "o-1009", "p-001", "Product Defect", "Medium", "Resolved", "q-tech", "u-a2", r4.created, r4.extra),
    mk(1013, "Phone battery drains overnight — warranty", "Zephyr battery drops 40% overnight. Bought just over a year ago.", "c-012", "o-1012", "p-005", "Warranty", "Medium", "Closed", "q-warranty", "u-ws", r5.created, r5.extra),
    mk(1014, "Smartwatch strap replacement", "Strap broke after two weeks.", "c-002", "o-1013", "p-004", "Product Defect", "Low", "Resolved", "q-tech", "u-a2", r6.created, r6.extra),
    mk(1015, "Earbuds delivery tracking", "When will my AirBuds arrive?", "c-003", "o-1015", "p-007", "Order Tracking", "Low", "New", undefined, undefined, t(0, 1)),
  ];

  const claims: WarrantyClaim[] = [
    { id: "w-1", number: "WC-2001", customerId: "c-003", productId: "p-002", orderId: "o-1003", purchaseDate: t(420).slice(0, 10), claimDate: t(1).slice(0, 10), reason: "Screen flickering", warrantyStatus: "Pending Check", approvalStatus: "Not Submitted" },
    { id: "w-2", number: "WC-2002", customerId: "c-006", productId: "p-003", orderId: "o-1006", purchaseDate: t(30).slice(0, 10), claimDate: t(0).slice(0, 10), reason: "Speaker powers off during playback", warrantyStatus: "Eligible", eligibilityReason: "Claimed within the 12-month warranty.", approvalStatus: "Pending", queueId: "q-warranty" },
    { id: "w-3", number: "WC-2003", customerId: "c-012", productId: "p-005", orderId: "o-1012", purchaseDate: t(380).slice(0, 10), claimDate: t(2).slice(0, 10), reason: "Battery degradation", warrantyStatus: "Eligible", eligibilityReason: "Claimed within the 24-month warranty.", approvalStatus: "Approved", decisionNotes: "Battery replacement authorised.", queueId: "q-warranty" },
    { id: "w-4", number: "WC-2004", customerId: "c-009", productId: "p-001", orderId: "o-1009", purchaseDate: t(200).slice(0, 10), claimDate: t(3).slice(0, 10), reason: "Ear cup crackling", warrantyStatus: "Eligible", eligibilityReason: "Claimed within the 12-month warranty.", approvalStatus: "Not Submitted", queueId: "q-warranty" },
    { id: "w-5", number: "WC-2005", customerId: "c-005", productId: "p-004", orderId: "o-1005", purchaseDate: t(14).slice(0, 10), claimDate: t(0).slice(0, 10), reason: "Sensor inaccurate", warrantyStatus: "Pending Check", approvalStatus: "Not Submitted" },
    { id: "w-6", number: "WC-2006", customerId: "c-010", productId: "p-002", orderId: "o-1010", purchaseDate: t(60).slice(0, 10), claimDate: t(1).slice(0, 10), reason: "Keyboard keys sticking", warrantyStatus: "Eligible", eligibilityReason: "Claimed within the 24-month warranty.", approvalStatus: "Rejected", decisionNotes: "Liquid damage found — not covered.", queueId: "q-warranty" },
  ];

  const art = (id: string, title: string, category: string, keywords: string[], content: string): Article => ({ id, title, category, keywords, content, published: true, updatedAt: t(20) });
  const articles: Article[] = [
    art("kb-01", "How to track your order", "Orders", ["tracking", "order", "shipping", "delivery", "where"], "Every order receives a tracking number once it ships. Customers can follow progress from Confirmed → Processing → Shipped → In Transit → Delivered. Agents should share the tracking number and latest carrier event, and never confirm delivery before the carrier does."),
    art("kb-02", "Returning a defective product", "Returns", ["defective", "return", "faulty", "broken", "replacement"], "If a product is defective within its warranty, open a return authorisation, ask the customer for proof of purchase, and provide a prepaid return label. Replacement ships once the item is inspected."),
    art("kb-03", "Checking warranty eligibility", "Warranty", ["warranty", "eligibility", "coverage", "expired", "claim"], "Warranty starts on the purchase date and lasts the product's configured duration. Claims inside the period are eligible; claims shortly after expiry go to manual review; others are ineligible. Physical or liquid damage is excluded."),
    art("kb-04", "Troubleshooting Bluetooth connectivity", "Troubleshooting", ["bluetooth", "connect", "pairing", "speaker", "disconnect"], "1) Charge the device fully. 2) Forget the device in phone settings. 3) Hold the power button 10 seconds to reset. 4) Re-pair within 1 metre. 5) Update firmware. If the device still fails, treat it as a defect."),
    art("kb-05", "Resolving headphone pairing issues", "Troubleshooting", ["headphones", "pairing", "bluetooth", "led", "red", "aurasound"], "A blinking red LED on AuraSound headphones indicates a pairing fault. Reset by holding Power + Volume Down for 8 seconds until the LED flashes blue, then re-pair. Persistent red blinking after reset indicates a hardware defect eligible for replacement."),
    art("kb-06", "Handling delayed shipments", "Orders", ["delay", "delayed", "late", "shipment", "escalate"], "If a shipment is more than 3 days past its estimate, apologise, share the latest carrier event, open a carrier investigation, and escalate critical or business-impacting delays to the Order Support lead."),
    art("kb-07", "Requesting a refund", "Billing", ["refund", "cancel", "cancellation", "money", "payment"], "Refunds and cancellations require approval from the designated approver. Agents must not promise a refund until the approval is recorded. Approved refunds are processed to the original payment method."),
    art("kb-08", "Updating customer contact information", "Account", ["address", "email", "phone", "update", "contact"], "Verify the customer's identity with the order number and email on file before changing contact information. Record the change in the case notes."),
    art("kb-09", "Understanding case statuses", "Process", ["status", "new", "working", "escalated", "resolved", "closed"], "New: not yet reviewed. Working: an agent is handling it. Escalated: needs senior attention. Waiting for Customer: awaiting a reply. Resolved: solution provided. Closed: finalised after follow-up."),
    art("kb-10", "Escalating unresolved issues", "Process", ["escalate", "escalation", "urgent", "critical", "manager"], "Escalate when a case is Critical, has breached SLA, or the customer reports business impact. Add a clear escalation reason; the Support Manager reviews escalated cases first."),
  ];

  const approvals: Approval[] = [
    { id: "ap-1", caseId: "case-1005", type: "Refund", reason: "Customer cancelled TapPad order before shipment; full refund requested ($499).", requestedBy: "u-a1", approverId: "u-appr", status: "Pending", createdAt: t(1, 3) },
    { id: "ap-2", claimId: "w-2", type: "Warranty Replacement", reason: "BoomCube speaker eligible for in-warranty replacement.", requestedBy: "u-ws", approverId: "u-mgr", status: "Pending", createdAt: t(0, 2) },
    { id: "ap-3", claimId: "w-3", type: "Warranty Replacement", reason: "Zephyr battery replacement.", requestedBy: "u-ws", approverId: "u-mgr", status: "Approved", comments: "Battery replacement authorised.", createdAt: t(2), decidedAt: t(1, 20), decidedBy: "u-mgr" },
    { id: "ap-4", caseId: "case-1013", type: "Refund", reason: "Customer requested partial refund for battery issue.", requestedBy: "u-ws", approverId: "u-appr", status: "Rejected", comments: "Covered by warranty repair instead of refund.", createdAt: t(2, 4), decidedAt: t(2), decidedBy: "u-appr" },
  ];

  const logs: AutomationLog[] = [
    { id: "lg-1", automation: "Case Assignment Flow", recordId: "case-1002", trigger: "Case created", status: "Success", at: t(0, 3), details: "Routed CS-1002 to Order Support and assigned Amara Nwosu." },
    { id: "lg-2", automation: "Priority & Escalation Flow", recordId: "case-1004", trigger: "Case created", status: "Success", at: t(0, 0, 50), details: "Critical case CS-1004 flagged urgent and escalated." },
    { id: "lg-3", automation: "Case Resolution Flow", recordId: "case-1012", trigger: "Status → Resolved", status: "Success", at: t(3), details: "Resolution recorded; satisfaction follow-up scheduled (simulated)." },
    { id: "lg-4", automation: "Warranty Claim Flow", recordId: "w-6", trigger: "Claim updated", status: "Success", at: t(1), details: "WC-2006 eligible; routed to Warranty Support." },
  ];
  cases.find((c) => c.id === "case-1004")!.urgent = true;

  const templates: PromptTemplate[] = [
    { id: "pt-1", name: "Case Summary Generator", recordType: "Case", kind: "summary", active: true, body: "Summarise case {{case.number}} for {{customer.name}}. Subject: {{case.subject}}. Product: {{product.name}}. Order: {{order.number}} ({{order.shipping}}). Status: {{case.status}}, priority {{case.priority}}. Include the issue, context, observations and recommended next action." },
    { id: "pt-2", name: "Customer Response Generator", recordType: "Case", kind: "response", active: true, body: "Write an empathetic reply to {{customer.name}} about {{case.subject}}. Reference order {{order.number}} (tracking {{order.tracking}}, status {{order.shipping}}). Never promise refunds or decisions that are not recorded." },
    { id: "pt-3", name: "Warranty Eligibility Explanation", recordType: "Case", kind: "warranty", active: true, body: "Explain warranty eligibility for {{product.name}} ({{product.warrantyMonths}}-month warranty) purchased on {{order.date}} by {{customer.name}}." },
    { id: "pt-4", name: "Escalation Recommendation", recordType: "Case", kind: "escalation", active: true, body: "Assess whether case {{case.number}} (priority {{case.priority}}, status {{case.status}}, SLA {{case.sla}}) should be escalated and explain why." },
  ];

  return {
    version: STORAGE_VERSION, clockOffset: 0, currentUserId: "u-admin", caseSeq: 1015, claimSeq: 2006,
    customers, products, orders, cases, claims, articles, approvals, logs, audit: [], users, queues, templates,
    notifications: [{ id: "n-1", at: t(0, 0, 50), title: "Critical case escalated", body: "CS-1004 (tablet shipment delay) was escalated by automation.", read: false, level: "critical" }],
    settings: { sla: { ...SLA }, warrantyGraceDays: 30, reminderDays: 3 },
  };
}

export const SCENARIO_1 = { caseId: "case-1001", customerId: "c-001", orderId: "o-1001", productId: "p-001" };
export const SCENARIO_2 = { caseId: "case-1004", customerId: "c-004", orderId: "o-1004", approvalId: "ap-1" };
