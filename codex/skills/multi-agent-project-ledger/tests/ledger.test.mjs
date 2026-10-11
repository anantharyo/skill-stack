import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.dirname(testDir);
const ledger = path.join(skillDir, "scripts", "ledger.mjs");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "multi-agent-ledger-test-"));
const project = path.join(temporaryRoot, "project");

function run(binary, args, options = {}) {
  return spawnSync(binary, args, {
    cwd: project,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function ledgerRun(args) {
  return run(process.execPath, [ledger, ...args, "--project", project]);
}

function replace(relativePath, replacements) {
  const file = path.join(project, relativePath);
  let text = fs.readFileSync(file, "utf8");
  for (const [from, to] of replacements) {
    assert.ok(text.includes(from), `${relativePath} missing fixture text: ${from}`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(file, text, "utf8");
}

function git(args) {
  const result = run("git", args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

try {
  fs.mkdirSync(project, { recursive: true });
  git(["init", "-b", "main"]);
  git(["config", "user.email", "ledger-test@example.invalid"]);
  git(["config", "user.name", "Ledger Test"]);

  const initialized = ledgerRun(["init"]);
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.ok(fs.readFileSync(path.join(project, "AGENT_LEDGER_PROTOCOL.md"), "utf8").includes("## Work-Item Lifecycle"));

  const placeholders = ledgerRun(["validate", "--no-git"]);
  assert.equal(placeholders.status, 1);
  assert.match(placeholders.stdout, /unresolved bootstrap placeholder/);

  replace(".project-ledger/requirements.yaml", [
    ["Replace with a stable PRD requirement", "User can complete bootstrap"],
  ]);
  replace(".project-ledger/phases/PHASE-1.md", [
    ["Replace with phase title", "Bootstrap delivery"],
    ["Replace with the phase outcome.", "Deliver the bootstrap capability."],
    ["Replace with prerequisites.", "Canonical repository exists."],
    ["Replace with included scope.", "Bootstrap source and tests."],
    ["Replace with excluded scope.", "Production deployment."],
    ["Replace with required outputs.", "Verified implementation."],
    ["Replace with evidence-based acceptance criteria.", "Required work is accepted."],
    ["Replace with fail-closed rejection criteria.", "Mismatched evidence rejects the phase."],
    ["Replace with the next phase or `None`.", "None."],
  ]);
  replace(".project-ledger/work-items/TASK-001.md", [
    ["Replace with task title", "Implement bootstrap"],
    ["replace/with/narrow/path/**", "src/bootstrap/**"],
    ["Replace with one bounded objective.", "Implement bootstrap."],
    ["Replace with concrete deliverables.", "Source and tests."],
    ["Replace with the approved approach.", "Implement the frozen requirement."],
    ["Replace with observable pass conditions.", "Focused verification passes."],
    ["Replace with explicit fail conditions.", "Mismatched evidence rejects completion."],
  ]);

  const configured = ledgerRun(["validate", "--no-git"]);
  assert.equal(configured.status, 0, configured.stdout + configured.stderr);

  git(["add", "."]);
  git(["commit", "-m", "initialize ledger"]);
  const base = git(["rev-parse", "HEAD"]);
  git(["switch", "-c", "antigravity/task-001"]);
  replace(".project-ledger/config.yaml", [["commit: null", `commit: \"${base}\"`]]);
  replace(".project-ledger/work-items/TASK-001.md", [
    ["status: \"ready\"", "status: \"in_progress\""],
    ["base: null", `base: \"${base}\"`],
  ]);
  fs.mkdirSync(path.join(project, "src", "bootstrap"), { recursive: true });
  fs.writeFileSync(path.join(project, "src", "bootstrap", "index.js"), "export const ready = true;\n", "utf8");

  const ownerPass = ledgerRun(["preflight", "--actor", "antigravity", "--work-item", "TASK-001"]);
  assert.equal(ownerPass.status, 0, ownerPass.stdout + ownerPass.stderr);
  const wrongOwner = ledgerRun(["preflight", "--actor", "codex", "--work-item", "TASK-001"]);
  assert.equal(wrongOwner.status, 1);
  assert.match(wrongOwner.stderr, /not an implementer/);

  const overlapFile = path.join(project, ".project-ledger", "work-items", "TASK-002.md");
  const firstTask = fs.readFileSync(path.join(project, ".project-ledger", "work-items", "TASK-001.md"), "utf8")
    .replaceAll("TASK-001", "TASK-002")
    .replace("owner: \"antigravity\"", "owner: \"codex\"")
    .replace("implementers: [\"antigravity\"]", "implementers: [\"codex\"]")
    .replace("reviewers: [\"codex\"]", "reviewers: [\"antigravity\"]")
    .replace("integrator: \"codex\"", "integrator: \"antigravity\"")
    .replace("antigravity/task-001", "codex/task-002")
    .replace("src/bootstrap/**", "src/bootstrap/index.js")
    .replace("updated_by: \"antigravity\"", "updated_by: \"codex\"");
  fs.writeFileSync(overlapFile, firstTask, "utf8");
  const overlap = ledgerRun(["validate", "--no-git"]);
  assert.equal(overlap.status, 1);
  assert.match(overlap.stdout, /Write-scope overlap/);
  fs.rmSync(overlapFile);

  git(["add", "."]);
  git(["commit", "-m", "implement bootstrap"]);
  const head = git(["rev-parse", "HEAD"]);
  replace(".project-ledger/work-items/TASK-001.md", [
    ["status: \"in_progress\"", "status: \"review_requested\""],
    ["revision: 1", "revision: 2"],
    ["head: null", `head: \"${head}\"`],
    ["notify: [\"antigravity\"]", "notify: [\"codex\"]"],
  ]);
  let evidence = fs.readFileSync(path.join(skillDir, "assets", "templates", "evidence.md"), "utf8")
    .replaceAll("TASK-ID", "TASK-001")
    .replace("actor: \"actor\"", "actor: \"antigravity\"")
    .replace("commit: null", `commit: \"${head}\"`)
    .replace("result: \"not_run\"", "result: \"pass\"")
    .replace("notify: []", "notify: [\"codex\"]")
    .replaceAll("YYYY-MM-DDTHH:MM:SSZ", new Date().toISOString());
  fs.writeFileSync(path.join(project, ".project-ledger", "evidence", "EVIDENCE-TASK-001-001.md"), evidence, "utf8");

  const reviewReady = ledgerRun(["validate"]);
  assert.equal(reviewReady.status, 0, reviewReady.stdout + reviewReady.stderr);
  const reviewPreflight = ledgerRun(["preflight", "--actor", "codex", "--work-item", "TASK-001", "--mode", "review"]);
  assert.equal(reviewPreflight.status, 0, reviewPreflight.stdout + reviewPreflight.stderr);

  let review = fs.readFileSync(path.join(skillDir, "assets", "templates", "review.md"), "utf8")
    .replaceAll("TASK-ID", "TASK-001")
    .replaceAll("ACTOR", "CODEX")
    .replaceAll("actor", "codex")
    .replace("reviewed_commit: null", `reviewed_commit: \"${head}\"`)
    .replace("verdict: \"pending\"", "verdict: \"approved\"")
    .replace("notify: []", "notify: [\"antigravity\"]")
    .replaceAll("YYYY-MM-DDTHH:MM:SSZ", new Date().toISOString());
  fs.writeFileSync(path.join(project, ".project-ledger", "reviews", "REVIEW-TASK-001-CODEX-001.md"), review, "utf8");
  replace(".project-ledger/work-items/TASK-001.md", [
    ["status: \"review_requested\"", "status: \"ready_to_integrate\""],
    ["revision: 2", "revision: 3"],
  ]);
  const integrationReady = ledgerRun(["validate"]);
  assert.equal(integrationReady.status, 0, integrationReady.stdout + integrationReady.stderr);

  replace(".project-ledger/reviews/REVIEW-TASK-001-CODEX-001.md", [[head, base]]);
  const wrongCommitReview = ledgerRun(["validate"]);
  assert.equal(wrongCommitReview.status, 1);
  assert.match(wrongCommitReview.stdout, /requires an approved review of git.head/);

  process.stdout.write("All multi-agent ledger tests passed.\n");
} finally {
  const resolvedTemp = path.resolve(temporaryRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir());
  if (!resolvedTemp.startsWith(`${resolvedSystemTemp}${path.sep}`) || !path.basename(resolvedTemp).startsWith("multi-agent-ledger-test-")) {
    throw new Error(`Unsafe test cleanup target: ${resolvedTemp}`);
  }
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}

