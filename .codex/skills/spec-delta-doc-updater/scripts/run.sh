#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"
mkdir -p tmp
OUT="tmp/spec-delta-doc-plan.md"

FILES="$(git diff --name-only)"
if [[ -z "$FILES" ]]; then
  FILES="$(git diff --name-only HEAD~1..HEAD || true)"
fi

{
  echo "# Spec Delta Documentation Plan"
  echo
  echo "## 対象差分"
  echo "$FILES" | sed 's/^/- /'
  echo
  echo "## 仕様変更候補"

  echo "$FILES" | rg -q "server-modernized/.*/(controller|api|dto|service)" && echo "- API 契約変更の可能性あり（request/response/status/validation 確認）"
  echo "$FILES" | rg -q "(auth|session|token|password|mfa)" && echo "- 認証/セッション仕様変更の可能性あり（失効条件・ローテーション条件を明記）"
  echo "$FILES" | rg -q "(health|readiness|liveness|error|exception)" && echo "- 運用監視/エラー応答仕様変更の可能性あり"
  echo "$FILES" | rg -q "(attachment|upload|storage|object|uri|digest)" && echo "- 添付保存/所有権検証ルール変更の可能性あり"
  echo "$FILES" | rg -q "(orca|external|webhook|proxy|http)" && echo "- 外部接続/SSRF対策ルール変更の可能性あり"

  cat <<'EOT'

## 更新候補ドキュメント
- docs/architecture/server-modernization-overview.md
- docs/runbooks/release-validation.md
- web-client/notes/（画面/API運用ルール）
- docs/implementation/（今回作業の解説ログ）

## 追記テンプレート
1. 変更前仕様
2. 変更後仕様
3. セキュリティ上の意図（脅威と対策）
4. 既存ユーザー影響と移行手順
5. 検証結果（正常系/異常系/改ざん系）
EOT
} > "$OUT"

echo "generated: $OUT"
