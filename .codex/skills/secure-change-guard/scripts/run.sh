#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

OUT="tmp/secure-change-guard-report.md"
mkdir -p tmp

DIFF_FILES="$(git diff --name-only)"
if [[ -z "$DIFF_FILES" ]]; then
  DIFF_FILES="$(git diff --name-only HEAD~1..HEAD || true)"
fi

if [[ -z "$DIFF_FILES" ]]; then
  cat > "$OUT" <<'REPORT'
# Secure Change Guard Report

差分が見つかりませんでした。
REPORT
  echo "generated: $OUT"
  exit 0
fi

has_auth=0
has_session=0
has_health=0
has_storage=0
has_external=0
has_error=0

while IFS= read -r f; do
  [[ "$f" =~ auth|login|password|token|session|mfa ]] && has_auth=1
  [[ "$f" =~ session|token|cookie ]] && has_session=1
  [[ "$f" =~ health|readiness|liveness ]] && has_health=1
  [[ "$f" =~ attachment|upload|storage|object|digest|uri ]] && has_storage=1
  [[ "$f" =~ orca|external|http|client|webhook|proxy ]] && has_external=1
  [[ "$f" =~ error|exception|handler|advice ]] && has_error=1
done <<< "$DIFF_FILES"

{
  echo "# Secure Change Guard Report"
  echo
  echo "## 対象ファイル"
  echo "$DIFF_FILES" | sed 's/^/- /'
  echo
  echo "## 必須チェック"
  echo "- [ ] 認可はサーバー側で能力単位になっているか"
  echo "- [ ] クライアント入力の権威化（owner/facility/uri/digest）がないか"
  echo "- [ ] 4xx/5xx 応答に内部詳細を含めていないか"

  if [[ $has_auth -eq 1 || $has_session -eq 1 ]]; then
    echo "- [ ] パスワード/権限変更時に既存セッション・トークン失効が行われるか"
  fi
  if [[ $has_health -eq 1 ]]; then
    echo "- [ ] health/readiness/liveness が最小情報のみ返すか"
  fi
  if [[ $has_storage -eq 1 ]]; then
    echo "- [ ] 保存先 URI / object key / digest をサーバー再計算・上書きしているか"
  fi
  if [[ $has_external -eq 1 ]]; then
    echo "- [ ] 外部接続先が allowlist 制約され SSRF を防止しているか"
  fi
  if [[ $has_error -eq 1 ]]; then
    echo "- [ ] 例外応答のメッセージが安全で相関ID方針があるか"
  fi

  cat <<'TAIL'

## misuse case（最低3件）
1. `facilityId` / `ownerId` 改ざんで他施設データへアクセスを試行
2. パスワード変更後に旧セッションCookieで API 呼び出しを試行
3. 任意 URL を接続テスト入力し内部宛 SSRF を試行
TAIL
} > "$OUT"

echo "generated: $OUT"
