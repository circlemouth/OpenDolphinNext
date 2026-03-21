# Patient Images 契約

## 目的
患者画像 API を context-root 非依存・低メモリ・安全な実装へ改める。

## API 契約

### 1. 一覧
- `GET /api/patients/{patientId}/images`
- 認証必須
- 応答の `downloadUrl` は request の base URI から組み立てる。
- `/openDolphin` のような固定 context-root を埋め込まない。

### 2. ダウンロード
- `GET /api/patients/{patientId}/images/{imageId}`
- 認証必須
- `Cache-Control: private, no-store`
- `Content-Disposition: attachment`

### 3. アップロード
- `POST /api/patients/{patientId}/images`
- `multipart/form-data`
- `image/jpeg|image/png` のみ受け付ける。
- byte limit / width / height を超えたら 4xx で拒否する。

## 実装方式
- [ ] リクエスト body は temp file へ streaming し、受信中に byte limit を超えたら即時中断する。
- [ ] magic number で MIME を判定し、宣言値と一致しない場合は拒否する。
- [ ] `ImageInputStream` + `ImageReader` で width / height を先に取得する。
- [ ] 画像が許容サイズ内であることを確認してから decode する。
- [ ] JPEG の alpha は白背景で flatten して同形式へ再エンコードし、metadata を除去する。
- [ ] 再エンコード後サイズも `max-bytes` を超えてはならない。
- [ ] temp file は `finally` で必ず削除する。

## 設定契約
- `patient-images.enabled`
- `patient-images.max-bytes`
- `patient-images.max-width`
- `patient-images.max-height`
- `attachment.storage.mode`

## セキュリティ契約
- [ ] feature が無効なら 404 ではなく、運用方針に応じて 403 または 404 を固定化し、文書に明記する。
- [ ] filename から path separator / CRLF / quote を除去する。
- [ ] raw exception message をクライアントへ返さない。
- [ ] `AttachmentStorageManager` が backend probe を持ち、health で利用できるようにする。

## 実装タスク
- [ ] `PatientImagesResource` で `UriInfo` を用いて `downloadUrl` を生成する。
- [ ] upload path を temp file 方式へ置き換える。
- [ ] `AttachmentStorageConfigLoader` の implicit database fallback を廃止し、typed config へ統合する。
- [ ] storage backend probe を追加する。
- [ ] context-root / oversize / MIME mismatch / dimension overflow / S3 readiness のテストを追加する。

## 受け入れ条件
- [ ] `downloadUrl` に固定 `/openDolphin` が含まれない。
- [ ] 画像アップロード中にメモリへ全 byte を常駐させない。
- [ ] readiness が storage backend の実疎通を反映する。
