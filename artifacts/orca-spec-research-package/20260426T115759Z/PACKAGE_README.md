# ORCA Spec Research Package

RUN_ID: `20260426T115759Z`

This package is a sanitized context bundle for ChatGPT-based ORCA specification research.

## Repo State

- Repository: `OpenDolphin_WebClient`
- Branch: `master`
- HEAD: `ba180009b`
- Current scope: Trial-backed, non-S3 release-readiness progress.
- ORCA target: WebORCA / ORCA Trial only.
- Production ORCA: out of scope.
- S3 / MinIO / object storage: out of scope.

## Safety Boundary

The package intentionally excludes:

- credentials, passwords, cookies, Authorization headers, sessions, CSRF tokens
- raw ORCA request/response bodies
- raw patient/insurance details
- HAR, traces, videos, screenshots, raw network dumps
- production ORCA materials
- S3/MinIO/object-storage configuration

Do not request or infer those values in the research response.

## How To Use

1. Read `CHATGPT_ORCA_SPEC_RESEARCH_PROMPT.md`.
2. Read the roadmap files under `context/docs/implementation/clinical-functional-release-readiness-roadmap-20260422/`.
3. Read handoff state/prompt under `context/docs/implementation/automation-handoff/`.
4. Read the latest RWO-06H evidence under `context/docs/implementation/rwo06h-injection-v2-contract-preflight-20260426T112213Z/`.
5. Use wrapper contract files under `context/web-client/scripts/` only to understand current no-live validation, not to infer raw ORCA traffic.

## Included Files

See `MANIFEST.txt`.
