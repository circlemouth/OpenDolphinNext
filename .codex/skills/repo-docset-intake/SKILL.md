---
name: repo-docset-intake
description: Place a received document set into the appropriate location in this repository, preserve its structure, rewrite internal references to the actual in-repo destination, update the relevant docs indexes, and when requested commit only the intake-related changes.
---

# Repo Docset Intake

Use this skill when a user provides a document bundle from `Downloads/` or another staging area and asks to place it in this repository, especially when they also want the moved bundle's internal file paths aligned with the real repo location and the intake committed.

## Goal

- choose the correct destination in this repo from the document content, not just the incoming folder name
- preserve the bundle structure unless there is a clear repo convention that requires flattening
- rewrite path-like references so they point at the moved repo location
- update the relevant index docs when the new set should be reachable from the repo's current doc entrypoints
- if the user asks for a commit, stage and commit only the intake-related files without touching unrelated worktree changes

## Placement Rules

Choose the destination by document role:

- `docs/implementation/`: dated workstream packages, prompts, workplans, remediation packets, handoff bundles still relevant to active implementation
- `docs/archive/`: historical closeout packets, old handoffs, superseded review bundles, no longer current execution docs
- `docs/reference/`: background research and non-authoritative reference material
- `docs/contracts/`: current API/runtime/storage/health contracts
- `docs/architecture/`: enduring design decisions and architecture summaries
- `docs/runbooks/`: executable validation or release procedures
- `docs/operations/`: operational procedures and environment-specific instructions
- `docs/managerdocs/`: manager-facing current-state and decision materials
- `web-client/notes/`: current web-client contract notes
- `docs/web-client/ux/` or `docs/web-client/architecture/`: enduring UI or web-client design references

If the set mixes multiple roles, prefer the dominant role and keep the bundle together unless splitting is clearly safer and preserves intent.

## Repo-specific defaults

- Read `docs/README.md` and the nearest local index before deciding placement.
- For dated workstream packets in `docs/implementation/`, add the new packet to both:
  - `docs/README.md`
  - `docs/implementation/README.md`
- For manager-facing current-state sets in `docs/managerdocs/`, update `docs/README.md` and `docs/managerdocs/README.md` when the new set should be discoverable.
- Prefer repo-root relative paths such as `docs/...`, `web-client/...`, `server-modernized/...` inside the moved files.
- When a moved bundle refers to files inside itself, rewrite bare filenames to the actual in-repo path when the surrounding text is meant to be copy-paste safe for future agents.

## Workflow

1. Inspect the incoming bundle root name, file list, and representative files.
2. Read `docs/README.md`, `docs/implementation/README.md`, `docs/managerdocs/README.md`, and `web-client/README.md` as needed to match the repo taxonomy.
3. Choose the destination directory that best matches the bundle's role.
4. Copy the bundle into the repo while preserving its internal structure.
5. Rewrite path-like references inside the moved files:
   - replace staging absolute paths such as `Downloads/...` with repo-relative paths
   - replace old bundle root mentions when the destination path changed
   - keep references to other existing repo documents aligned with their real repo paths
   - fix wording that still assumes "unpack this zip into repo root" when the bundle is already placed in-repo
   - rewrite self-references to actual in-repo paths when bare names such as `01_task_split.md` or `06_final_report_template.md` would be ambiguous after intake
6. Update index docs only when the new bundle should be discoverable from current repo entrypoints.
7. Verify no stale staging paths remain and that the destination paths referenced in the bundle actually exist or are intentionally future-facing.
8. If the user requested a commit, stage only the new bundle and directly related index/path-alignment edits, then commit them separately from unrelated worktree changes.

## Editing Rules

- prefer minimal edits; do not rewrite document substance just to normalize prose
- preserve filenames unless there is a repo naming conflict or an explicit repo convention to follow
- keep dated package directories intact
- do not invent new source-of-truth claims; only relocate and align references
- if a path target is unknown, leave the surrounding meaning intact and make the smallest accurate correction possible
- if the repository already has unrelated dirty changes, do not stage or revert them

## Verification

- search for stale staging paths such as `Downloads/`, absolute local paths, or the old bundle root
- confirm moved self-references and repo-internal references are consistent with the final destination
- update `docs/README.md` and the closest local index when the new set belongs in the current documentation flow
- review `git diff --check` before finishing
- when committing, verify `git status --short` still shows unrelated changes as unstaged

## Minimal command pattern

- inspect source bundle with `find` and `sed`
- copy with `cp -R`
- verify references with `rg`
- review only intake diffs with `git diff -- <paths>`
- commit only intake files with `git add <intake-paths>` followed by a focused `git commit`
