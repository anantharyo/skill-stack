#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.dirname(SCRIPT_DIR);
const ASSET_PROJECT = path.join(SKILL_DIR, "assets", "project");
const TEMPLATE_DIR = path.join(SKILL_DIR, "assets", "templates");
const PROTOCOL_SOURCE = path.join(SKILL_DIR, "references", "ledger-protocol.md");
const PROTOCOL_VERSION = 1;

const PHASE_STATUSES = new Set([
  "planned", "active", "blocked", "verification", "accepted", "rejected", "superseded",
]);
const TASK_STATUSES = new Set([
  "backlog", "ready", "claimed", "in_progress", "blocked", "review_requested",
  "changes_requested", "ready_to_integrate", "integrating", "integrated", "verified",
  "accepted", "deferred", "cancelled", "needs_reconciliation",
]);
const ACTIVE_TASK_STATUSES = new Set([
  "claimed", "in_progress", "blocked", "review_requested", "changes_requested",
  "ready_to_integrate", "integrating", "needs_reconciliation",
]);
const REVIEW_VERDICTS = new Set(["pending", "approved", "changes_requested", "rejected", "blocked"]);
const REQUEST_TYPES = new Set(["question", "suggestion", "assistance", "blocker", "decision"]);
const REQUEST_STATUSES = new Set([
  "draft", "requested", "acknowledged", "answered", "completed", "accepted", "rejected", "cancelled",
]);
const OPEN_REQUEST_STATUSES = new Set(["draft", "requested", "acknowledged"]);
const EVIDENCE_RESULTS = new Set(["pass", "fail", "partial", "blocked", "not_run"]);
const REQUIREMENT_STATES = new Set([
  "planned", "in_progress", "implemented", "verified", "accepted", "deferred", "rejected", "superseded",
]);
const RISK_VALUES = new Set(["low", "medium", "high", "critical"]);

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) fail(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      index += 1;
    }
  }
  return { command, options };
}

function parseScalar(raw, file, lineNumber) {
  const value = raw.trim();
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value.startsWith("[") || value.startsWith("{") || value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(`${file}:${lineNumber}: invalid JSON-style scalar: ${error.message}`);
    }
  }
  if (/^[>|&*!]/.test(value)) {
    throw new Error(`${file}:${lineNumber}: unsupported YAML feature; use a quoted single-line value`);
  }
  return value;
}

function parseYamlSubset(text, file) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    if (rawLine.includes("\t")) throw new Error(`${file}:${index + 1}: tabs are not allowed`);
    const indent = rawLine.length - rawLine.trimStart().length;
    if (indent % 2 !== 0) throw new Error(`${file}:${index + 1}: indentation must use two spaces`);
    const content = rawLine.trim();
    const match = content.match(/^([A-Za-z0-9_.-]+):(?:\s+(.*))?$/);
    if (!match) throw new Error(`${file}:${index + 1}: unsupported YAML syntax`);

    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1);
    const expectedIndent = parent.indent < 0 ? 0 : parent.indent + 2;
    if (indent !== expectedIndent) {
      throw new Error(`${file}:${index + 1}: invalid indentation level`);
    }

    const [, key, rawValue] = match;
    if (Object.hasOwn(parent.value, key)) throw new Error(`${file}:${index + 1}: duplicate key ${key}`);
    if (rawValue === undefined || rawValue === "") {
      const child = {};
      parent.value[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent.value[key] = parseScalar(rawValue, file, index + 1);
    }
  }
  return root;
}

function serializeScalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(String(value));
}

function serializeYaml(value, indent = 0) {
  const lines = [];
  for (const [key, item] of Object.entries(value)) {
    const prefix = " ".repeat(indent) + key + ":";
    if (item && typeof item === "object" && !Array.isArray(item)) {
      lines.push(prefix);
      lines.push(serializeYaml(item, indent + 2));
    } else {
      lines.push(`${prefix} ${serializeScalar(item)}`);
    }
  }
  return lines.join("\n");
}

function parseMarkdownRecord(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  return { file, meta: parseYamlSubset(match[1], file), body: match[2], text };
}

function readYaml(file) {
  return parseYamlSubset(fs.readFileSync(file, "utf8"), file);
}

