# UIQA Browser Verification Preparation

RUN_ID: `20260501T144033Z`

このパケットは、Worker A/B/C の統合後に行う UI QA / 統合確認の準備資料です。ここには実行証跡や患者データを置かず、sanitized summary の書式、no-artifact browser checklist、focused test list だけを置きます。

## Scope

- 対象: `web-client/` と `server-modernized/` の統合確認。
- 非対象: `client/` と `server/` の変更、UI 実装修正、raw evidence の保存。
- 正本参照:
  - [docs/runbooks/release-validation.md](../../runbooks/release-validation.md)
  - [web-client/notes/release-gate.md](../../../web-client/notes/release-gate.md)
  - [web-client/notes/security-spec.md](../../../web-client/notes/security-spec.md)
  - [tests/e2e/README.md](../../../tests/e2e/README.md)

## Misuse Cases

1. QA 担当者が診断目的で browser artifact を保存し、HAR / trace / video / screenshot / raw network body に credential、Cookie、患者機微詳細、ORCA raw body を混入させる。
   - 対策: 通常確認は `web-client/scripts/run-safe-playwright-no-artifacts.mjs` と no-artifact checklist を使い、summary には status class、route class、sanitized observation だけを残す。
2. 受付からカルテへの遷移で患者 ID、受付 ID、検索語、請求番号などを URL query / hash / `localStorage` / `sessionStorage` に残し、共有端末やブラウザ履歴から漏えいする。
   - 対策: QA 項目に URL / browser storage の点検を入れ、患者文脈は router state または揮発メモリだけで扱われていることを確認する。
3. `patient_not_found` や ORCA 接続失敗の確認時に、サーバー内部例外、接続先、資格情報、患者住所・電話・保険詳細を summary に貼り付ける。
   - 対策: failure は business classification と画面上の安全な文言だけを記録し、raw response、stack trace、内部 URL、患者属性値は記録しない。
4. QA summary が「HTTP 200」「画面に表示された患者名」だけで SOAP / 文書 / 注射 / カルテ遷移の成功を主張する。
   - 対策: readback、保存後状態、routing context、server-generated context の有無を分けて記録し、未確認は `not_verified` と書く。

## No-Artifact Browser Checklist

手動ブラウザ確認または no-artifact Playwright 確認では、次を 1 run の最小項目とします。スクリーンショット、HAR、trace、video、raw network dump は保存しません。

| ID | 項目 | 合格条件 | Sanitized summary に残す内容 |
| --- | --- | --- | --- |
| B01 | ログイン | 正常な施設・ユーザーでログインでき、失敗時は安全なメッセージのみ表示される | `pass/fail`, factor2 required class, route class |
| B02 | 既存患者受付 | 既存患者を検索し、受付登録または受付行選択ができる | selected candidate class, route class, business status |
| B03 | `patient_not_found` 表示 | 存在しない患者または不整合患者で、業務分類として `patient_not_found` が表示される | classification only, no raw patient detail |
| B04 | カルテ遷移文脈 | 受付からカルテへ遷移し、`scheduleKey` / `encounterKey` 相当の文脈が URL query / storage に残らない | route path class, URL scrub result, storage scrub result |
| B05 | SOAP 保存 | S/O/A/P または SOAP Free を保存し、保存後 readback または UI 状態が同一文脈で確認できる | save status, readback status, no raw note body |
| B06 | 文書保存 | free document / 文書カテゴリの保存後、同一患者・同一 encounter 文脈の readback が維持される | document status class, no document body |
| B07 | 注射入力 | 注射入力 UI で候補選択または手入力行を作成し、保存後の行種別と数量状態が維持される | order entity class, status class, no drug free text when sensitive |
| B08 | 右ドック最小化 | 右ドックを開閉・最小化しても SOAP 入力、文書、注射の状態が破損せず、背景操作が想定通りできる | drawer mode transition, status only |
| B09 | URL / storage hygiene | B02-B08 後に URL query/hash、`localStorage`、`sessionStorage` に患者機微詳細が残らない | checked key categories, finding count |

