# Document / Image Lifecycle

この文書は、文書 snapshot / 患者画像 asset / attachment reference / print preview の current contract を固定します。

## Fixed Now
- patient-specific document truth は odletter snapshot です。
- patient image asset は `/patients/{patientId}/images` です。
- attachment reference は asset 実体とは別の relation です。
- print preview は route-state only です。
- history delete は reference remove only です。
- hard delete は gate 閉鎖まで UI に出しません。

## Snapshot / Asset / Reference / Preview Boundary
- snapshot:
  - `saveLetterModule` と odletter 履歴が patient-specific document の正本です。
  - `webAttachmentIds` は snapshot が参照している attachment reference id の一覧です。
- asset:
  - 患者画像 upload/list/download は `/patients/{patientId}/images` を正本にします。
  - asset 保存成功を document attachment success と同一視しません。
- reference:
  - `/api/charts/document-drafts` へ送る attachment は chart_revision authority 内で server 側の asset metadata を再解決した reference だけを採用します。
  - client が送った `uri` / `digest` / `storageKey` は権威入力として扱いません。
  - reference remove は snapshot/history 側の relation 削除であり、asset 実体削除ではありません。
- preview:
  - print preview は `location.state` だけで開きます。
  - sessionStorage/localStorage を使った preview restore は行いません。
  - reload/new tab/missing state は fail-close で戻り導線を出します。

## Fail-Closed Gates
- UG-08:
  - hydration source 未確定の間は snapshot-only です。
  - print missing-state は「再開できません」で止めます。
- UG-09:
  - delete scope 未確定の間は reference remove only です。
  - hard delete copy / UI / API は出しません。
- WS05-G1:
  - attachment reference backend contract が壊れたら document attach action は feature-off に倒します。
- WS05-G2:
  - saved attachment-linked document の rehydrate/edit は未解決のため fail-close で block します。

## UI Copy
- delete dialog:
  - `文書履歴参照を削除しますか？`
  - `odletter の履歴から削除します。患者画像実体は削除しません。`
- attachment-linked edit block:
  - `画像参照付き文書は現契約では安全に再編集できません。新規作成で画像を選び直してください。`
- print missing-state:
  - `文書プレビューの状態が見つかりません。`
  - `この画面は一時プレビューのため、再開できません。Charts へ戻って開き直してください。`

## Verification
- preview open 後に preview state を browser storage へ保存しないこと。
- attachment-linked saved document の edit/copy が fail-close すること。
- history delete copy が reference remove only であること。
- reference row 削除時に patient image asset 実体を delete しないこと。