function listFiles(directory, extension) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function loadState(project) {
  const ledgerDir = path.join(project, ".project-ledger");
  const configFile = path.join(ledgerDir, "config.yaml");
  const requirementsFile = path.join(ledgerDir, "requirements.yaml");
  if (!fs.existsSync(configFile)) throw new Error(`Missing ${configFile}`);
  if (!fs.existsSync(requirementsFile)) throw new Error(`Missing ${requirementsFile}`);

  const readRecords = (name) => listFiles(path.join(ledgerDir, name), ".md").map(parseMarkdownRecord);
  const cursorFiles = listFiles(path.join(ledgerDir, "cursors"), ".yaml");
  return {
    project,
    ledgerDir,
    config: readYaml(configFile),
    requirements: readYaml(requirementsFile),
    phases: readRecords("phases"),
    tasks: readRecords("work-items"),
    reviews: readRecords("reviews"),
    requests: readRecords("requests"),
    evidence: readRecords("evidence"),
    cursors: cursorFiles.map((file) => ({ file, data: readYaml(file) })),
  };
}

function mapBy(records, key = "id") {
  return new Map(records.map((record) => [record.meta[key], record]));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function actorNames(state) {
  return Object.keys(state.config.actors || {});
}

function hasSections(record, names, errors) {
  for (const name of names) {
    const expression = new RegExp(`^## ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m");
    if (!expression.test(record.body)) errors.push(`${record.file}: missing section "## ${name}"`);
  }
}

function requireFields(record, fields, errors) {
  for (const field of fields) {
    if (record.meta[field] === undefined) errors.push(`${record.file}: missing field ${field}`);
  }
}

function runGit(project, args) {
  return spawnSync("git", ["-C", project, ...args], { encoding: "utf8", windowsHide: true });
}

function isGitRepository(project) {
  return runGit(project, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

function commitExists(project, commit) {
  if (!commit || !isGitRepository(project)) return false;
  return runGit(project, ["cat-file", "-e", `${commit}^{commit}`]).status === 0;
}

function staticPrefix(pattern) {
  const normalized = String(pattern).replaceAll("\\", "/").replace(/^\.\//, "");
  const wildcard = normalized.search(/[?*[]/);
  return (wildcard >= 0 ? normalized.slice(0, wildcard) : normalized).replace(/\/+$/, "");
}

function scopesOverlap(first, second) {
  const a = staticPrefix(first);
  const b = staticPrefix(second);
  if (!a || !b) return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function globRegex(pattern) {
  const normalized = String(pattern).replaceAll("\\", "/").replace(/^\.\//, "");
  let output = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*" && normalized[index + 1] === "*") {
      output += ".*";
      index += 1;
    } else if (char === "*") output += "[^/]*";
    else if (char === "?") output += "[^/]";
    else output += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${output}$`);
}

function validateState(state, { checkGit = true } = {}) {
  const errors = [];
  const warnings = [];
  const actors = new Set(actorNames(state));
  const phaseMap = mapBy(state.phases);
  const taskMap = mapBy(state.tasks);
  const requirementMap = state.requirements.requirements || {};
  const allRecords = [...state.phases, ...state.tasks, ...state.reviews, ...state.requests, ...state.evidence];

  if (state.config.protocol_version !== PROTOCOL_VERSION) {
    errors.push(`config.yaml: protocol_version must be ${PROTOCOL_VERSION}`);
  }
  if (!state.config.project_id || state.config.project_id === "replace-project-id") {
    errors.push("config.yaml: replace project_id with a stable project identifier");
  }
  if (!state.config.canonical?.branch) errors.push("config.yaml: canonical.branch is required");
  if (!state.config.active_phase) errors.push("config.yaml: active_phase is required");
  if (!phaseMap.has(state.config.active_phase)) errors.push(`config.yaml: unknown active_phase ${state.config.active_phase}`);
  if (actors.size < 2) warnings.push("config.yaml: multi-agent coordination normally requires at least two actors");

  const ids = new Map();
  for (const record of allRecords) {
    const id = record.meta.id;
    if (!id) continue;
    if (ids.has(id)) errors.push(`Duplicate record id ${id}: ${ids.get(id)} and ${record.file}`);
    ids.set(id, record.file);
    if (!Number.isInteger(record.meta.revision) || record.meta.revision < 1) {
      errors.push(`${record.file}: revision must be a positive integer`);
    }
    for (const actor of asArray(record.meta.notify)) {
      if (!actors.has(actor)) errors.push(`${record.file}: notify references unknown actor ${actor}`);
    }
  }

  for (const [id, requirement] of Object.entries(requirementMap)) {
    if (!requirement.title) errors.push(`requirements.yaml: ${id}.title is required`);
    if (/replace with/i.test(String(requirement.title))) errors.push(`requirements.yaml: ${id} still contains a bootstrap placeholder`);
    if (!phaseMap.has(requirement.phase)) errors.push(`requirements.yaml: ${id} references unknown phase ${requirement.phase}`);
    if (!REQUIREMENT_STATES.has(requirement.state)) errors.push(`requirements.yaml: ${id} has invalid state ${requirement.state}`);
    for (const taskId of asArray(requirement.work_items)) {
      if (!taskMap.has(taskId)) errors.push(`requirements.yaml: ${id} references unknown work item ${taskId}`);
    }
  }

  for (const phase of state.phases) {
    requireFields(phase, ["id", "title", "status", "revision", "acceptance_authority", "requirement_ids", "required_work_items", "optional_work_items", "notify", "updated_by", "updated_at"], errors);
    if (!PHASE_STATUSES.has(phase.meta.status)) errors.push(`${phase.file}: invalid phase status ${phase.meta.status}`);
    if (/replace with/i.test(phase.text)) errors.push(`${phase.file}: unresolved bootstrap placeholder`);
    if (!actors.has(phase.meta.acceptance_authority)) errors.push(`${phase.file}: unknown acceptance authority ${phase.meta.acceptance_authority}`);
    if (!actors.has(phase.meta.updated_by)) errors.push(`${phase.file}: unknown updated_by ${phase.meta.updated_by}`);
    for (const requirementId of asArray(phase.meta.requirement_ids)) {
      if (!requirementMap[requirementId]) errors.push(`${phase.file}: unknown requirement ${requirementId}`);
    }
    for (const taskId of [...asArray(phase.meta.required_work_items), ...asArray(phase.meta.optional_work_items)]) {
      if (!taskMap.has(taskId)) errors.push(`${phase.file}: unknown work item ${taskId}`);
    }
    if (phase.meta.status === "accepted") {
      if (phase.meta.accepted_by !== phase.meta.acceptance_authority || !phase.meta.accepted_at) {
        errors.push(`${phase.file}: accepted phase requires accepted_by authority and accepted_at`);
      }
      for (const taskId of asArray(phase.meta.required_work_items)) {
        if (taskMap.get(taskId)?.meta.status !== "accepted") errors.push(`${phase.file}: required work item ${taskId} is not accepted`);
      }
    }
    hasSections(phase, ["Goal", "Entry Criteria", "Included", "Excluded", "Output Goals", "Acceptance Criteria", "Rejection Criteria", "Current Progress", "Blockers", "Next Phase"], errors);
  }

  for (const task of state.tasks) {
    requireFields(task, ["id", "title", "phase", "status", "risk", "revision", "requirement_ids", "roles", "git", "scope", "dependencies", "notify", "updated_by", "updated_at"], errors);
    const meta = task.meta;
    if (!TASK_STATUSES.has(meta.status)) errors.push(`${task.file}: invalid task status ${meta.status}`);
    if (/replace with|replace\/with/i.test(task.text)) errors.push(`${task.file}: unresolved bootstrap placeholder`);
    if (!RISK_VALUES.has(meta.risk)) errors.push(`${task.file}: invalid risk ${meta.risk}`);
    if (!phaseMap.has(meta.phase)) errors.push(`${task.file}: unknown phase ${meta.phase}`);
    for (const requirementId of asArray(meta.requirement_ids)) {
      if (!requirementMap[requirementId]) errors.push(`${task.file}: unknown requirement ${requirementId}`);
    }
    const roles = meta.roles || {};
    for (const [role, names] of Object.entries({
      owner: [roles.owner], implementers: asArray(roles.implementers), reviewers: asArray(roles.reviewers), integrator: [roles.integrator],
    })) {
      for (const actor of names.filter(Boolean)) if (!actors.has(actor)) errors.push(`${task.file}: ${role} references unknown actor ${actor}`);
    }
    if (!roles.owner || !asArray(roles.implementers).length || !asArray(roles.reviewers).length || !roles.integrator) {
      errors.push(`${task.file}: owner, implementers, reviewers, and integrator are required`);
    }
    if (!Array.isArray(meta.scope?.write) || !Array.isArray(meta.scope?.read_only) || !Array.isArray(meta.scope?.forbidden)) {
      errors.push(`${task.file}: scope.write, scope.read_only, and scope.forbidden must be arrays`);
    }
    if (!Array.isArray(meta.dependencies?.requires) || !Array.isArray(meta.dependencies?.blocks)) {
      errors.push(`${task.file}: dependencies.requires and dependencies.blocks must be arrays`);
    }
    for (const dependency of [...asArray(meta.dependencies?.requires), ...asArray(meta.dependencies?.blocks)]) {
      if (!taskMap.has(dependency)) errors.push(`${task.file}: unknown dependency ${dependency}`);
      if (dependency === meta.id) errors.push(`${task.file}: work item cannot depend on itself`);
    }
    if (checkGit && isGitRepository(state.project)) {
      for (const [field, commit] of Object.entries({ base: meta.git?.base, head: meta.git?.head, integration_commit: meta.git?.integration_commit })) {
        if (commit && !commitExists(state.project, commit)) errors.push(`${task.file}: git.${field} does not resolve locally: ${commit}`);
      }
    }
    const evidenceForTask = state.evidence.filter((item) => item.meta.work_item === meta.id);
    const reviewsForTask = state.reviews.filter((item) => item.meta.work_item === meta.id);
    const blockingRequests = state.requests.filter((item) => item.meta.work_item === meta.id && item.meta.blocking && OPEN_REQUEST_STATUSES.has(item.meta.status));
    if (meta.status === "review_requested" && (!meta.git?.head || !evidenceForTask.some((item) => item.meta.commit === meta.git.head))) {
      errors.push(`${task.file}: review_requested requires git.head and evidence for that exact commit`);
    }
    if (["ready_to_integrate", "integrating", "integrated", "verified", "accepted"].includes(meta.status)) {
      if (!meta.git?.head || !reviewsForTask.some((item) => item.meta.verdict === "approved" && item.meta.reviewed_commit === meta.git.head)) {
        errors.push(`${task.file}: ${meta.status} requires an approved review of git.head`);
      }
    }
    if (["integrated", "verified", "accepted"].includes(meta.status) && !meta.git?.integration_commit) {
      errors.push(`${task.file}: ${meta.status} requires git.integration_commit`);
    }
    if (["verified", "accepted"].includes(meta.status)) {
      const targetCommit = meta.git?.integration_commit || meta.git?.head;
      if (!evidenceForTask.some((item) => item.meta.result === "pass" && item.meta.commit === targetCommit)) {
        errors.push(`${task.file}: ${meta.status} requires passing evidence for the integrated commit`);
      }
    }
    if (meta.status === "accepted") {
      const authority = phaseMap.get(meta.phase)?.meta.acceptance_authority;
      if (meta.accepted_by !== authority || !meta.accepted_at) errors.push(`${task.file}: accepted task requires phase authority accepted_by and accepted_at`);
      if (blockingRequests.length) errors.push(`${task.file}: accepted task has open blocking requests`);
    }
    hasSections(task, ["Objective", "Required Output", "Proposed Approach", "Constraints", "Acceptance Criteria", "Rejection Criteria", "Current Checkpoint", "Verification", "Skipped Checks", "Known Risks", "Open Communication", "Next Action", "Ownership Changes"], errors);
  }

  const activeTasks = state.tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.meta.status));
  for (let first = 0; first < activeTasks.length; first += 1) {
    for (let second = first + 1; second < activeTasks.length; second += 1) {
      for (const a of asArray(activeTasks[first].meta.scope?.write)) {
        for (const b of asArray(activeTasks[second].meta.scope?.write)) {
          if (scopesOverlap(a, b)) {
            errors.push(`Write-scope overlap: ${activeTasks[first].meta.id} (${a}) and ${activeTasks[second].meta.id} (${b})`);
          }
        }
      }
    }
  }

  for (const review of state.reviews) {
    requireFields(review, ["id", "work_item", "reviewer", "reviewed_commit", "verdict", "revision", "findings_count", "blocking_findings", "notify", "updated_at"], errors);
    if (!taskMap.has(review.meta.work_item)) errors.push(`${review.file}: unknown work item ${review.meta.work_item}`);
    if (!actors.has(review.meta.reviewer)) errors.push(`${review.file}: unknown reviewer ${review.meta.reviewer}`);
    if (!REVIEW_VERDICTS.has(review.meta.verdict)) errors.push(`${review.file}: invalid verdict ${review.meta.verdict}`);
    if (review.meta.reviewed_commit && checkGit && isGitRepository(state.project) && !commitExists(state.project, review.meta.reviewed_commit)) {
      errors.push(`${review.file}: reviewed_commit does not resolve locally`);
    }
    const task = taskMap.get(review.meta.work_item);
    if (task && !asArray(task.meta.roles?.reviewers).includes(review.meta.reviewer)) errors.push(`${review.file}: actor is not an assigned reviewer`);
    if (review.meta.verdict === "approved" && review.meta.blocking_findings !== 0) errors.push(`${review.file}: approved review cannot have blocking findings`);
    hasSections(review, ["Scope Reviewed", "Acceptance Checked", "Rejection Checked", "Findings", "Verdict Rationale", "Required Next Action"], errors);
  }

  for (const request of state.requests) {
    requireFields(request, ["id", "type", "work_item", "from", "to", "status", "blocking", "capability", "revision", "notify", "updated_at"], errors);
    if (!REQUEST_TYPES.has(request.meta.type)) errors.push(`${request.file}: invalid request type ${request.meta.type}`);
    if (!REQUEST_STATUSES.has(request.meta.status)) errors.push(`${request.file}: invalid request status ${request.meta.status}`);
    if (!taskMap.has(request.meta.work_item)) errors.push(`${request.file}: unknown work item ${request.meta.work_item}`);
    if (!actors.has(request.meta.from) || !actors.has(request.meta.to)) errors.push(`${request.file}: unknown request actor`);
    if (request.meta.type === "assistance" && !request.meta.capability) errors.push(`${request.file}: assistance requires capability`);
    hasSections(request, ["Context", "Request", "Expected Output", "Response", "Evidence", "Next Action"], errors);
  }

  for (const evidence of state.evidence) {
    requireFields(evidence, ["id", "work_item", "actor", "commit", "environment", "result", "revision", "notify", "recorded_at"], errors);
    if (!taskMap.has(evidence.meta.work_item)) errors.push(`${evidence.file}: unknown work item ${evidence.meta.work_item}`);
    if (!actors.has(evidence.meta.actor)) errors.push(`${evidence.file}: unknown actor ${evidence.meta.actor}`);
    if (!EVIDENCE_RESULTS.has(evidence.meta.result)) errors.push(`${evidence.file}: invalid result ${evidence.meta.result}`);
    if (evidence.meta.commit && checkGit && isGitRepository(state.project) && !commitExists(state.project, evidence.meta.commit)) {
      errors.push(`${evidence.file}: commit does not resolve locally`);
    }
    hasSections(evidence, ["Claim", "Commands", "Results", "Skipped", "Artifacts", "Limitations", "Safety"], errors);
  }

  const cursorActors = new Set();
  for (const cursor of state.cursors) {
    const actor = cursor.data.actor;
    if (!actors.has(actor)) errors.push(`${cursor.file}: unknown actor ${actor}`);
    if (cursorActors.has(actor)) errors.push(`${cursor.file}: duplicate cursor for ${actor}`);
    cursorActors.add(actor);
    if (!cursor.data.seen || typeof cursor.data.seen !== "object" || Array.isArray(cursor.data.seen)) errors.push(`${cursor.file}: seen must be a mapping`);
    for (const workItem of asArray(cursor.data.active_work_items)) if (!taskMap.has(workItem)) errors.push(`${cursor.file}: unknown active work item ${workItem}`);
  }
  for (const actor of actors) if (!cursorActors.has(actor)) errors.push(`Missing cursor for actor ${actor}`);

  return { errors, warnings };
}

