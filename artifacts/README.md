# Artifacts

`artifacts/` は evidence / generated outputs の保存先です。source of truth ではありません。

## What Belongs Here
- RUN_ID 固定の validation output
- logs / screenshots / HAR / network traces
- reviewer submission packet や closeout bundle
- 一時的な doc reorg report などの成果物

## What Does Not Belong Here
- current contract
- live runbook
- architecture summary
- implementation source

## Rules
- 証跡の canonical storage は `artifacts/` に置く
- docs の正本は `docs/` と `web-client/notes/` に置く
- build artifact や review package を source of truth 判定に使わない
