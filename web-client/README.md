# OpenDolphin Web Client

この README は `web-client` の入口要約です。current contract の正本は `notes/` 配下に分離します。

## Scope
- `web-client` の current repo 上の docs-freeze 済み契約を参照するための入口です。
- 将来計画、実装予定、repo 外設定値、UI 詳細の推測はこの README に持ち込みません。
- release-ready と merge-ready は同義ではありません。

## Source of Truth
- 認証と主要画面の簡易確認: [notes/auth-check.md](./notes/auth-check.md)
- 認証遷移の current contract: [notes/auth-transition.md](./notes/auth-transition.md)
- 患者文脈の current contract: [notes/patient-context-contract.md](./notes/patient-context-contract.md)
- フィードバック表示の current contract: [notes/feedback-spec.md](./notes/feedback-spec.md)
- UI 棚卸しと verification 境界: [notes/ui-current-contract.md](./notes/ui-current-contract.md)
- ORCAオーダー是正の canonical/local-only 契約: [notes/orca-order-remediation-20260403.md](./notes/orca-order-remediation-20260403.md)
- ORCAオーダー残タスクの cleanup 契約: [notes/orca-order-contract-cleanup-20260404.md](./notes/orca-order-contract-cleanup-20260404.md)
- release gate の current contract: [notes/release-gate.md](./notes/release-gate.md)
- security の正本: [notes/security-spec.md](./notes/security-spec.md)

## Current Summary
- 認証は `/login` から始まる 1 段階目ログインを基本とし、必要時のみ factor2(TOTP) を要求します。
- `returnTo` は sanitize 済み internal path のみを扱い、invalid または empty の場合は `/f/:facilityId/reception` に落とします。
- 患者文脈は privacy-first を前提とし、URL、`localStorage`、`sessionStorage` に残しません。
- admin の source of truth は `/api/admin/config` です。`/api/admin/delivery` を current contract に戻しません。
- ORCA taxonomy は `/api/orca/official/*` を official bridge、`/api/orca/master/*` を master-backed read、`/api/local/*` を local-only contract として扱います。
- security 規範の詳細は [notes/security-spec.md](./notes/security-spec.md) を正本とし、この README へ重複移植しません。

## Release Gate
- repo-local の merge ready 判定と、release 前 mandatory gate は分けて扱います。
- release 前 mandatory gate の正本と、repo-local / repo-external の境界は [notes/release-gate.md](./notes/release-gate.md) を参照してください。
- `runtime-ready-smoke.mjs` は release 前 mandatory です。
- 毎 PR required かどうかは current repo の docs 証拠だけでは `unknown` です。
