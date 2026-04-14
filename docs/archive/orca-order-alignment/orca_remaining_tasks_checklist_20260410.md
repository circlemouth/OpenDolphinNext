# ORCA 残タスク（ログ提出以外）チェックリスト

- RUN_ID: `20260409T220045Z`
- Scope: current code / current notes / current tests の non-log follow-up
- Source: `/Users/Hayato/Downloads/orca_nonlog_remaining_tasks_checklist.md`
- Progress note: 2026-04-10 時点。code/help/tests/notes の current contract 整合を優先し、ログ提出依存の断定は書かない。

## 非交渉ルール
- [x] current code only
- [x] 完了報告を信じない
- [x] raw log が見えないものを pass と書かない
- [x] ログ提出は今回のスコープ外
- [x] 後方互換性は考慮しない
- [x] build 成果物や過去 artifacts は無視する
- [x] production path の整合を優先する

## A. stale tests の解消
### A-1. orderSendSmoke.test.ts
- [x] treatment 400 smoke の case 名と fixture 実態を一致させる
- [x] `entity: 'generalOrder'` fetch alias を通常 smoke から外し canonical に寄せる
- [x] `className: 'Injection'` を canonical fixture に置換する

### A-2. chartsActionBar.orca-send.test.tsx
- [x] `className: 'Treatment'` を canonical fixture に置換する
- [x] treatment warning cache ケースの期待値を current rowRole に合わせる

### A-3. orderBundleOrcaSupport.test.tsx
- [x] base props の `entity: 'generalOrder'` / `title: '一般オーダー'` を current contract に合わせる
- [x] `generalOrder` は boundary alias 専用ケースへ隔離する
- [x] `laboTest` は boundary alias 専用ケースへ隔離する

### A-4. orderBundleItemActions.test.tsx
- [x] `treatmentOrder` props に残る `title: '一般オーダー編集'` を current contract に合わせる
- [x] `className: 'Injection'` を canonical fixture に置換する
- [x] injection fallback / recent usage の語彙を `投与指示` 系へ寄せる

### A-5. bodyPart resurrection
- [x] `orderBundleBodyPart.test.tsx` を baseline とし、他ファイルの naming / expectation を整合させる

## B. stale help / wording / current contract tension の解消
### B-1. med usage wording
- [x] `medOrder` の `usage = local-only persisted / outbound strip` を editor 上でも明示する
- [x] `supportsUsageSearch: true` でも help が消えないようにする
- [x] policy 文言と editor help のズレを shared helper へ寄せる

### B-2. injection wording
- [x] `投与指示` を canonical wording に寄せる
- [x] `最近使った投与指示` へ recent usage 語彙を揃える
- [x] injection help / recent usage / test labels の語彙を揃える

### B-3. radiology wording
- [x] radiology の instruction / memo / item memo が院内ローカルかつ ORCA 非送信であることを editor 上でも明示する
- [x] note 側の主張と code 実態を一致させる

### B-4. speed wording residue
- [x] `投与速度` は院内メモ / ORCA 非送信の文脈に閉じる

## C. stale notes / overclaim の解消
### C-1. cleanup note
- [x] `orca-order-contract-cleanup-20260404.md` の verification summary を current code と矛盾しない historical snapshot に直す
- [x] `generalOrder` / `ENTITY_GENERAL_ORDER` の current-tense な過大主張を避ける

### C-2. remediation / canonicalization notes
- [x] med / injection / radiology の editor wording を current contract に合わせる
- [x] radiology local-only explicitness の note を code 実態に合わせる

### C-3. 最新完了報告テンプレート
- [x] ログなしでは断定できない事項を `コード上完了 / 証跡待ち / 未完了` に分離する
- [x] static-analysis の意味を正確に書く
- [x] grep gate を literal 0 hit ではなく実質評価ベースにする

## D. grep gate 実質評価
- [x] stale className fixture (`Injection`, `Treatment`) を target tests から除去する
- [x] `generalOrder` / `laboTest` は boundary alias 専用ケースとして残置理由を説明可能にする
- [x] `literal 0 hit = 完了` という書き方を避ける
- [x] wording residue は通常 UI / 通常 test に残さない

## E. ローカル自己確認
- [x] `npm run typecheck`
- [x] `npx vitest run src/features/charts/__tests__/orderSendSmoke.test.ts src/features/charts/__tests__/chartsActionBar.orca-send.test.tsx src/features/charts/__tests__/orderBundleOrcaSupport.test.tsx src/features/charts/__tests__/orderBundleBodyPart.test.tsx src/features/charts/__tests__/orderBundleItemActions.test.tsx`
- [x] `npm run build`
- [ ] raw log / artifact 提出
  今回はスコープ外。最終報告では evidence pending と分離する。

## 完了条件
- [x] target test files の stale fixture / stale names / stale alias が整理されている
- [x] editor help と policy wording が current contract に整合している
- [x] stale notes / overclaim が current code と矛盾しない
- [x] report template から、ログ未提出でも断定している文言が除去または限定されている
- [x] 変更サマリに「何を直したか」「何を意図的に残したか」を明記できる状態になっている