## Forbidden Artifacts

次の artifact は tracked docs、review package、QA summary、console transcript に保存しません。

- Screenshot / screen recording / video.
- HAR、trace zip、raw network dump、request / response JSON の丸ごと保存。
- raw ORCA XML / JSON body、ORCA request XML、ORCA response body。
- Credential、keyring raw material、Basic secret、Authorization value、CSRF token、Cookie value、JSESSIONID value。
- 患者氏名、住所、電話番号、保険者番号、記号番号、保険詳細、自由記述の診療本文。
- credential-bearing URL、内部接続先 URL、host / port / scheme、stack trace、SQL、内部 filesystem path。

## Redaction Policy

- 患者 ID は原則 `patientIdClass=trial_candidate|local_seed|unknown` とし、必要時だけ `hash` または末尾 2 桁程度の非復元的分類を使う。
- endpoint は route taxonomy だけを残す。例: `official`, `master`, `local`, `admin-internal`, `blocked`.
- body は保存しない。必要な場合も field allowlist による `present/absent/count/statusClass` へ落とす。
- error は `businessRejected`, `patient_not_found`, `auth_denied`, `network_unavailable`, `not_verified`, `environment_blocker` などの分類へ落とす。
- browser storage は key 名の category と finding count だけを残し、value は残さない。
- URL は path class と scrub 結果だけを残し、query / hash の raw value は残さない。

## Focused Test List After A/B/C Integration

### Static / Unit Minimal

```bash
cd web-client && npm run verify:web-guard
cd web-client && npm test -- --run \
  src/__tests__/LoginScreen.test.tsx \
  src/__tests__/AppRouter.charts-query-scrub.test.tsx \
  src/__tests__/AppRouter.login-redirect.test.tsx \
  src/features/reception/__tests__/ReceptionPage.test.tsx \
  src/features/charts/__tests__/SoapNotePanel.test.tsx \
  src/features/charts/__tests__/PatientSummaryPanel.test.tsx \
  src/features/charts/__tests__/soapNoteRightDockDrawer.test.tsx \
  src/features/charts/__tests__/orderBundleItemActions.test.tsx
```

### No-Artifact Browser Minimal

```bash
PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --dry-run --run-id 20260501T144033Z \
  tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts \
  tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts

PLAYWRIGHT_DISABLE_MSW=1 npm run --prefix web-client test:e2e:no-artifacts -- --run-id 20260501T144033Z \
  tests/e2e/safe-no-artifacts/charts-missing-context-recovery.safe.spec.ts \
  tests/e2e/safe-no-artifacts/local-clinical-persistence.safe.spec.ts
```

### Release Gate Escalation

統合後の最終確認では、release validation 正本に従って次を実行します。

```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

## Forbidden String Scan

QA summary を作成した後、最低限次を実行します。hit した場合は raw material か policy wording かを分類し、raw material は削除します。

```bash
rg -n --glob '*.md' --glob '*.json' \
  'ORCA_API_PASSWORD[=]|ORCA_API_USER[=]|Authorization[:]|Cookie[:]|JSESSIONID[=]|BEGIN (RSA|OPENSSH|PRIVATE) KEY|-----BEGIN|raw ORCA|保険者番号|記号番号|住所|電話番号|stack trace|StackTrace|trace[.]zip|[.]har|[.]webm|[.]mp4|[.]png' \
  docs/implementation/uiqa-browser-verification-20260501T144033Z
```

期待結果:

- policy wording だけなら `allowed_policy_wording` として summary に記録する。
- credential / token / Cookie value / raw ORCA body / raw patient detail / retained artifact path が hit した場合は `fail` とし、該当ファイルを sanitized 形式に直して再実行する。

## Summary Template

実行結果は [qa-summary.template.sanitized.md](qa-summary.template.sanitized.md) をコピーせず、同じ項目構造で `artifacts/orca-remediation/closeout/<RUN_ID>/qa/browser-verification/summary.sanitized.md` へ保存します。`docs/` には実行ごとの証跡を追加しません。
