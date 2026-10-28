/**
 * Mock AI provider — deterministic, template-based, runs entirely in the browser.
 * No external language model is contacted. Outputs are drafts that require agent review.
 */
import type { AppState, Article, PromptTemplate, SupportCase } from "./types";
import { caseSla, fmtDuration, isOpen } from "./rules";

export const MOCK_PROVIDER = "Local mock AI (deterministic templates)";

export function caseContext(s: AppState, c: SupportCase) {
  const customer = s.customers.find((x) => x.id === c.customerId);
  const order = s.orders.find((x) => x.id === c.orderId);
  const product = s.products.find((x) => x.id === c.productId);
  const claim = s.claims.find((w) => w.customerId === c.customerId && (w.productId === c.productId || w.orderId === c.orderId));
  const approvals = s.approvals.filter((a) => a.caseId === c.id);
  const agent = s.users.find((u) => u.id === c.agentId);
  const queue = s.queues.find((q) => q.id === c.queueId);
  return { customer, order, product, claim, approvals, agent, queue, sla: caseSla(s, c) };
}

const first = (name?: string) => (name ?? "there").split(" ")[0];

export function nextAction(s: AppState, c: SupportCase): { action: string; reason: string } {
  const { order, claim, approvals, sla } = caseContext(s, c);
  if (!isOpen(c)) return { action: "No action — case is " + c.status.toLowerCase(), reason: "The case is already resolved or closed." };
  if (sla.state === "Breached" && !c.escalated) return { action: "Escalate due to urgency", reason: `First-response SLA breached by ${fmtDuration(sla.msRemaining)}.` };
  if (c.priority === "Critical" && !c.escalated) return { action: "Escalate due to urgency", reason: "Critical priority cases require senior attention." };
  if (c.category === "Refund") {
    const pending = approvals.find((a) => a.status === "Pending");
    if (pending) return { action: "Await approval decision", reason: "A refund request is pending with the designated approver." };
    if (!approvals.length) return { action: "Submit for approval", reason: "Refunds require approval before any commitment is made." };
    return { action: "Resolve after confirmation", reason: `Approval was ${approvals[0].status.toLowerCase()}; inform the customer and resolve.` };
  }
  if (c.category === "Warranty") return { action: "Review warranty eligibility", reason: claim ? `Claim ${claim.number} is ${claim.warrantyStatus}.` : "No warranty claim exists yet — create one to check eligibility." };
  if (c.category === "Shipping Delay") return { action: "Route to a specialist", reason: `Order ${order?.number ?? ""} is ${order?.shipping ?? "unknown"}; open a carrier investigation.` };
  if (c.category === "Order Tracking") return { action: "Check order tracking", reason: `Share tracking ${order?.tracking ?? "(none)"} — current status ${order?.shipping ?? "unknown"}.` };
  if (!c.agentId) return { action: "Route to a specialist", reason: "The case has no assigned agent; run the assignment flow." };
  if (c.category === "Product Defect" || c.category === "Technical") return { action: "Request additional information", reason: "Confirm troubleshooting steps were tried before arranging a return." };
  return { action: "Resolve after confirmation", reason: "Provide the answer and confirm with the customer." };
}

export function summarize(s: AppState, c: SupportCase) {
  const { customer, order, product, sla, agent, queue } = caseContext(s, c);
  const na = nextAction(s, c);
  return [
    `Customer issue: ${customer?.name ?? "Unknown customer"} reports "${c.subject}". ${c.description.split(".")[0]}.`,
    `Context: ${product ? `${product.name} (${product.sku}, ${product.warrantyMonths}-month warranty)` : "No product linked"}; ${order ? `order ${order.number} placed ${order.date.slice(0, 10)}, shipping ${order.shipping}, payment ${order.payment}` : "no order linked"}.`,
    `Status: ${c.status} · Priority ${c.priority} · ${queue?.name ?? "No queue"}${agent ? ` / ${agent.name}` : " / unassigned"}.`,
    `Observations: SLA ${sla.state}${sla.state === "Breached" ? ` (${fmtDuration(sla.msRemaining)} over)` : ""}; ${c.escalated ? "case is escalated" : "not escalated"}; customer type ${customer?.type ?? "n/a"}.`,
    `Recommended next action: ${na.action} — ${na.reason}`,
  ].join("\n");
}

