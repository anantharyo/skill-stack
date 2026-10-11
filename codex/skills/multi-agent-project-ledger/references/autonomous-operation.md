# Autonomous Ledger Checks

Use this reference only for scheduled, unattended, or explicitly autonomous ledger checks.

## Scheduling Boundary

This skill never creates a scheduler, daemon, file watcher, or cron job by itself. The user controls when Codex and Antigravity are scheduled. A scheduled invocation reads shared repository state exactly like a new session.

## Scheduled Check Procedure

1. Identify the configured actor exactly.
2. Validate the ledger.
3. Read `PROJECT_LEDGER.md`, the actor cursor, and actor inbox.
4. Verify Git state before trusting a mutable task record.
5. Handle only records assigned to or notifying that actor.
6. Run preflight before any mutation.
7. Respect task ownership, scope, authorization, dependencies, and external-access boundaries.
8. Update only records owned by the actor or response fields explicitly assigned to it.
9. Checkpoint, validate, regenerate, and update the actor cursor after meaningful work.
10. Remain quiet when nothing actionable changed.

## Autonomous Actions Allowed by Existing Assignment

- Continue an already claimed work item within its accepted scope.
- Review an exact commit when assigned as reviewer.
- Answer a question directed to the actor.
- Complete a bounded assistance request using capabilities already authorized for the project.
- Integrate only when assigned as integrator and all gates pass.
- Record a blocker, failed validation, or reconciliation need.

## Actions Requiring New Direction

- Expanding product scope or changing PRD intent.
- Taking ownership from another actor.
- Resolving a product decision not delegated by the user or acceptance authority.
- Performing an external mutation not already authorized by the work item or request.
- Weakening acceptance or rejection criteria.
- Ignoring an ownership conflict, failed validator, or unverified environment claim.

## Suggested Scheduler Prompt

```text
Use $multi-agent-project-ledger as actor <actor>. Validate the shared ledger, inspect only new actionable inbox records and assigned work, and continue authorized work within recorded ownership and scope. Remain quiet if nothing actionable changed. Never infer takeover, widen scope, or weaken acceptance criteria. Checkpoint, validate, and regenerate the ledger after meaningful progress.
```

