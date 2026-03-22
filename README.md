# OpenDolphin Web Client & Modernized Server

本リポジトリは、オープンソース電子カルテシステム **OpenDolphin** をベースに、サーバーのモダナイゼーション（Jakarta EE 10 対応）と、新規 Web クライアントの開発を行うプロジェクトです。
現時点では開発中のため、多数の不備が残っています。

フォーク元の Legacy 資産（Java Swing クライアント、旧サーバー）は**参照専用**として保持し、並行して新しいアーキテクチャでの開発を進めています。

## 📚 ドキュメント・開発ハブ

本プロジェクトのドキュメントは役割別に集約されています。開発作業は必ず以下のハブドキュメントを起点に進めてください。

### 開発状況（単一参照）
👉 **[docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md)**
*   Phase2 ドキュメントの位置付け（Legacy/Archive）
*   現行作業の参照順とルール
*   `docs/` 正本索引: [docs/README.md](docs/README.md)

### Web クライアント開発
👉 **[docs/web-client/CURRENT.md](docs/web-client/CURRENT.md)**
*   UX/UI 設計、画面仕様
*   現行の設計/運用ハブ（Phase2 文書は Legacy/Archive）
*   Web クライアント運用ルール

### サーバーモダナイズ & ORCA 連携
👉 **[docs/server-modernization/README.md](docs/server-modernization/README.md)**
*   Jakarta EE 10 移行、API 設計
*   ORCA (WebORCA) 連携仕様・接続ルール
*   サーバー運用・デプロイ手順（Phase2 は Legacy/Archive）
*   root 側の契約索引: [docs/README.md](docs/README.md) から runtime config / health / ORCA connection / document integrity / patient images を参照

---

## 📂 リポジトリ構成

| ディレクトリ | 説明 | ステータス |
| :--- | :--- | :--- |
| **`server-modernized/`** | **モダナイズ版サーバー** (Jakarta EE 10) | **Active Development** |
| **`web-client/`** | **新規 Web クライアント** (React, TypeScript) | **Active Development** |
| **`docs/`** | プロジェクト全般のドキュメントハブ | **Active Development** |
| `client/` | 旧 OpenDolphin クライアント (Java Swing) | ⛔️ Legacy (Read-only) |
| `server/` | 旧 OpenDolphin サーバー (Java EE 7) | ⛔️ Legacy (Read-only) |
| `ext_lib/` | 旧ビルド依存ライブラリ | ⛔️ Legacy (Read-only) |

> **Legacy 資産 (`client/`, `server/`) について**
> これらのディレクトリに含まれるコードは、機能比較や仕様確認のためにのみ残されています。
> **修正・変更・保守作業は行いません。**
>
> `artifacts/`、`output/`、`docs/archive/`、`docs/server-modernization/phase2/`、`docs/managerdocs/`、`src/LEGACY:*` などの検証証跡・旧計画文書は、現行の主要開発対象ではありません。
> 現在の実装作業は `server-modernized/` と `web-client/` を中心に進めます。


### 謝辞
*   本リポジトリは、以下のプロジェクトを大いに活用をさせて頂きました。

*   フォーク元のリポジトリを公開、維持してくださっている株式会社メドレー様に感謝申し上げます。
*   https://www.opendolphin.com/

*   常に進化しながら開発に伴走してくれたCodex、ワークツリーによる開発と工程管理を理解させてくれたKamuiOS、マルチエージェント開発の活用とtmux等について(楽しく)学ばせていただいたmulti-agent-shogunの開発者の方々に謝辞申し上げます。
    - [multi-agent-shogun](https://github.com/yohey-w/multi-agent-shogun.git)
    - [kamuios](https://github.com/dai-motoki/kamuios.git)
    - [OpenAI Codex](https://github.com/openai/codex)
  - 
*   PR [#68](https://github.com/circlemouth/OpenDolphinNext/pull/68)  により、サーバーデータ保存形式の見直しに関する具体的な修正、ご意見を頂けた H.Inomata 様(https://x.com/h_inomata?s=21)に感謝いたします。
*   ライセンス上の検討およびサーバーデータ保存形式に関する有益な[議論](https://x.com/allnightnihon2b/status/2030508273812820403?s=61)に対し、[@allnightnihon2b](https://x.com/allnightnihon2b?s=21) 様に感謝いたします。
*   カルテデータ保存形式に関する有益な[議論](https://x.com/air_h_128k_ilI/status/2030995854061142486?s=20)に対し、[@air_h_128k_ili](https://x.com/air_h_128k_ili?s=21) 様に感謝いたします。
*   orca受付eventの処理周りでは、元町皮ふ科の松村先生の[リポジトリ](https://github.com/pinus/OpenDolphin-1.3.0)を参考にさせて頂きました。



## Original License & Credits

本プロジェクトは以下の OpenDolphin 2.7.1 をフォーク・継承しています。
フォーク元のライセンスについては議論があります。必ずフォーク元のライセンスの議論についてはお調べ頂きますよう、お願いいたします。

このリポジトリを利用を検討される方の判断材料とすべく、開発と並行して、あくまでgit履歴からおえる事実をまとめていきます。現時点では調査途上です。


- Git 履歴調査: [minagawa署名git履歴調査_20260310.md](src/discovery/minagawa署名git履歴調査_20260310.md)
- Git 履歴調査: [LICENSE_git履歴調査_20260310.md](src/discovery/LICENSE_git履歴調査_20260310.md)
- Git 履歴調査: [ライセンス_コード著者アカウント同一性時系列調査_20260313.md](src/discovery/ライセンス_コード著者アカウント同一性時系列調査_20260313.md)


### OpenDolphin 2.7.1
*   皆川和史、王勝偉　[オープンドルフィン・ラボ](http://www.opendolphin.com)

### ライセンス & 謝辞
*   OpenDolphinのライセンスは GNU GPL3 です。
*   OpenDolphinは下記先生方の開発されたソースコードを含んでいます。
    - 札幌市元町皮ふ科の松村先生
    - 和歌山市増田内科の増田先生
    - 新宿ヒロクリニック
    - 日本RedHat Takayoshi KimuraさんのJBoss as7 へのポーティング

これらの部分の著作権はそれぞれの先生に帰属します。


### このリポジトリの開発につきまして
2026年3月10日現在、GPT 5.4Pro 思考拡張モードによる方針策定、およびgpt 5.4 highをメインにしたバイブコーディングで作業を行っております。
PR、Issue大歓迎で、マージも積極的にさせていただきますが、H.Inomata 様のPR [#68](https://github.com/circlemouth/OpenDolphinNext/pull/68)のように、マージ直後に上書きされて実質無効化されてしまう事案も度々発生するかと思います。
何卒ご容赦のほどよろしくお願いいたします。

なお、このリポジトリの開発のモチベーションは、以下の２点につきます。
  - [自分用に好きにカスタマイズして使える、自前管理できるカルテがほしい](https://x.com/MedRecMate/status/2031004763761066177?s=20)
  - [経済産業省時代の公金が注ぎ込まれた産物がこのまま、古いjavaやwildflyベースがために使われなくなって放置されていくのはもったいない](https://x.com/MedRecMate/status/2030993792476782957?s=20)

ご意見をいただける場合は、XもしくはこのリポジトリのPR、Issue等からお願いいたします。
