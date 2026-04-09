# ORCA 残タスク 実装工程表

## 目的
残件を「直したつもり」で終わらせず、**契約固定 → 実装 → help/tests/docs 同期 → 証跡取得**まで閉じる。

## 工程サマリ

### Phase 0: Contract Freeze / Re-baseline（read-only）
目的:
- split review と Codex 実 repo 読みで割れた論点を、**いまの working tree** で確定する
- 触るべきコードと、実はもう直っているので locking test だけ足すべきコードを分ける

実施内容:
- `07_phase0_contract_freeze_checklist.md` の全項目を read-only で確認
- disputed family:
  - surgery `501/502` standalone
  - surgery rowRole `material`
  - testOrder exact fail-close
  - physiology local save / exact 600
  - bacteria read fallback
  - otherOrder old-shape 残存
  - legacy bodyPart resurrection
- 各項目を `confirmed mismatch / already conforming / not applicable` に分類
- file:line 付き decision table を作る

終了条件:
- decision table 完成
- 以後の Phase 1〜4 で触る箇所が確定

### Phase 1: Prescription / Claim Comment / Speed
目的:
- med usage 契約を一本化
- RP-level / drug-level structured claim comment を editor / validation / wire まで閉じる
- `speed` overclaim をなくす

実施内容:
1. med usage
   - local-only persisted / outbound strip を正式契約にする
   - policy 名・help 文言・tests を契約に合わせる
2. structured claim comment
   - shared carrier spec を client/server で実装
   - RP/drug claim comment の `note` を explicit field で保持
   - editor UI と client-side validation を追加
   - save/fetch/source bundle/ORCA wire を round-trip 可能にする
3. speed
   - 実装しない
   - docs/help/tests/notes/report から削除
4. unknown structured family
   - first-class prescription save でも fail-close を維持

終了条件:
- claim comment の family ごとの carrier test が通る
- med usage の send-strip 契約が code/test/help/docs で一致
- `speed` の overclaim が消える

### Phase 2: SoT / Canonicalization / Class Fail-Close
目的:
- source of truth を catalog に一本化
- legacy radiology label fallback を削除
- exact-class entities の `null classCode` を boundary で reject

実施内容:
1. client
   - `orderChargeClassSupport.ts` を thin delegate 以下に縮退、可能なら撤去
   - `orderCategoryRegistry.ts` / `orderBundleApi.ts` / `orderRpNormalization.ts` の entity/class canonicalization を catalog 委譲に統一
2. server
   - `OrcaChargeClassSupport` / `OrcaChargeClassCanonicalSupport` / `resolveCanonicalClassName` の独自 map/fallback を削除
   - `OrcaMedicalClassCatalog` を唯一の canonical source にする
3. radiology
   - `放射線` / `\u653e\u5c04\u7dda` fallback を削除
4. fail-close
   - exact-class entities は request boundary で `classCode` 必須
   - validator 通過後の defaulting 依存をやめる

終了条件:
- catalog 以外の canonical map/fallback が production path から消える
- `null classCode` を allow する validator が exact-class entity で残らない

### Phase 3: Disputed Family Fixes or Locking Tests
目的:
- Phase 0 の結果に応じて、未達 family だけ修正する
- 既に正しい family は locking test だけ追加する

実施内容:
- surgery mismatch が confirmed なら:
  - `501/502` standalone を save/send/server/fetch で一致
  - `rowRole=material` の resolver を client/server/fetch で一本化
- testOrder mismatch が confirmed なら:
  - save/send/server が同一 allowlist helper を使う
- physiology mismatch が confirmed なら:
  - local save 可 + exact 600 を実装、または契約を import-only read-only に切り直して docs/help も更新
  - 本パッケージでは **local save 可 + exact 600** を推奨
- bacteria mismatch が confirmed なら:
  - read fallback を `830/842` strict にする
- otherOrder old-shape mismatch が confirmed なら:
  - explicit local-only contract に完全移行
- bodyPart resurrection mismatch が confirmed なら:
  - read/helper/display の resurrection を削除

終了条件:
- disputed point が全部 resolved、または already conforming + locking test added

### Phase 4: Help / Tests / Notes / Grep Cleanup
目的:
- stale help/test/note を current behavior に合わせる
- overclaim を消す

実施内容:
- injection help を runtime 契約に合わせる
- `orderBundleOrcaSupport.test.tsx` を新 help 文言に合わせる
- `orderSendSmoke.test.ts` の `Radiology` fixture を exact className に更新
- `rejects bodyPart resurrection` を実ケースに書き換える
- notes の med usage / claim comment / radiology wording を実装に合わせる
- dead residue (`missing_admin_code`, `unsupported_admin_memo`, 古い policy 名) を削除

終了条件:
- help/tests/notes が current contract を固定
- grep gate の説明不能 hit が 0

### Phase 5: Full Verification / Evidence / Audit
目的:
- 「通るはず」ではなく、証跡付きで完了判定する

実施内容:
- targeted tests
- full client tests / build
- full server tests / verify / `-Pstatic-analysis verify`
- grep gate
- Final Auditor review

終了条件:
- `04_acceptance_matrix.md` の AC 全達成
- `06_final_report_template.md` で blocker 0 の完了報告が書ける

## 依存関係
- Phase 1 の claim comment carrier spec は Phase 4 tests 更新より先
- Phase 2 の class fail-close は Phase 3 family fix より先
- Phase 0 decision table が無いと Phase 3 で誤修正しやすい

## 禁止事項
- disputed family を推測で直す
- docs/help/tests を最後にまとめて雑に直す
- canonicalization cleanup を helper 追加だけで済ませる
- `memo` に structured note を埋め込み続ける
- legacy fallback を残したまま grep gate を「説明付き hit」として逃がす
