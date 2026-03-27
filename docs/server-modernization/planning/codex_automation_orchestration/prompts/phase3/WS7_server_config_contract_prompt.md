# Codex Prompt: WS7 server security/config contract drift 修正

添付ドキュメント
- `phase3_codex_shared_context.md`
- `phase3_codex_parallel_workstreams.md`
を読み、`WS7` を実装してください。

## ミッション
server config sample と runtime validator / implementation の drift を狙い撃ちで解消する。今回の対象は trusted proxies と ORCA response header forwarding に限定する。

## サブエージェント指示
- subagent A: `server-modernized.env.sample` と validator/test の差分を整理
- subagent B: `OrcaApiProxySupport` default behavior と tests を整理
- subagent C: 最小パッチ + validation plan を作る

## 実装方針
- `SECURITY_TRUSTED_PROXIES` の comment は validator の required contract に合わせる。
- ORCA response header forwarding は explicit opt-in に寄せる。
- default behavior / sample / tests を同期更新する。
- broad security hardening には広げない。

## 実装ガード
- CSRF / logout / 2FA / attachment storage / document integrity の仕様変更はしない。
- 「comment だけ変更」ではなく test も current contract に合わせる。
- backward compatibility は考慮不要だが、repo 内の call site/test は必ず合わせる。

## 最後の報告
- changed defaults
- sample/validator/test の整合化内容
- 実行した validation
