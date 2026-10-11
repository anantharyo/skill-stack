---
name: multi-agent-project-ledger
description: Coordinate multiple coding agents across sessions with a shared repository ledger, explicit phase and task ownership, scoped parallel work, reviews, questions, assistance requests, evidence, and resumable checkpoints. Use for long-running multi-agent projects, handoffs, progress tracking, autonomous ledger checks, or cross-agent review and integration.
metadata:
  short-description: Coordinate agents with a shared project ledger
---

# Multi-Agent Project Ledger

Use the repository ledger as durable coordination memory. Chat history and agent-local memory are never project authority.

## Required Reading

Before acting, read [references/ledger-protocol.md](references/ledger-protocol.md) completely.

- For initialization, record creation, mutation, validation, or integration, also read [references/record-schema.md](references/record-schema.md).
- For scheduled or unattended checks, also read [references/autonomous-operation.md](references/autonomous-operation.md).

When a repository already contains `AGENT_LEDGER_PROTOCOL.md`, that checked-in protocol is authoritative for the project when it is compatible with this skill's protocol version. Stop and request reconciliation if versions conflict.

## Operating Modes

Choose the narrow mode implied by the request:

- **Initialize:** create the shared protocol and ledger structure with `node scripts/ledger.mjs init --project <path>`; never overwrite existing project instructions or ledger data. Replace every bootstrap placeholder from the real PRD, Git state, actors, phases, and assignments before work begins.
- **Resume:** validate, read the generated project summary, actor cursor, active phase, assigned work items, inbox, Git state, and exact next action.
- **Work:** run preflight for the actor and work item before editing; remain inside the declared write scope; checkpoint meaningful progress.
- **Review:** inspect the exact submitted commit and write a separate review record; do not modify the implementer's code while acting only as reviewer.
- **Assist:** perform only the bounded action in an assistance request and record sanitized evidence; do not take ownership implicitly.
- **Integrate:** require valid review, satisfied dependencies, current baseline, integration verification, and an integration commit before completion.
- **Monitor:** inspect the actor inbox and current blockers; stay quiet when no actionable record changed. Monitoring never starts itself and requires the user's scheduler or invocation.

## Mandatory Commands

Run commands from the repository root using this skill's script path:

```text
node <skill>/scripts/ledger.mjs validate --project .
node <skill>/scripts/ledger.mjs status --project .
node <skill>/scripts/ledger.mjs inbox --project . --actor <actor>
node <skill>/scripts/ledger.mjs preflight --project . --actor <actor> --work-item <id>
node <skill>/scripts/ledger.mjs generate --project .
```

Validation is mandatory before work and after ledger mutation. Preflight is mandatory before source edits, review, assistance execution, or integration.

## Non-Negotiable Rules

- One project has one shared ledger. Agents have separate cursors, assignments, review records, and bounded write ownership.
- Roles belong to work items, not permanently to agent names.
- Never edit source paths claimed by another active work item.
- Never alter another actor's cursor, implementation evidence, or review record.
- Never take over, widen scope, change a shared contract, or reassign ownership silently.
- Review exact immutable commits. A branch name alone is not review evidence.
- Distinguish implemented, integrated, verified, deployed, and accepted.
- Preserve unresolved questions, blockers, rejected criteria, skipped checks, and external prerequisites.
- Store no secrets, raw credentials, auth material, private request bodies, or unsafe logs.
- Logs hold execution detail; ledger records hold durable facts, decisions, evidence summaries, and next actions.
- `PROJECT_LEDGER.md` is generated and must not be manually edited.
- Do not create timestamped handoff documents for ordinary task transitions. ADRs, external audits, release reports, and postmortems remain separate artifacts when genuinely required.

## Stop Conditions

Do not continue mutation when validation fails, ownership is ambiguous, write scopes overlap, the canonical baseline is unresolved, a blocking request is open, required access is absent, or the checked-out worktree contains another actor's unexplained changes. Record the blocker or reconciliation request instead.
