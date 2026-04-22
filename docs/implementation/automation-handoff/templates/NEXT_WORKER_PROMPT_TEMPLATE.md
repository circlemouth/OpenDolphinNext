# NEXT_WORKER_PROMPT

status: active
created_at: YYYY-MM-DD
source_work_order: WO-or-RWO-id
blocker_id: short-kebab-case-id
priority: high|medium|low

## Context

Describe the blocker, the exact evidence source, and why the previous worker stopped.

## Goal

State the single blocker-resolution goal for the next worker.

## Allowed Actions

- List permitted reads, edits, commands, and verification steps.

## Forbidden Actions

- List task-specific prohibitions.
- Always inherit the global safety floor from `docs/implementation/automation-handoff/README.md`.

## Required Evidence

- Sanitized command log.
- Files changed.
- Tests/checks run.
- Secret/raw-artifact scan if package or live evidence is involved.

## Completion Criteria

- Define exactly when this prompt is complete.

## Stop Conditions

- Define when the worker must stop and create a new prompt.

## Final Report Requirements

- State what the worker must report.