export function suggestResponse(s: AppState, c: SupportCase) {
  const { customer, order, product, claim, approvals } = caseContext(s, c);
  const hi = `Hi ${first(customer?.name)},\n\nThank you for contacting us about "${c.subject}" (case ${c.number}). `;
  let body: string;
  switch (c.category) {
    case "Order Tracking":
    case "Shipping Delay":
      body = order
        ? `Your order ${order.number} currently shows the status "${order.shipping}" with tracking number ${order.tracking}. The latest carrier update reads: "${order.events.at(-1)?.note ?? "no events yet"}". ${order.shipping === "Delayed" ? "I'm sorry for the delay — we have raised this with the carrier and will update you as soon as we hear back." : order.shipping === "Delivered" ? "Our records show this order as delivered; please let us know if you have not received it." : `The current estimated delivery date is ${order.eta.slice(0, 10)}.`}`
        : "I could not find an order linked to this case. Could you share your order number so I can check its status?";
      break;
    case "Warranty":
      body = claim
        ? `Your warranty claim ${claim.number} for the ${product?.name ?? "product"} is currently "${claim.warrantyStatus}" with approval status "${claim.approvalStatus}". ${claim.eligibilityReason ?? ""} We will contact you with the next steps once a decision is recorded.`
        : `To review warranty coverage for your ${product?.name ?? "product"}${product ? ` (${product.warrantyMonths}-month warranty)` : ""}, we will open a warranty claim using your purchase date. Please keep your proof of purchase handy.`;
      break;
    case "Refund": {
      const ap = approvals[0];
      body = ap
        ? ap.status === "Pending"
          ? "Your refund request has been submitted and is awaiting review by our approvals team. We'll confirm the outcome as soon as a decision is made — no refund has been issued yet."
          : ap.status === "Approved"
            ? "Your refund request has been approved. It will be processed to your original payment method."
            : `After review, we're unable to approve the refund request. ${ap.comments ?? ""}`
        : "I've noted your refund request. It needs to be reviewed by our approvals team before anything is processed, and I'll update you once a decision is made.";
      break;
    }
    case "Product Defect":
    case "Technical":
      body = `I'm sorry your ${product?.name ?? "device"} isn't working as expected. Please try a full reset: charge the device, forget it in your Bluetooth settings, hold the power button for 10 seconds, then re-pair it within one metre. If the problem continues, reply to this message and we'll arrange a return${product ? ` under your ${product.warrantyMonths}-month warranty, subject to eligibility` : ""}.`;
      break;
    default:
      body = "We've received your request and an agent is reviewing it. We'll follow up shortly with an update.";
  }
  return `${hi}${body}\n\nKind regards,\nCustomer Support\n\n— Draft generated by simulated AI. Requires agent review before sending.`;
}

export function searchKnowledge(s: AppState, text: string, limit = 4): (Article & { score: number })[] {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return s.articles
    .filter((a) => a.published)
    .map((a) => {
      const hay = `${a.title} ${a.category} ${a.content}`.toLowerCase();
      const score = words.reduce((acc, w) => acc + (a.keywords.some((k) => k === w || w.startsWith(k)) ? 3 : 0) + (hay.includes(w) ? 1 : 0), 0);
      return { ...a, score };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
export const caseKnowledge = (s: AppState, c: SupportCase) => {
  const p = s.products.find((x) => x.id === c.productId);
  return searchKnowledge(s, `${c.subject} ${c.description} ${c.category} ${p?.name ?? ""}`);
};

export function draftUpdate(s: AppState, c: SupportCase) {
  const na = nextAction(s, c);
  return `Internal update for ${c.number}: status ${c.status}, priority ${c.priority}. Next step: ${na.action}. ${na.reason}`;
}

export function renderTemplate(s: AppState, t: PromptTemplate, c: SupportCase) {
  const { customer, order, product, sla } = caseContext(s, c);
  const vars: Record<string, string> = {
    "case.number": c.number, "case.subject": c.subject, "case.status": c.status, "case.priority": c.priority, "case.sla": sla.state,
    "customer.name": customer?.name ?? "(no customer)", "order.number": order?.number ?? "(no order)", "order.tracking": order?.tracking ?? "(none)",
    "order.shipping": order?.shipping ?? "(n/a)", "order.date": order?.date.slice(0, 10) ?? "(n/a)", "product.name": product?.name ?? "(no product)",
    "product.warrantyMonths": String(product?.warrantyMonths ?? "?"),
  };
  return t.body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export function runTemplate(s: AppState, t: PromptTemplate, c: SupportCase) {
  switch (t.kind) {
    case "summary": return summarize(s, c);
    case "response": return suggestResponse(s, c);
    case "warranty": {
      const { claim, product, order } = caseContext(s, c);
      if (claim) return `Warranty claim ${claim.number}: ${claim.warrantyStatus}. ${claim.eligibilityReason ?? "Eligibility has not been checked yet — run the Warranty Claim Flow."}`;
      return product && order ? `${product.name} carries a ${product.warrantyMonths}-month warranty from the purchase date ${order.date.slice(0, 10)}. No claim exists yet; create one to run the eligibility check.` : "Not enough product/order data to explain warranty eligibility.";
    }
    case "escalation": {
      const na = nextAction(s, c);
      const esc = na.action.startsWith("Escalate");
      return `${esc ? "Escalation recommended" : "Escalation not required"}: ${na.reason}`;
    }
    default:
      return `Simulated output for prompt:\n\n${renderTemplate(s, t, c)}\n\n${summarize(s, c)}`;
  }
}
