# Submodule / Empty Directory / Placeholder Check

## Scope

- `.gitmodules`
- `ext_lib/OpenDolphin-ORCA-OQS/`
- `docker/orca/jma-receipt-docker/`
- review package 関連 placeholder
- 空ディレクトリまたは `.gitkeep` だけのディレクトリ

## Commands

```bash
cat .gitmodules

ls -la ext_lib/OpenDolphin-ORCA-OQS | sed -n '1,12p'
ls -la docker/orca/jma-receipt-docker | sed -n '1,16p'

find artifacts/review-bundles artifacts/reviewer-submission-packets -maxdepth 2 -mindepth 1 | sort

find . -path './.git' -prune -o -path './.worktrees' -prune -o -path './web-client/node_modules' -prune -o -path './node_modules' -prune -o -path './server-modernized/target' -prune -o -path './api-contract/target' -prune -o -path './persistence/target' -prune -o -path './reporting/target' -prune -o -path './domain/target' -prune -o -path './web-client/dist' -prune -o -path './web-client/test-results' -prune -o -path './artifacts' -prune -o -type d -empty -print | sort

find . -path './.git' -prune -o -path './.worktrees' -prune -o -path './web-client/node_modules' -prune -o -type f -name '.gitkeep' -print | sort
```

## Results

### `.gitmodules`

- `ext_lib/OpenDolphin-ORCA-OQS`
- `docker/orca/jma-receipt-docker`

どちらも submodule として登録済みで、`url` が設定されていた。

### `ext_lib/OpenDolphin-ORCA-OQS/`

- `.git`, `README.md`, `pom.xml`, `src/` を確認した。
- submodule hole や empty placeholder ではなく、実体あり。

### `docker/orca/jma-receipt-docker/`

- `.git`, `Dockerfile`, `README.md`, `docker-compose.yml`, `logs/`, `start-weborca.sh` を確認した。
- こちらも submodule hole ではなく、実体あり。

### Review Package Placeholder

- `artifacts/review-bundles/`
  - `.DS_Store`
  - `OpenDolphin_WebClient-review-package-20260414T214542Z.zip`
- `artifacts/reviewer-submission-packets/`
  - `.DS_Store`

`artifacts/reviewer-submission-packets/` は実質 placeholder 状態だが、evidence 出力先としては意味がある。docs では source of truth にしない前提を維持する。

### Empty Directory Check

prune 後の空ディレクトリ検出では、主に次が残った。

- `client/target/generated-sources/annotations`
- `client/target/test-classes`
- `server-modernized/${maven.multiModuleProjectDirectory}/server-modernized/target/static-analysis/spotbugs`
- `server-modernized/server-modernized/target/static-analysis/pmd`
- `server-modernized/server-modernized/target/static-analysis/spotbugs`
- `server/target/generated-sources/annotations`
- `server/target/opendolphin-server-2.7.1/META-INF`
- `server/target/test-classes`
- `web-client/artifacts/...`

いずれも generated / evidence / legacy build residue であり、current docs source の空ディレクトリは検出していない。

### `.gitkeep` Check

`.gitkeep` は `artifacts/orca-connectivity/**` の template / backup / legacy evidence 領域で検出した。current docs や current workflow 領域で `.gitkeep` だけの source directory は見つかっていない。

## Conclusion

- submodule hole: 未検出
- current docs 側の空 placeholder: 未検出
- evidence 側 placeholder: `artifacts/reviewer-submission-packets/` にあり
- generated / legacy build residue: `target/` 系と `web-client/artifacts/` 系にあり
