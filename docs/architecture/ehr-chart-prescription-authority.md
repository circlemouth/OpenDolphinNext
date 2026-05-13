# 診療録・処方指示 Authority 仕様

## 1. 目的

診療録と処方指示は OpenDolphinNext の正本である。
この文書は、確定、訂正、追記、取消、無効化、処方変更、中止、再発行の真正性を守るための仕様を定義する。

## 2. 診療録状態

診療録は次の状態を持つ。

- DRAFT
- FINAL
- AMENDED
- ADDENDUM
- CANCELLED
- VOIDED

## 3. 診療録確定

確定時には次を必須とする。

- 医師確定者
- 確定日時
- 入力者
- 代行入力者
- 対象患者
- 診療日
- ORCA患者番号
- ORCA受付IDまたは受付なし理由
- 診療科
- 担当医
- 保険組合せ
- 確定時snapshot

確定時 snapshot は [../contracts/chart-finalize-snapshot.md](../contracts/chart-finalize-snapshot.md) を正本とする。`patientSnapshotStatus=IDENTIFIER_ONLY` や `PENDING_WORKER_INTEGRATION` は本番 manifest として許容しない。ORCA 取得不能、通信断、認証失敗、UNKNOWN は `NO_ACCEPTANCE_REASON` とは別の `chart_revision_snapshot_incomplete` として扱い、完全 snapshot があるように見せてはならない。

## 4. 確定後変更

FINAL以降は直接更新不可。

許可される操作は次に限る。

- 訂正
- 追記
- 取消
- 無効化

それぞれeventとして保存する。

直接更新を防ぐため、アプリケーション層だけでなく、可能な限りDB guardでも保護する。

## 5. 診療録出力

診療録は必要時に見読できる必要がある。

出力単位:

- 患者単位
- 診療日単位
- 期間単位

出力形式:

- 画面表示
- 印刷
- PDF
- JSON
- CSV

出力対象には可能な限り次を含める。

- 診療録本文
- SOAP
- 所見
- 患者説明
- 添付文書
- 訂正履歴
- 追記履歴
- 取消履歴
- 処方指示
- ORCA連携履歴
- ORCA警告
- ORCA不一致

## 6. 処方指示

処方指示はOpenDolphinNext正本である。
ORCA診療行為・算定候補とは別物として扱う。

保存する項目:

- 薬剤名
- 薬剤コード
- 規格
- 剤形
- 用法
- 用量
- 単位
- 日数
- 院内 / 院外
- 内服 / 外用 / 注射
- 頓用
- コメント
- 入力者
- 代行入力者
- 確定者
- 確定日時

## 7. 処方履歴

次の操作はeventとして保存する。

- 作成
- 確定
- 変更
- 中止
- 取消
- 再発行
- 再送

確定済み処方指示は直接上書き不可。

## 8. ORCA結果との関係

ORCA送信結果は、処方指示を無断変更してはならない。

ORCA結果は次として保存する。

- 送信結果
- 警告
- エラー
- 不一致
- 会計反映状態
- UNKNOWN状態
- 照合結果

診療録確定 snapshot では、ORCA operation / transmission / reconciliation の status と hash を保存し、警告、不一致、ORCA 側のみ情報、UNKNOWN を成功扱いへ丸めない。

## 9. 監査・hash chain

診療録event、処方eventはappend-onlyとする。

可能な限り次を持つ。

- previous_event_hash
- event_hash
- payload_hash
- actor
- patient
- chart
- prescription
- operation
- occurred_at

一般ユーザーがeventを更新・削除できてはならない。

## 10. レビュー時の危険シグナル

- FINAL状態の本文・SOAP・タイトルをupdateするAPI
- 確定済み処方指示の直接UPDATE
- 診療録確定とORCA送信成功の混同
- 処方確定とORCA会計反映の混同
- 訂正・追記・取消理由なしの変更
- event_hash列だけ存在し、値を投入していない実装