function renderSummary(state) {
  const lines = [
    "<!-- GENERATED FILE: DO NOT EDIT MANUALLY -->",
    "",
    "# Project Ledger",
    "",
    "## Canonical Baseline",
    "",
    `- Project: \`${state.config.project_id}\``,
    `- Repository: \`${state.config.canonical?.repository || "."}\``,
    `- Branch: \`${state.config.canonical?.branch || "unknown"}\``,
    `- Commit: \`${state.config.canonical?.commit || "not recorded"}\``,
    `- Active phase: \`${state.config.active_phase}\``,
    `- Protocol: \`${state.config.protocol_version}\``,
    "",
    "## Phase Status",
    "",
    "| Phase | Title | Status | Authority |",
    "|---|---|---|---|",
  ];
  for (const phase of state.phases) lines.push(`| ${phase.meta.id} | ${phase.meta.title} | ${phase.meta.status} | ${phase.meta.acceptance_authority} |`);

  lines.push("", "## PRD Coverage", "", "| Requirement | Title | Phase | Work Items | State |", "|---|---|---|---|---|");
  for (const [id, requirement] of Object.entries(state.requirements.requirements || {})) {
    lines.push(`| ${id} | ${requirement.title} | ${requirement.phase} | ${asArray(requirement.work_items).join(", ") || "-"} | ${requirement.state} |`);
  }

  lines.push("", "## Active Work", "", "| ID | Work | Owner | Status | Branch | Depends On |", "|---|---|---|---|---|---|");
  const active = state.tasks.filter((task) => !["accepted", "deferred", "cancelled"].includes(task.meta.status));
  for (const task of active) {
    lines.push(`| ${task.meta.id} | ${task.meta.title} | ${task.meta.roles?.owner || "-"} | ${task.meta.status} | ${task.meta.git?.branch || "-"} | ${asArray(task.meta.dependencies?.requires).join(", ") || "-"} |`);
  }
  if (!active.length) lines.push("| - | No active work | - | - | - | - |");

  lines.push("", "## Review Queue", "", "| Work Item | Commit | Assigned Reviewers | Current Verdict |", "|---|---|---|---|");
  const reviewTasks = state.tasks.filter((task) => task.meta.status === "review_requested");
  for (const task of reviewTasks) {
    const latest = state.reviews.filter((review) => review.meta.work_item === task.meta.id).sort((a, b) => b.meta.revision - a.meta.revision)[0];
    lines.push(`| ${task.meta.id} | ${task.meta.git?.head || "-"} | ${asArray(task.meta.roles?.reviewers).join(", ")} | ${latest?.meta.verdict || "pending"} |`);
  }
  if (!reviewTasks.length) lines.push("| - | - | No pending review | - |");

  lines.push("", "## Open Requests", "", "| ID | Type | Work Item | From | To | Blocking | Status |", "|---|---|---|---|---|---|---|");
  const openRequests = state.requests.filter((request) => OPEN_REQUEST_STATUSES.has(request.meta.status));
  for (const request of openRequests) {
    lines.push(`| ${request.meta.id} | ${request.meta.type} | ${request.meta.work_item} | ${request.meta.from} | ${request.meta.to} | ${request.meta.blocking} | ${request.meta.status} |`);
  }
  if (!openRequests.length) lines.push("| - | - | - | - | - | - | No open requests |");

  lines.push("", "## Integration Queue", "");
  const integration = state.tasks.filter((task) => ["ready_to_integrate", "integrating"].includes(task.meta.status));
  if (integration.length) for (const task of integration) lines.push(`- ${task.meta.id}: ${task.meta.title} (${task.meta.roles?.integrator})`);
  else lines.push("- Empty.");

  lines.push("", "## Blockers", "");
  const blockedTasks = state.tasks.filter((task) => ["blocked", "needs_reconciliation"].includes(task.meta.status));
  const blockingRequests = openRequests.filter((request) => request.meta.blocking);
  if (!blockedTasks.length && !blockingRequests.length) lines.push("- None recorded.");
  for (const task of blockedTasks) lines.push(`- ${task.meta.id}: ${task.meta.status}; see its Current Checkpoint and Next Action.`);
  for (const request of blockingRequests) lines.push(`- ${request.meta.id}: blocks ${request.meta.work_item}; ${request.meta.from} -> ${request.meta.to}.`);

  lines.push("", "## Recently Accepted", "");
  const accepted = state.tasks.filter((task) => task.meta.status === "accepted").sort((a, b) => String(b.meta.accepted_at).localeCompare(String(a.meta.accepted_at))).slice(0, 10);
  if (accepted.length) for (const task of accepted) lines.push(`- ${task.meta.id}: ${task.meta.title} at ${task.meta.git?.integration_commit || task.meta.git?.head}.`);
  else lines.push("- None recorded.");

  lines.push("", "## Actor Checkpoints", "", "| Actor | Active Work | Waiting For | Next Action |", "|---|---|---|---|");
  for (const cursor of state.cursors) {
    lines.push(`| ${cursor.data.actor} | ${asArray(cursor.data.active_work_items).join(", ") || "-"} | ${asArray(cursor.data.waiting_for).join(", ") || "-"} | ${String(cursor.data.next_action || "-").replaceAll("|", "\\|")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function copyDirectory(source, destination, replacements) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, destinationPath, replacements);
    else {
      let content = fs.readFileSync(sourcePath, "utf8");
      for (const [from, to] of replacements) content = content.replaceAll(from, to);
      fs.writeFileSync(destinationPath, content, "utf8");
    }
  }
}

function initialize(project) {
  const ledgerDir = path.join(project, ".project-ledger");
  const protocolFile = path.join(project, "AGENT_LEDGER_PROTOCOL.md");
  if (fs.existsSync(ledgerDir) || fs.existsSync(protocolFile)) {
    fail("Initialization refused: an existing ledger or project protocol was found.");
  }
  fs.mkdirSync(project, { recursive: true });
  const now = new Date().toISOString();
  const projectId = path.basename(path.resolve(project)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  copyDirectory(ASSET_PROJECT, ledgerDir, [["replace-project-id", projectId], ["2026-01-01T00:00:00Z", now]]);
  fs.copyFileSync(PROTOCOL_SOURCE, protocolFile);
  fs.copyFileSync(path.join(TEMPLATE_DIR, "PROJECT_LEDGER.md"), path.join(project, "PROJECT_LEDGER.md"));
  for (const directory of ["reviews", "requests", "evidence", "cursors"]) fs.mkdirSync(path.join(ledgerDir, directory), { recursive: true });

  const config = readYaml(path.join(ledgerDir, "config.yaml"));
  for (const actor of Object.keys(config.actors || {})) {
    const cursor = {
      actor,
      last_seen_canonical_commit: null,
      active_work_items: [],
      waiting_for: [],
      pending_requests: [],
      checkpoint_work_item: null,
      checkpoint_commit: null,
      checkpoint_result: "Not started",
      next_action: "Inspect inbox and assigned work",
      seen: { "PHASE-1": 0 },
      updated_at: now,
    };
    fs.writeFileSync(path.join(ledgerDir, "cursors", `${actor}.yaml`), `${serializeYaml(cursor)}\n`, "utf8");
  }

  const agentsFile = path.join(project, "AGENTS.md");
  const snippet = path.join(ledgerDir, "AGENTS-ledger-snippet.md");
  if (!fs.existsSync(agentsFile)) fs.copyFileSync(snippet, agentsFile);
  else process.stdout.write(`Existing AGENTS.md preserved. Merge this pointer manually: ${snippet}\n`);

  const state = loadState(project);
  fs.writeFileSync(path.join(project, state.config.generated_summary), `${renderSummary(state)}\n`, "utf8");
  process.stdout.write(`Initialized ledger protocol ${PROTOCOL_VERSION} at ${project}\n`);
  process.stdout.write("Bootstrap records contain intentional placeholders. Reconcile them from the PRD, Git, and current work before validation or source work.\n");
}

function formatValidation(result) {
  const lines = [];
  for (const warning of result.warnings) lines.push(`WARN: ${warning}`);
  for (const error of result.errors) lines.push(`ERROR: ${error}`);
  lines.push(result.errors.length ? `INVALID: ${result.errors.length} error(s), ${result.warnings.length} warning(s)` : `VALID: ${result.warnings.length} warning(s)`);
  return lines.join("\n");
}

function findCursor(state, actor) {
  return state.cursors.find((cursor) => cursor.data.actor === actor);
}

function collectInbox(state, actor) {
  const cursor = findCursor(state, actor);
  if (!cursor) fail(`No cursor found for actor ${actor}`);
  const records = [...state.phases, ...state.tasks, ...state.reviews, ...state.requests, ...state.evidence];
  return records.filter((record) => {
    const notified = asArray(record.meta.notify).includes(actor);
    const targeted = record.meta.to === actor && OPEN_REQUEST_STATUSES.has(record.meta.status);
    const seenRevision = Number(cursor.data.seen?.[record.meta.id] || 0);
    return (notified || targeted) && Number(record.meta.revision || 0) > seenRevision;
  }).sort((a, b) => String(a.meta.updated_at || a.meta.recorded_at).localeCompare(String(b.meta.updated_at || b.meta.recorded_at)));
}

function acknowledge(state, actor, recordId) {
  const cursor = findCursor(state, actor);
  if (!cursor) fail(`No cursor found for actor ${actor}`);
  const records = [...state.phases, ...state.tasks, ...state.reviews, ...state.requests, ...state.evidence];
  const record = records.find((item) => item.meta.id === recordId);
  if (!record) fail(`Unknown record ${recordId}`);
  if (!asArray(record.meta.notify).includes(actor) && record.meta.to !== actor) fail(`${recordId} does not notify ${actor}`);
  cursor.data.seen ||= {};
  cursor.data.seen[recordId] = record.meta.revision;
  cursor.data.updated_at = new Date().toISOString();
  fs.writeFileSync(cursor.file, `${serializeYaml(cursor.data)}\n`, "utf8");
  process.stdout.write(`Acknowledged ${recordId}@${record.meta.revision} for ${actor}\n`);
}

function changedPaths(project) {
  const result = runGit(project, ["status", "--porcelain=v1", "--untracked-files=all"]);
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const value = line.slice(3).trim();
    const destination = value.includes(" -> ") ? value.split(" -> ").at(-1) : value;
    return destination.replace(/^"|"$/g, "").replaceAll("\\", "/");
  });
}

function preflight(state, actor, workItemId, mode, requestId) {
  const validation = validateState(state);
  if (validation.errors.length) fail(formatValidation(validation));
  if (!actorNames(state).includes(actor)) fail(`Unknown actor ${actor}`);
  const task = state.tasks.find((item) => item.meta.id === workItemId);
  if (!task) fail(`Unknown work item ${workItemId}`);
  const roles = task.meta.roles;

  if (mode === "work" && !asArray(roles.implementers).includes(actor)) fail(`${actor} is not an implementer for ${workItemId}`);
  if (mode === "review" && !asArray(roles.reviewers).includes(actor)) fail(`${actor} is not a reviewer for ${workItemId}`);
  if (mode === "integrate" && roles.integrator !== actor) fail(`${actor} is not the integrator for ${workItemId}`);
  if (mode === "assist") {
    const request = state.requests.find((item) => item.meta.id === requestId);
    if (!request || request.meta.type !== "assistance" || request.meta.work_item !== workItemId || request.meta.to !== actor) {
      fail(`A matching assistance request assigned to ${actor} is required`);
    }
  }

  const dependencies = asArray(task.meta.dependencies?.requires);
  for (const dependencyId of dependencies) {
    const dependency = state.tasks.find((item) => item.meta.id === dependencyId);
    if (!["integrated", "verified", "accepted"].includes(dependency?.meta.status)) fail(`Dependency ${dependencyId} is ${dependency?.meta.status || "missing"}`);
  }
  const blocking = state.requests.filter((item) => item.meta.work_item === workItemId && item.meta.blocking && OPEN_REQUEST_STATUSES.has(item.meta.status));
  if (blocking.length && mode !== "assist") fail(`Blocking request(s) open: ${blocking.map((item) => item.meta.id).join(", ")}`);

  if (isGitRepository(state.project)) {
    if (task.meta.git?.base && !commitExists(state.project, task.meta.git.base)) fail(`Base commit does not resolve: ${task.meta.git.base}`);
    if (mode === "work") {
      const branchResult = runGit(state.project, ["branch", "--show-current"]);
      const branch = branchResult.stdout.trim();
      if (task.meta.git?.branch && branch !== task.meta.git.branch) fail(`Current branch ${branch || "(detached)"} does not match ${task.meta.git.branch}`);
      const patterns = asArray(task.meta.scope?.write).map(globRegex);
      const protectedCoordination = [".project-ledger/", "PROJECT_LEDGER.md", "AGENT_LEDGER_PROTOCOL.md", "AGENTS.md"];
      const outside = changedPaths(state.project).filter((file) => !protectedCoordination.some((prefix) => file === prefix || file.startsWith(prefix)) && !patterns.some((pattern) => pattern.test(file)));
      if (outside.length) fail(`Dirty paths outside ${workItemId} write scope:\n${outside.map((file) => `- ${file}`).join("\n")}`);
    }
  }

  process.stdout.write(`PREFLIGHT PASS: ${actor} may ${mode} ${workItemId}\n`);
}

function printHelp() {
  process.stdout.write(`Multi-Agent Project Ledger protocol ${PROTOCOL_VERSION}\n\n`);
  process.stdout.write("Commands:\n");
  process.stdout.write("  init --project <path>\n");
  process.stdout.write("  validate --project <path> [--no-git]\n");
  process.stdout.write("  generate --project <path>\n");
  process.stdout.write("  status --project <path>\n");
  process.stdout.write("  inbox --project <path> --actor <actor>\n");
  process.stdout.write("  ack --project <path> --actor <actor> --record <id>\n");
  process.stdout.write("  preflight --project <path> --actor <actor> --work-item <id> [--mode work|review|assist|integrate] [--request <id>]\n");
}

const { command, options } = parseArgs(process.argv.slice(2));
const project = path.resolve(String(options.project || "."));

try {
  if (command === "help" || command === "--help") printHelp();
  else if (command === "init") initialize(project);
  else {
    const state = loadState(project);
    if (command === "validate") {
      const result = validateState(state, { checkGit: !options["no-git"] });
      process.stdout.write(`${formatValidation(result)}\n`);
      if (result.errors.length) process.exitCode = 1;
    } else if (command === "generate") {
      const result = validateState(state);
      if (result.errors.length) fail(formatValidation(result));
      const destination = path.join(project, state.config.generated_summary);
      fs.writeFileSync(destination, `${renderSummary(state)}\n`, "utf8");
      process.stdout.write(`Generated ${destination}\n`);
    } else if (command === "status") {
      const result = validateState(state);
      if (result.errors.length) fail(formatValidation(result));
      process.stdout.write(`${renderSummary(state)}\n`);
    } else if (command === "inbox") {
      if (!options.actor) fail("inbox requires --actor");
      const result = validateState(state);
      if (result.errors.length) fail(formatValidation(result));
      const inbox = collectInbox(state, String(options.actor));
      if (!inbox.length) process.stdout.write(`No actionable ledger updates for ${options.actor}.\n`);
      else for (const record of inbox) {
        process.stdout.write(`${record.meta.id}@${record.meta.revision} ${record.meta.status || record.meta.result || record.meta.verdict || "updated"} ${path.relative(project, record.file)}\n`);
      }
    } else if (command === "ack") {
      if (!options.actor || !options.record) fail("ack requires --actor and --record");
      acknowledge(state, String(options.actor), String(options.record));
    } else if (command === "preflight") {
      if (!options.actor || !options["work-item"]) fail("preflight requires --actor and --work-item");
      const mode = String(options.mode || "work");
      if (!["work", "review", "assist", "integrate"].includes(mode)) fail(`Unknown preflight mode ${mode}`);
      preflight(state, String(options.actor), String(options["work-item"]), mode, options.request ? String(options.request) : null);
    } else fail(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(`Ledger error: ${error.message}`);
}
