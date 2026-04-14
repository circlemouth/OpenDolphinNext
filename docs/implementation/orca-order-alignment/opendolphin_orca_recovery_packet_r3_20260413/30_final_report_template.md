# final-report template

## 1. 総合 verdict
- PASS / FAIL
- 受入れ可 / 再オープン推奨
- 1 段落結論

## 2. accepted source of truth
- branch
- HEAD
- RUN_ID
- merge-base to origin/master
- なぜこの HEAD を accepted source of truth としたか

## 3. 何を直したか
- PR2 import
- PR3 runtime blocker
- PR6 packet / provenance / evidence
- 変更ファイル一覧へのリンク

## 4. 実行した検証
- git provenance commands
- npm run verify:web-guard
- npm run ci
- mvn -Pstatic-analysis verify
- targeted tests
- runtime-ready smoke
- qa-acceptmodv2
- qa-fullflow

## 5. live evidence summary
- accept summary
- fullflow summary
- send 到達有無
- medicalmodv2.xml 有無
- blocker classification

## 6. appointments/medical-information 502 切り分け
- repo defect / upstream blocker / test-data blocker
- 根拠 evidence file
- source file
- 結論

## 7. patients/import summary
- target patient
- upstream result
- local sync result
- success / controlled failure
- evidence file

## 8. reviewer submission packet
- packet path
- review-checkout HEAD
- closeout-packet HEAD
- manifest validation result
- required files check result
- absolute path lint result

## 9. G0〜G7 最終判定
- gate
- PASS / FAIL / NOT VERIFIED
- 根拠

## 10. PR0〜PR6 最終判定
- PR
- PASS / FAIL / NOT VERIFIED
- 根拠

## 11. 残件がある場合
- area
- severity
- 何が残るか
- repo defect / upstream blocker / environment blocker / NOT VERIFIED
- 次の最小作業

## 12. 添付一覧
- review-checkout/
- closeout-packet/
- manifest
- final-report
