# converter 層棚卸しと最終状態

更新日: 2026-03-20
対象: `server-modernized/src/main/java/open/dolphin/converter`

## 1. 結果サマリ

- 着手前 72 クラスだった converter 群を 62 クラスまで縮退した。
- 第一波として、ORCA 病名・点数・一般名の単純委譲 converter 10 クラスを削除した。
- 現在の REST 返却は `LegacyOrcaResponseMapper` と record DTO を経由し、resource が trivial converter wrapper を直接返さない。
- 残存 converter は「既存 JSON 形状を維持するために広い object graph を切り出す層」または「shared/converter のジェネリック基盤」に限定した。

## 2. 今回削除した converter

以下は単純 getter 委譲のみで、resource から直接返していたため DTO/mapper に置換した。

- `CodeNamePackConverter`
- `DiseaseEntryConverter`
- `DiseaseListConverter`
- `DiagnosisCategoryModelConverter`
- `DiagnosisOutcomeModelConverter`
- `DiagnosisSendWrapperConverter`
- `RegisteredDiagnosisListConverter`
- `RegisteredDiagnosisModelConverter`
- `TensuListConverter`
- `TensuMasterConverter`

## 3. keep 分類

### 3.1 Resource 直結で残す群

以下はまだ resource が直接返しており、周辺 object graph が広いため今回の第一波対象から外した。

- `DocInfoListConverter` / `SchemaModelConverter` / `ObservationListConverter` / `AttachmentModelConverter` / `KarteBeanConverter` / `AppoListListConverter`
  - `KarteResource` が返すカルテ・文書・画像・予定系レスポンスを構成する。
- `PatientVisitListConverter`
  - `PVTResource` の一覧応答で使用する。
- `LetterModuleConverter` / `LetterModuleListConverter`
  - `LetterResource` の文書レスポンスで使用する。
- `StampTreeHolderConverter` / `PublishedTreeListConverter` / `StampModelConverter` / `StampListConverter`
  - `StampResource` のツリー/スタンプ応答で使用する。
- `StringListConverter`
  - `KarteDocumentWriteResource` の削除結果応答で使用する。
- `ChartEventModelConverter`
  - `ChartEventSseSupport` のイベント payload 生成で使用する。

### 3.2 shared/converter 基盤として残す群

以下は `open.dolphin.shared.converter` 配下の generic 変換基盤や、その内部でのみ使う補助 converter。

- `IInfoModelConverter`
- `AllergyModelConverter`
- `PatientMemoModelConverter`
- そのほか nested object graph 専用の model/list converter 群

これらは external hit が 0 件でも、converter 内部または shared/converter 基盤から利用されるため、今回の「未使用削除」対象には含めない。

## 4. 次に削れる候補

- `KarteResource` 配下の `DocInfoListConverter` / `ObservationListConverter` / `AttachmentModelConverter` / `SchemaModelConverter`
  - DTO を設計すれば段階的に mapper 化できる。
- `StampResource` 配下の converter 群
  - レスポンス shape の固定と binary field の扱い整理が前提。
- `LetterResource` 配下の converter 群
  - nested item/date/text の DTO 化を先に揃える必要がある。

## 5. SpotBugs 除外の扱い

- `config/static-analysis/spotbugs-exclude.xml` の `open.dolphin.converter.*` 除外は維持した。
- 理由:
  - 残存 converter の多くが `byte[]` や mutable model 参照をそのまま expose する legacy compatibility 層であり、現時点では package 単位除外の意味が残るため。
  - 今後、`KarteResource` / `StampResource` / `LetterResource` 側の DTO 化が進み、残存 converter がさらに縮退した段階で package 単位除外を分割・縮小する。
