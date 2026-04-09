# Phase 0 Contract Freeze Checklist

このチェックリストは **read-only** で埋める。
コード変更前に、現在の working tree が本当にどこまで直っているかを確定する。

## 記入ルール
各項目を次のいずれかで判定する。
- `confirmed mismatch`
- `already conforming`
- `not applicable`

各項目に file:line を最低 2 つ書くこと。

---

## 1. surgery `501/502` standalone
### 期待 end state
- `501/502` は client save / client send / server mutation / fetch で standalone として扱われる

### 調べる場所
- client save validator
- client send validator
- server mutation validator
- fetch / recommendation helper
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 2. surgery rowRole `material`
### 期待 end state
- validation / persistence / fetch / recommendation が同一 resolver を使い、`material` の意味が割れない

### 調べる場所
- client rowRole coercion
- server rowRole support
- recommendation/fetch helper
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 3. testOrder exact fail-close
### 期待 end state
- allowlist `600/601/602/603/610`
- reject `640/643` + allowlist 外
- save/send/server が同一 helper 参照

### 調べる場所
- client save validator
- client send path
- server request/mutation validator
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 4. physiology local save / exact 600
### 期待 end state
- local save/fetch 可
- send-block
- `classCode=600` exact

### 調べる場所
- mutationFn guard
- help/registry
- server request validation
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 5. bacteria read fallback strict
### 期待 end state
- read helper も `830/842` だけを metadata 化する

### 調べる場所
- client normalize
- server derive / fetch helper
- mutation writer
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 6. otherOrder old-shape 残存
### 期待 end state
- broad range / legacy regex なし
- explicit local-only contract のみ

### 調べる場所
- client contract
- client validator
- server request support
- server rowRole support
- tests

### decision
- status:
- evidence:
- action:
- locking test:

---

## 7. legacy bodyPart resurrection
### 期待 end state
- 002 legacy row から bodyPart を resurrect しない
- radiology 700 explicit bodyPart だけが survive

### 調べる場所
- form reconstruct
- display helper
- server fetch helper
- tests

### decision
- status:
- evidence:
- action:
- locking test:
