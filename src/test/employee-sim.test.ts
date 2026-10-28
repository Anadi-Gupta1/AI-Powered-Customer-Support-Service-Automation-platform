import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/sim/seed";
import { applyOutcome, classifyCase, decideStepApproval, executeStep, newRun, STEP_IDS, type SimRun, type StepId } from "@/lib/sim/employee";
import { switchUser } from "@/lib/sim/actions";
import type { AppState } from "@/lib/sim/types";

function step(s: AppState, r: SimRun, id: StepId) {
  const res = executeStep(s, id, { scenario: r.scenario, resolutionNotes: r.resolutionNotes, run: r });
  return applyOutcome(r, id, res.data!, "t", "t");
}
function runAll(s: AppState, r: SimRun) {
  for (const id of STEP_IDS) { r = step(s, r, id); if (r.statuses[id] === "Waiting for Approval" || r.statuses[id] === "Failed") break; }
  return r;
}

describe("AI Employee simulation", () => {
  it("classifies the headphone complaint as Product Defect / High → Technical Support", () => {
    const k = classifyCase(buildSeed().cases.find((c) => c.id === "case-1001")!);
    expect(k.category).toBe("Product Defect");
    expect(k.priority).toBe("High");
    expect(k.queueId).toBe("q-tech");
  });

  it("primary scenario runs end to end and updates the stored case", () => {
    const s = buildSeed();
    const r = runAll(s, newRun("primary"));
    expect(STEP_IDS.every((id) => r.statuses[id] === "Completed" || r.statuses[id] === "Skipped")).toBe(true);
    expect(r.statuses.approval).toBe("Skipped");
    expect(r.statuses.verify).toBe("Completed");
    const c = s.cases.find((x) => x.id === "case-1001")!;
    expect(c.status).toBe("Resolved");
    expect(c.queueId).toBe("q-tech");
    expect(c.agentId).toBe("u-a2");
    expect(c.aiSummary).toContain("Priya Sharma");
  });

  it("repeated runs do not duplicate cases or approvals", () => {
    const s = buildSeed();
    runAll(s, newRun("primary"));
    const n = s.cases.length, a = s.approvals.length;
    runAll(s, newRun("primary"));
    expect(s.cases.length).toBe(n);
    expect(s.approvals.length).toBe(a);
  });

  it("refund stage waits for a human and is never auto-approved", () => {
    const s = buildSeed();
    const r = runAll(s, newRun("full"));
    expect(r.statuses.approval).toBe("Waiting for Approval");
    const id = r.outcomes.approval!.payload!.approvalId as string;
    expect(s.approvals.find((x) => x.id === id)!.status).toBe("Pending");
    expect(s.currentUserId).toBe("u-appr");
    expect(decideStepApproval(s, id, false, "").ok).toBe(false); // comments required
    switchUser(s, "u-a1");
    expect(decideStepApproval(s, id, true, "").ok).toBe(false); // wrong role
    switchUser(s, "u-appr");
    expect(decideStepApproval(s, id, true, "ok").ok).toBe(true);
    expect(s.approvals.find((x) => x.id === id)!.status).toBe("Approved");
  });

  it("a failed step rolls back and is not marked successful", () => {
    const s = buildSeed();
    let r = newRun("primary");
    r.resolutionNotes = "short";
    for (const id of STEP_IDS.slice(0, 9)) r = step(s, r, id);
    expect(r.statuses.resolve).toBe("Failed");
    expect(s.cases.find((x) => x.id === "case-1001")!.status).not.toBe("Resolved");
    // prerequisites enforced
    const v = executeStep(s, "verify", { scenario: "primary", resolutionNotes: "", run: r });
    expect(v.data!.status).toBe("Failed");
  });
});
