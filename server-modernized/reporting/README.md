# 帳票テンプレート運用メモ

この README は、この checkout で確認できる実装とテンプレートだけを前提にした現行契約をまとめる。
CI ワークフローの実行手順、外部レンダラー前提の説明、repo で再現できない運用手順は載せない。

## テンプレート配置

- 実テンプレートは `server-modernized/reporting/templates/` に置く。
- ここにあるテンプレートは build 時に `reporting/templates` として同梱される。
- 現在 repo で確認できるテンプレートは次のとおり。
- `patient_summary_ja_JP.vm`
- `patient_summary_en_US.vm`
- `receipt_export_ja_JP.vm`
- `receipt_export_en_US.vm`
- `common/header.vm`
- `common/footer.vm`
- `common/karte_helpers.vm`

## テンプレート解決順

`ReportTemplateEngine` は locale に応じて次の順に候補を探す。

- `baseName_<locale>.vm`
- `baseName_<language>.vm`
- `baseName_<defaultLocale>.vm`
- `baseName.vm`

テンプレート本体はさらに次の場所から解決される。

- `--templates` で明示されたディレクトリ
- `open.dolphin.templates.dir`
- `OPENDOLPHIN_TEMPLATES_DIR`
- `jboss.home.dir/templates`
- `server-modernized/reporting/templates`
- `reporting/src/main/resources/reporting/templates`

`common/*.vm` は `#parse` で共通化してよい。

## absolute path の扱い

- `ReportTemplateEngine` は最終的にテンプレートルートを絶対パスとして扱う。
- `SigningConfig.fromJson()` は `keystorePath` を config ファイル基準で解決する。
- 運用では cwd 依存を避けるため、テンプレートルートも keystore も絶対パスを使うこと。

## 署名ポリシー

- 署名は `--config` もしくは API 側の signing 設定が渡された場合にだけ行う。
- `signing-config.sample.json` はサンプルであり、秘密情報の保存先として扱わない。
- TSA が設定されている場合、timestamp 失敗を無視して unsigned に落とす挙動は取らない。
- TSA 不達、無効な key alias、keystore 読み込み失敗は fail-closed として扱う。
- 署名不要の local preview は signing config を渡さずに行う。

## 現在 repo で確認できる補足

- `reporting` モジュールには `PdfRendererKt` の CLI 入口がある。
- `server-modernized/reporting/signing-config.sample.json` は field 名を固定したまま使う。
- この README は repo の現物に合わせることを優先し、未確認の運用フローは追加しない。
