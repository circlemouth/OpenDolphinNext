# Server modernization overview

この文書は `server-modernized` の現行境界を短く把握するための summary です。

## 入口
- 現行ハブ: [../managerdocs/README.md](../managerdocs/README.md)
- 実装モジュール: [`server-modernized/pom.xml`](../../server-modernized/pom.xml)
- 契約索引: [../README.md](../README.md)

## 現行の責務境界
- `server-modernized/` が Jakarta EE 10 ベースの現行実装
- `web-client/` はその public contract に合わせる
- `docs/contracts/` は runtime / health / ORCA / attachment の public contract を置く
- `docs/runbooks/` は release / validation の live 手順を置く
- `docs/operations/ORCA_CERTIFICATION_ONLY.md` は WebORCA Trial の接続確認手順を置く
- server 本体の永続化は外部 PostgreSQL 前提で進める
- 添付と画像の外部保存は `ATTACHMENT_STORAGE_MODE=s3` の S3 互換 object storage 前提で進める

## モジュール境界
- `domain`: 業務ルールと値オブジェクト
- `api-contract`: 公開 DTO、error contract、enum
- `persistence`: entity、query、migration 接続
- `reporting`: 帳票、署名、出力形式
- `server-modernized`: REST resource、認証/認可、ORCA 接続、worker 公開面

## まず見るもの
- `docs/contracts/runtime-config.md`
- `docs/contracts/health-endpoints.md`
- `docs/contracts/orca-connection.md`
- `docs/contracts/orca-master-api.md`
- `docs/contracts/document-integrity.md`
- `docs/contracts/patient-images.md`
- `docs/runbooks/release-validation.md`

## release gate
```bash
cd web-client && npm run ci
mvn -f pom.server-modernized.xml -pl server-modernized -am -Pstatic-analysis verify
cd web-client && node scripts/runtime-ready-smoke.mjs
```

## business-critical flows
- 認証と session 失効は server 側で統一し、権限変更や認証状態変更後は古い session を残さない。
- 受付からカルテへ渡すキーは `scheduleKey` / `encounterKey` を正本とし、client 推測値や旧受付 ID を route authority にしない。
- ORCA 接続は施設別設定と allowlist で解決し、任意 URL 接続や implicit fallback を許容しない。
- 添付、患者画像、文書整合性は server 生成メタデータと fail-closed 検証を前提に扱う。
- health / readiness / reporting は匿名公開時に最小情報だけ返し、内部詳細は構造化ログで扱う。

## 注意
- health / readiness / liveness は最小公開を維持する
- ORCA 接続先や credential は server 側で決定する
- クライアント入力の owner / facility / uri / digest を権威情報として扱わない
