# Ledger Record Schema

Protocol version: `1`

## Serialization

Project records use Markdown with strict YAML-like frontmatter or standalone `config.yaml` and `requirements.yaml`. The bundled parser intentionally supports a safe subset:

- two-space-indented mappings;
- strings, integers, booleans, and `null`;
- JSON-style inline arrays such as `["codex", "antigravity"]`;
- no anchors, tags, aliases, block arrays, multiline scalar syntax, or executable values.

Narrative belongs in Markdown sections after frontmatter. Keep frontmatter values single-line and quote paths containing `*`, `#`, `:`, or backslashes.

Every mutable record has a local positive integer `revision`. Increment it whenever the record changes. Records notify actors through `notify`. Each actor cursor stores the latest seen revision per record ID.

## Configuration

Required `config.yaml` fields:

```yaml
protocol_version: 1
project_id: "project-id"
canonical:
  repository: "."
  branch: "main"
  commit: null
active_phase: "PHASE-1"
generated_summary: "PROJECT_LEDGER.md"
actors:
  codex:
    capabilities: ["repository"]
  antigravity:
    capabilities: ["repository"]
```

Capabilities route assistance and do not assign ownership.

## Requirements

`requirements.yaml` maps stable PRD IDs to current coverage:

```yaml
requirements:
  REQ-EXAMPLE-001:
    title: "Example requirement"
    phase: "PHASE-1"
    work_items: ["TASK-001"]
    state: "planned"
```

Allowed requirement states: `planned`, `in_progress`, `implemented`, `verified`, `accepted`, `deferred`, `rejected`, `superseded`.

## Phase Record

Required frontmatter:

```yaml
id: "PHASE-1"
title: "Phase title"
status: "active"
revision: 1
acceptance_authority: "codex"
accepted_by: null
accepted_at: null
requirement_ids: ["REQ-EXAMPLE-001"]
required_work_items: ["TASK-001"]
optional_work_items: []
notify: ["codex", "antigravity"]
updated_by: "codex"
updated_at: "2026-01-01T00:00:00Z"
```

Required sections: `Goal`, `Entry Criteria`, `Included`, `Excluded`, `Output Goals`, `Acceptance Criteria`, `Rejection Criteria`, `Current Progress`, `Blockers`, `Next Phase`.

## Work-Item Record

Required frontmatter:

```yaml
id: "TASK-001"
title: "Task title"
phase: "PHASE-1"
status: "ready"
risk: "medium"
revision: 1
accepted_by: null
accepted_at: null
requirement_ids: ["REQ-EXAMPLE-001"]
roles:
  owner: "antigravity"
  implementers: ["antigravity"]
  reviewers: ["codex"]
  integrator: "codex"
git:
  base: null
  branch: "antigravity/task-001"
  head: null
  integration_commit: null
scope:
  write: ["apps/web/**"]
  read_only: ["packages/contracts/**"]
  forbidden: ["apps/api/**"]
dependencies:
  requires: []
  blocks: []
notify: ["antigravity"]
updated_by: "antigravity"
updated_at: "2026-01-01T00:00:00Z"
```

Required sections: `Objective`, `Required Output`, `Proposed Approach`, `Constraints`, `Acceptance Criteria`, `Rejection Criteria`, `Current Checkpoint`, `Verification`, `Skipped Checks`, `Known Risks`, `Open Communication`, `Next Action`, `Ownership Changes`.

Risk values: `low`, `medium`, `high`, `critical`.

## Review Record

Required frontmatter:

```yaml
id: "REVIEW-TASK-001-CODEX-001"
work_item: "TASK-001"
reviewer: "codex"
reviewed_commit: "0123456789abcdef0123456789abcdef01234567"
verdict: "changes_requested"
revision: 1
findings_count: 1
blocking_findings: 1
notify: ["antigravity"]
updated_at: "2026-01-01T00:00:00Z"
```

Verdicts: `pending`, `approved`, `changes_requested`, `rejected`, `blocked`.

Required sections: `Scope Reviewed`, `Acceptance Checked`, `Rejection Checked`, `Findings`, `Verdict Rationale`, `Required Next Action`.

Each finding includes stable ID, severity, location, problem, required outcome, suggested solution when useful, and resolution state.

## Request Record

Required frontmatter:

```yaml
id: "REQUEST-001"
type: "assistance"
work_item: "TASK-001"
from: "antigravity"
to: "codex"
status: "requested"
blocking: true
capability: "supabase"
revision: 1
notify: ["codex"]
updated_at: "2026-01-01T00:00:00Z"
```

Types: `question`, `suggestion`, `assistance`, `blocker`, `decision`.

Statuses: `draft`, `requested`, `acknowledged`, `answered`, `completed`, `accepted`, `rejected`, `cancelled`.

Required sections: `Context`, `Request`, `Expected Output`, `Response`, `Evidence`, `Next Action`.

## Evidence Record

Required frontmatter:

```yaml
id: "EVIDENCE-TASK-001-001"
work_item: "TASK-001"
actor: "antigravity"
commit: "0123456789abcdef0123456789abcdef01234567"
environment: "local"
result: "pass"
revision: 1
notify: ["codex"]
recorded_at: "2026-01-01T00:00:00Z"
```

Result values: `pass`, `fail`, `partial`, `blocked`, `not_run`.

Required sections: `Claim`, `Commands`, `Results`, `Skipped`, `Artifacts`, `Limitations`, `Safety`.

## Actor Cursor

Each actor owns exactly one cursor file:

```yaml
actor: "codex"
last_seen_canonical_commit: null
active_work_items: []
waiting_for: []
pending_requests: []
checkpoint_work_item: null
checkpoint_commit: null
checkpoint_result: "Not started"
next_action: "Inspect inbox and assigned work"
seen:
  PHASE-1: 0
updated_at: "2026-01-01T00:00:00Z"
```

The cursor may be stale and never overrides Git or validated records.

## Status Requirements

- `review_requested` requires `git.head` and at least one evidence record for that commit.
- `ready_to_integrate` requires an approved review of the exact `git.head`.
- `integrated` requires `git.integration_commit`.
- `verified` requires passing evidence for the integration commit or explicitly documented environment mapping.
- `accepted` requires verified evidence, approved exact-commit review, no open blocking request, and acceptance authority confirmation.
- An accepted phase requires all required work items accepted and no active rejection criterion.

## Path Ownership

Write scopes are repository-relative slash-separated paths. Prefer narrow directory or file patterns. Broad patterns such as `**`, `apps/**`, or repository root require explicit user or integrator approval in `Ownership Changes`.

The validator conservatively treats scopes as overlapping when their static prefixes contain one another. Split or serialize ambiguous scopes rather than bypassing the check.
