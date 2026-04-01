# Server Build Root

- RUN_ID: `20260401T121039Z`
- 作業 root: `/Users/Hayato/Documents/GitHub/OpenDolphin_WebClient`
- 固定 build 入口: `mvn -f pom.server-modernized.xml -pl server-modernized -am`

## Presence Check

- `pom.server-modernized.xml`: yes
- `server-modernized/pom.xml`: yes
- `domain/` directory in current worktree: no
- `persistence/` module in current worktree: yes
- migration source in current worktree: yes

## Notes

- この wave の compile / test / verify は `pom.server-modernized.xml` を唯一の入口として実行する。
- migration source は `server-modernized/tools/flyway/sql/` を現行の source-of-truth として扱う。
