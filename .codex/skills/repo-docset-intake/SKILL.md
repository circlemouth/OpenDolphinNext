---
name: repo-docset-intake
description: Place a received document set into the appropriate location in this repository based on its content, preserve its internal structure, rewrite moved path references to the new repo path, and update docs indexes when the new set should be reachable from current documentation.
---

# Repo Docset Intake

Use this skill when a user provides a document bundle from `Downloads/` or another staging area and asks to place it in this repository.

## Goal

- choose the correct destination in this repo from the document content, not just the incoming folder name
- preserve the bundle structure unless there is a clear repo convention that requires flattening
- rewrite path-like references so they point at the moved repo location
- update the relevant index docs when the new set should be reachable from the repo's current doc entrypoints

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
6. Update index docs only when the new bundle should be discoverable from current repo entrypoints.
7. Verify no stale staging paths remain and that the destination paths referenced in the bundle actually exist or are intentionally future-facing.

## Editing Rules

- prefer minimal edits; do not rewrite document substance just to normalize prose
- preserve filenames unless there is a repo naming conflict or an explicit repo convention to follow
- keep dated package directories intact
- do not invent new source-of-truth claims; only relocate and align references
- if a path target is unknown, leave the surrounding meaning intact and make the smallest accurate correction possible

## Verification

- search for stale staging paths such as `Downloads/`, absolute local paths, or the old bundle root
- confirm moved self-references and repo-internal references are consistent with the final destination
- update `docs/README.md` and the closest local index when the new set belongs in the current documentation flow
- review `git diff --check` before finishing
