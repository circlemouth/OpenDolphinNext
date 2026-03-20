# 日付フォーマッタ刷新と Karte Null セーフ対応（RUN_ID=20260118T053446Z）

## 対応概要
- `OrcaDiseaseResource` / `OrcaMedicalResource` の日付整形を `SimpleDateFormat` からスレッドセーフな `DateTimeFormatter`（Locale.JAPAN, system zone）へ置換。
- Karte 未生成時の 404 応答で Api_Result=10 / Api_Result_Message="該当データなし" を詳細に含め、監査にも同情報を記録。患者未存在時も同一フォーマットで後方互換を確保。
- 例外レスポンスは従来どおり HTTP ステータスとエラーコード(`karte_not_found`/`patient_not_found`)を維持しつつ、ORCA 互換コードを併記。

## テスト
- 単体テスト: `mvn -pl server-modernized -DskipITs test`（全238 tests, 0 failure, 3 skipped）。新規テストで以下を検証。
  - `OrcaDiseaseResourceTest#getDiseasesReturns404WhenKarteMissingWithApiResult`: Karte なしで 404 + Api_Result=10 が返る。
  - `OrcaMedicalResourceTest#returns404AndApiResultWhenKarteMissing`: 同上（medical）。
  - `OrcaDiseaseResourceTest#formatDateIsThreadSafe` / `OrcaMedicalResourceTest#dateFormatterIsThreadSafe`: 300 並列呼び出しで日付文字列が全て `2024-12-31` となることを確認。
- 高負荷フォーマット確認: `mvn -pl server-modernized -DskipITs -Dtest=OrcaDiseaseResourceTest#formatDateIsThreadSafe,OrcaMedicalResourceTest#dateFormatterIsThreadSafe test` を実施し、結果を `artifacts/orca-format/20260118T053446Z/load-test.log` に保存。全テスト成功。

## 互換性/仕様確認
- ORCA 仕様上、データ欠損時は Api_Result=10（データなし）を返す運用が多く、HTTP 404 と併記してクライアントが従来パーサーで解釈できるようにした。
- エラーメッセージは既存英語メッセージ（"Karte not found" 等）を維持し、Api_Result_Message で日本語 "該当データなし" を付与。
- 成功時レスポンス構造・フィールド名に変更なし。

## 既知リスク
- Api_Result を追加したことでクライアントがエラー時の JSON を期待より厳密にパースしている場合のみ影響の可能性あり（フィールド追加のため）。現行 Web クライアントは `error`/`status` を優先する実装のため影響軽微と判断。
- system zone 利用のため、サーバー TZ 変更時はログの expected 文字列が変わる可能性がある（現行環境は JST）。
