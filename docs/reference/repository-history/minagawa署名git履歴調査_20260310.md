# minagawa署名コード Git履歴調査（RUN_ID=20260310T050041Z）

- 作成日: 2026-03-10
- 調査対象: `minagawa` 署名コメント（`//minagawa^ ... //minagawa$`）および `Kazushi Minagawa` 名義の関連履歴
- 調査方法: `git log --follow`, `git log -S`, `git show`, `git blame`, `git shortlog`

## 確認できた事実
1. `minagawa` 署名入りコードは、2014-02-02 に取り込まれた版スナップショット群の時点で既に存在する。
2. 代表事例 3 件のうち 2 件では、`minagawa` コメントが実装変更と同じ差分で現れる。
3. 残る 1 件では、Git 初出時点で既に `minagawa` コメントと `Kazushi Minagawa` 名義のファイルヘッダが含まれている。
4. このリポジトリの初期 Git 履歴は 2014-02-02 に複数版をまとめて投入したスナップショット型であり、2012-2013 当時の粒度ある原始コミットは残っていない。

## 前提と制約

### 1. このリポジトリは 2014-02-02 に過去版をまとめて Git 化している
履歴冒頭は次の通りで、同日に複数バージョンが並んでいる。

| Git日付 | コミット | 作者 | 件名 |
| --- | --- | --- | --- |
| 2014-02-02 | `e528bffb3` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 1.0.1 |
| 2014-02-02 | `8ab25c1c5` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 1.2.6 |
| 2014-02-02 | `46dc7e348` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 1.3.0 |
| 2014-02-02 | `90be8e4c7` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 1.4.7 |
| 2014-02-02 | `b2d3de19c` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 2.0.3 |
| 2014-02-02 | `00894efcf` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 2.4.1 |
| 2014-02-02 | `741953d26` | Open Dolphin `<dolphin@digital-globe.co.jp>` | Version 2.4.4 |

コメント内の `2012-07` や `2013/06/24` は、Git コミット日時とは一致しない。Git に残っているのは、版スナップショットが投入された日時である。

### 2. `git blame` 単独では誤認する
現行ブランチでは、対象行の `blame` が 2025-11-07 の `1bde3b9e2b`（`circlemouth`, 件名 `サーバーでバッグ`）を指す箇所が多い。これは後年の再導入・コピーで行単位の帰属が上書きされているためで、**初出判定には `git log --follow` と `git log -S` が必須**である。

## 署名位置の全体像

`//minagawa^` を含むファイルを現行ワークツリーで棚卸しすると、**155 ファイル**確認できる。

| 領域 | ファイル数 |
| --- | ---: |
| `client` | 55 |
| `common` | 14 |
| `server` | 51 |
| `server-modernized` | 35 |

以下に、`minagawa` 署名が残っているコード位置の**50件サンプル**を示す。目的は「どこに残っているか」を追えるようにすることであり、全件の履歴深掘りを実施したわけではない。履歴の深掘りは後述の代表事例 3 件で実施した。

### 位置確認事例 50 件

| No. | 現行ファイル | 初出行 | 最初に確認した署名コメント |
| --- | --- | ---: | --- |
| 1 | `client/src/main/java/open/dolphin/client/AbstractCodeHelper.java` | 29 | `Icon Server` |
| 2 | `client/src/main/java/open/dolphin/client/AllergyInspector.java` | 133 | `排他制御` |
| 3 | `client/src/main/java/open/dolphin/client/CalendarCardPanel.java` | 116 | `I18N` |
| 4 | `client/src/main/java/open/dolphin/client/ChangeNumDatesDialog.java` | 45 | `mac jdk7` |
| 5 | `client/src/main/java/open/dolphin/client/ChartDocument.java` | 43 | `Chart（インスペクタ画面）の closebox 押下に対応するため` |
| 6 | `client/src/main/java/open/dolphin/client/ChartEventHandler.java` | 298 | `2015/03/11 メッセージの評判がよくないので表示なし` |
| 7 | `client/src/main/java/open/dolphin/client/ChartImpl.java` | 1614 | `LSC Test` |
| 8 | `client/src/main/java/open/dolphin/client/ChartMediator.java` | 460 | `LSC 1.4 bug fix 元へ返す... テキストスタンプが所見欄にしか張り付かない 2013/06/24` |
| 9 | `client/src/main/java/open/dolphin/client/ClaimSender.java` | 26 | `UUIDの変わりに保険情報モジュールを送信する` |
| 10 | `client/src/main/java/open/dolphin/client/DiagnosisDocument.java` | 1176 | `この処理が必要な場合はバグ` |
| 11 | `client/src/main/java/open/dolphin/client/DocumentHistory.java` | 694 | `紹介状の場合は singleSelection` |
| 12 | `client/src/main/java/open/dolphin/client/Dolphin.java` | 205 | `Server-ORCA連携` |
| 13 | `client/src/main/java/open/dolphin/client/KarteDocumentViewer.java` | 490 | `Kuroiwa specific` |
| 14 | `client/src/main/java/open/dolphin/client/KarteEditor.java` | 1385 | `LSC Test Attachment` |
| 15 | `client/src/main/java/open/dolphin/client/KartePane.java` | 638 | `LSC Test` |
| 16 | `client/src/main/java/open/dolphin/client/KarteStyledDocument.java` | 306 | `LSC Test` |
| 17 | `client/src/main/java/open/dolphin/client/LiteCalendarPanel.java` | 138 | `I18N` |
| 18 | `client/src/main/java/open/dolphin/client/MacMenuFactory.java` | 641 | `統計情報` |
| 19 | `client/src/main/java/open/dolphin/client/SaveDialogNoSendAtTmp.java` | 267 | `CLAIM送信日` |
| 20 | `client/src/main/java/open/dolphin/client/WindowsMenuFactory.java` | 746 | `Icon Server` |
| 21 | `common/src/main/java/open/dolphin/converter/DiagnosisSendWrapperConverter.java` | 105 | `LSC 1.4 傷病名の削除 2013/06/24` |
| 22 | `common/src/main/java/open/dolphin/converter/DocInfoModelConverter.java` | 205 | `CLAIM送信(予定カルテ対応)` |
| 23 | `common/src/main/java/open/dolphin/converter/PatientModelConverter.java` | 119 | `(空コメント)` |
| 24 | `common/src/main/java/open/dolphin/converter/PatientVisitModelConverter.java` | 86 | `予定カルテ(予定カルテ対応)` |
| 25 | `common/src/main/java/open/dolphin/converter/StampTreeModelConverter.java` | 77 | `排他制御` |
| 26 | `common/src/main/java/open/dolphin/infomodel/BundleMed.java` | 194 | `LSC 1.4 bug fix 同一用法まとめる 2013/06/24` |
| 27 | `common/src/main/java/open/dolphin/infomodel/DocInfoModel.java` | 186 | `会計上送信日を変更(予定カルテ対応)` |
| 28 | `common/src/main/java/open/dolphin/infomodel/LastDateCount30.java` | 42 | `(空コメント)` |
| 29 | `common/src/main/java/open/dolphin/infomodel/ModuleInfoBean.java` | 69 | `入院対応` |
| 30 | `common/src/main/java/open/dolphin/infomodel/NLaboModule.java` | 53 | `入院` |
| 31 | `server/src/main/java/open/dolphin/adm10/converter/IAbstractModule.java` | 45 | `所見モジュールから親のカルテ参照` |
| 32 | `server/src/main/java/open/dolphin/adm10/converter/IAbstractModule30.java` | 45 | `Documentへの参照` |
| 33 | `server/src/main/java/open/dolphin/adm10/converter/IDocInfo.java` | 84 | `CLAIM送信日` |
| 34 | `server/src/main/java/open/dolphin/adm10/converter/IDocument.java` | 199 | `Attachemnt 対応` |
| 35 | `server/src/main/java/open/dolphin/adm10/converter/IDocument2.java` | 298 | `カルテのタイトルへ表示` |
| 36 | `server/src/main/java/open/dolphin/adm10/converter/IPatientModel.java` | 114 | `ios7 EHRTouchで新患検索用に追加` |
| 37 | `server/src/main/java/open/dolphin/adm10/rest/AbstractResource.java` | 46 | `VisitTouch追加` |
| 38 | `server/src/main/java/open/dolphin/adm10/rest/JSONStampBuilder.java` | 117 | `(空コメント)` |
| 39 | `server/src/main/java/open/dolphin/adm10/rest/JsonTouchResource.java` | 87 | `2013/08/29` |
| 40 | `server/src/main/java/open/dolphin/adm10/session/ADM10_IPhoneServiceBean.java` | 278 | `処方がない場合は全コピーになってしまう` |
| 41 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IAbstractModule.java` | 45 | `所見モジュールから親のカルテ参照` |
| 42 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IAbstractModule30.java` | 45 | `Documentへの参照` |
| 43 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocInfo.java` | 137 | `EHT add` |
| 44 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocument.java` | 201 | `Attachemnt 対応` |
| 45 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocument2.java` | 298 | `カルテのタイトルへ表示` |
| 46 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IPatientModel.java` | 112 | `ios7 EHRTouchで新患検索用に追加` |
| 47 | `server-modernized/src/main/java/open/dolphin/adm10/rest/JSONStampBuilder.java` | 119 | `(空コメント)` |
| 48 | `server-modernized/src/main/java/open/dolphin/adm10/session/ADM10_IPhoneServiceBean.java` | 280 | `処方がない場合は全コピーになってしまう` |
| 49 | `server-modernized/src/main/java/open/dolphin/adm20/converter/IAbstractModule.java` | 45 | `所見モジュールから親のカルテ参照` |
| 50 | `server-modernized/src/main/java/open/dolphin/adm20/converter/IAbstractModule30.java` | 45 | `Documentへの参照` |

## 履歴深掘り 30 件

以下の 30 件について、`現行の署名位置`、`ファイル初出コミット`、`署名確認最古コミット`、`署名確認コミット時点の周辺行` を記録する。  
`署名確認最古コミット` は `git log --follow --reverse -G 'minagawa\\^'` を基本に確認し、ファイル初出時点で既に署名を含む場合は初出コミットを記載した。

| No. | 現行ファイル | 現行行 | 署名コメント | ファイル初出コミット | 署名確認最古コミット | 署名確認コミット時点の周辺行 |
| --- | --- | ---: | --- | --- | --- | --- |
| 1 | `client/src/main/java/open/dolphin/client/AbstractCodeHelper.java` | 29 | `Icon Server` | `8ab25c1c5 / 2014-02-02 / Version 1.2.6` | `00894efcf / 2014-02-02 / Version 2.4.1` | `//minagawa^ Icon Server` / `static final Icon icon = ClientContext.getImageIconArias("icon_foldr_small");` |
| 2 | `client/src/main/java/open/dolphin/client/AllergyInspector.java` | 133 | `排他制御` | `8ab25c1c5 / 2014-02-02 / Version 1.2.6` | `00894efcf / 2014-02-02 / Version 2.4.1` | `AllergyEditor ae = new AllergyEditor(AllergyInspector.this);` / `final int row = view.getTable().rowAtPoint(e.getPoint());` |
| 3 | `client/src/main/java/open/dolphin/client/CalendarCardPanel.java` | 116 | `I18N` | `8ab25c1c5 / 2014-02-02 / Version 1.2.6` | `00894efcf / 2014-02-02 / Version 2.4.1` | `//titleLable.setMaximumSize(s);` / `JPanel cmdPanel = createCommnadPanel();` |
| 4 | `client/src/main/java/open/dolphin/client/ChangeNumDatesDialog.java` | 45 | `mac jdk7` | `f872303e9 / 2014-02-02 / Version 2.1.2M` | `00894efcf / 2014-02-02 / Version 2.4.1` | `view.getNumDatesFld().getDocument().addDocumentListener(new DocumentListener() {` |
| 5 | `client/src/main/java/open/dolphin/client/ChartDocument.java` | 43 | `Chart（インスペクタ画面）の closebox 押下に対応するため` | `46dc7e348 / 2014-02-02 / Version 1.3.0` | `00894efcf / 2014-02-02 / Version 2.4.1` | `//minagawa^ Chart（インスペクタ画面）の closebox 押下に対応するため` / `public void addPropertyChangeListener(String prop, PropertyChangeListener l);` |
| 6 | `client/src/main/java/open/dolphin/client/ChartEventHandler.java` | 298 | `2015/03/11 メッセージの評判がよくないので表示なし` | `00894efcf / 2014-02-02 / Version 2.4.1` | `00894efcf / 2014-02-02 / Version 2.4.1` | `@Override` / `public void run() {` |
| 7 | `client/src/main/java/open/dolphin/client/ChartImpl.java` | 1614 | `LSC Test` | `46dc7e348 / 2014-02-02 / Version 1.3.0` | `00894efcf / 2014-02-02 / Version 2.4.1` | `ClientContext.getBootLogger().debug("found uuid to apply = " + uuid);` |
| 8 | `client/src/main/java/open/dolphin/client/ChartMediator.java` | 460 | `LSC 1.4 bug fix 元へ返す... テキストスタンプが所見欄にしか張り付かない 2013/06/24` | `e528bffb3 / 2014-02-02 / Version 1.0.1` | `e528bffb3 / 2014-02-02 / Version 1.0.1` | `//minagawa^ LSC 1.4 bug fix 元へ返す... テキストスタンプが所見欄にしか張り付かない 2013/06/24` / `JComponent comp = getCurrentComponent();` / `if (comp == null) { comp = kartePane.getTextPane(); }` |
| 9 | `client/src/main/java/open/dolphin/client/ClaimSender.java` | 26 | `UUIDの変わりに保険情報モジュールを送信する` | `b2d3de19c / 2014-02-02 / Version 2.0.3` | `00894efcf / 2014-02-02 / Version 2.4.1` | `//minagawa^ UUIDの変わりに保険情報モジュールを送信する` / `private PVTHealthInsuranceModel insuranceToApply;` |
| 10 | `client/src/main/java/open/dolphin/client/DiagnosisDocument.java` | 1176 | `この処理が必要な場合はバグ` | `e528bffb3 / 2014-02-02 / Version 1.0.1` | `00894efcf / 2014-02-02 / Version 2.4.1` | `if (!go) {` |
| 11 | `client/src/main/java/open/dolphin/client/DocumentHistory.java` | 694 | `紹介状の場合は singleSelection` | `b2d3de19c / 2014-02-02 / Version 2.0.3` | `00894efcf / 2014-02-02 / Version 2.4.1` | `/**` / `* 検索パラメータの抽出期間を返す。` |
| 12 | `client/src/main/java/open/dolphin/client/Dolphin.java` | 205 | `Server-ORCA連携` | `e528bffb3 / 2014-02-02 / Version 1.0.1` | `00894efcf / 2014-02-02 / Version 2.4.1` | `Project.setBoolean(GUIConst.SEND_CLAIM_IS_RUNNING, true);` / `Project.setBoolean(GUIConst.SEND_CLAIM_IS_RUNNING, false);` |
| 13 | `common/src/main/java/open/dolphin/converter/DiagnosisSendWrapperConverter.java` | 105 | `LSC 1.4 傷病名の削除 2013/06/24` | `00894efcf / 2014-02-02 / Version 2.4.1` | `741953d26 / 2014-02-02 / Version 2.4.4` | `//minagawa^ LSC 1.4 傷病名の削除 2013/06/24` / `public List<RegisteredDiagnosisModelConverter> getDeletedDiagnosis() {` |
| 14 | `common/src/main/java/open/dolphin/converter/DocInfoModelConverter.java` | 205 | `CLAIM送信(予定カルテ対応)` | `b2d3de19c / 2014-02-02 / Version 2.0.3` | `b2d3de19c / 2014-02-02 / Version 2.0.3` | `//minagawa^ CLAIM送信(予定カルテ対応)` / `public Date getClaimDate() {` / `return model.getClaimDate();` |
| 15 | `client/src/main/java/open/dolphin/impl/lbtest/LaboTestPanel.java` | 60 | `全件表示修正^` | `90be8e4c7 / 2014-02-02 / Version 1.4.7` | `741953d26 / 2014-02-02 / Version 2.4.4` | `private static final int DIALOG_HEIGHT = 768;` / `private ListTableModel<LabTestRowObject> tableModel;` |
| 16 | `server/src/main/java/open/dolphin/adm10/converter/IAbstractModule.java` | 45 | `所見モジュールから親のカルテ参照` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ 所見モジュールから親のカルテ参照` / `private long docPK;` |
| 17 | `server/src/main/java/open/dolphin/adm10/converter/IAbstractModule30.java` | 45 | `Documentへの参照` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ Documentへの参照` / `private long docPK;` |
| 18 | `server/src/main/java/open/dolphin/adm10/converter/IDocInfo.java` | 84 | `CLAIM送信日` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `boolean private String sendLabtest;` |
| 19 | `server/src/main/java/open/dolphin/adm10/converter/IDocument.java` | 199 | `Attachemnt 対応` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ Attachemnt 対応` / `public List<IAttachmentModel> getAttachment() {` |
| 20 | `server/src/main/java/open/dolphin/adm10/converter/IDocument2.java` | 298 | `カルテのタイトルへ表示` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ カルテのタイトルへ表示` / `if (model.getUserModel()!=null)` |
| 21 | `server/src/main/java/open/dolphin/adm10/converter/IPatientModel.java` | 114 | `ios7 EHRTouchで新患検索用に追加` | `b2d3de19c / 2014-02-02 / Version 2.0.3` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ ios7 EHRTouchで新患検索用に追加` / `public String getFirstVisited() {` |
| 22 | `server/src/main/java/open/dolphin/adm10/rest/AbstractResource.java` | 46 | `VisitTouch追加` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ VisitTouch追加` / `protected static final String ELEMENT_USER_PK = "pk";` |
| 23 | `server/src/main/java/open/dolphin/adm10/rest/JSONStampBuilder.java` | 117 | `(空コメント)` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^` / `StringWriter sw = new StringWriter();` / `ObjectMapper mapper = new ObjectMapper();` |
| 24 | `server/src/main/java/open/dolphin/adm10/rest/JsonTouchResource.java` | 87 | `2013/08/29` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ 2013/08/29` / `//@Resource(mappedName="java:jboss/datasources/OrcaDS")` |
| 25 | `server/src/main/java/open/dolphin/adm10/session/ADM10_IPhoneServiceBean.java` | 278 | `処方がない場合は全コピーになってしまう` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `//minagawa^ 処方がない場合は全コピーになってしまう` / `document.setModules(null);` |
| 26 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IAbstractModule.java` | 45 | `所見モジュールから親のカルテ参照` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `1bde3b9e2 / 2025-11-07 / サーバーでバッグ` | `//minagawa^ 所見モジュールから親のカルテ参照` / `private long docPK;` |
| 27 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IAbstractModule30.java` | 45 | `Documentへの参照` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `1bde3b9e2 / 2025-11-07 / サーバーでバッグ` | `//minagawa^ Documentへの参照` / `private long docPK;` |
| 28 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocInfo.java` | 137 | `EHT add` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `1bde3b9e2 / 2025-11-07 / サーバーでバッグ` | `private String chkHomeMedical;` / `private String useGeneralName;` |
| 29 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocument.java` | 201 | `Attachemnt 対応` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `1bde3b9e2 / 2025-11-07 / サーバーでバッグ` | `//minagawa^ Attachemnt 対応` / `public List<IAttachmentModel> getAttachment() {` |
| 30 | `server-modernized/src/main/java/open/dolphin/adm10/converter/IDocument2.java` | 298 | `カルテのタイトルへ表示` | `7c7d7eb97 / 2015-10-07 / Internationalization support` | `1bde3b9e2 / 2025-11-07 / サーバーでバッグ` | `//minagawa^ カルテのタイトルへ表示` / `if (model.getUserModel()!=null)` |

## 代表事例の調査結果

### 1. `ClaimSender`: 署名コメントと実装変更が同じ差分で入っている

- 現行位置: `client/src/main/java/open/dolphin/client/ClaimSender.java`
- 主要現行行:
  - `//minagawa^ UUIDの変わりに保険情報モジュールを送信する`
  - `//minagawa^ 2012-07 claimConnectionを追加`
  - `//minagawa^ CLAIM送信 日をまたいだが、前日で送る必要がある場合等(予定カルテ対応)`

#### 履歴確認
- `b2d3de19c` (`Version 2.0.3`) の前身ファイル `OpenDolphin_2.0/src/open/dolphin/client/ClaimSender.java` には、対応箇所はあるが `minagawa` 署名コメントは存在しない。
- `00894efcf6acce03b0dd7f3bd36b0f83614c4800` (`Version 2.4.1`, Git日付 2014-02-02, 本文に `2013年4月16日`) で、`ClaimSender` に以下が**同時に入る**。
  - `send` フラグ追加
  - `Project.claimSenderIsClient()` を使う `claimConnection` 対応
  - `DocInfoModel` 取得の差し替え
  - `claimDate` 優先の送信日制御
  - 上記変更箇所を囲う `//minagawa^ ... //minagawa$`

#### 事実
- `ClaimSender` では、`minagawa` コメントが `send` フラグ追加、`claimConnection` 対応、`claimDate` 優先の送信日制御と同じ差分で現れる。
- コメント内の `2012-07` は、コミット本文の版日付 `2013年4月16日` より前である。

### 2. `OrcaResource`: Git 初出時点で Minagawa 名義を含み、後続版でも署名付き変更が増えている

- 現行位置: `server/src/main/java/open/orca/rest/OrcaResource.java`
- 現行ヘッダ: `@author Kazushi Minagawa. Digital Globe, Inc.`
- 現行 `minagawa` ブロック例:
  - `//minagawa^ Client-ORCA接続の場合`
  - `//minagawa^ BUG`
  - `//minagawa^ 2013/08/29`
  - `//minagawa^ LSC 1.4 .334問題 2013/06/24`

#### 履歴確認
- `00894efcf6acce03b0dd7f3bd36b0f83614c4800` (`Version 2.4.1`) で `OrcaResource.java` は Git 上に新規追加される。
- その**Git 初出時点**で、既に次が入っている。
  - `@author Kazushi Minagawa. Digital Globe, Inc.`
  - `//minagawa^ Client-ORCA接続の場合`
  - `//minagawa^ BUG`
- `741953d26637c2a9ad6adec96652b03ab2c145ba` (`Version 2.4.4`, Git日付 2014-02-02, 本文に `2014年2月1日`) では、以下の `minagawa` 署名付き変更が**実装と同時に追加**される。
  - `2013/08/29` コメント付きで JBoss `DataSource` を無効化し、`ORCAConnection.getInstance().getConnection()` に切り替える変更
  - `LSC 1.4 .334問題 2013/06/24` コメント付きで注射区分判定を `300-352` から `300-399` へ広げる変更

#### 事実
- `OrcaResource.java` は `Version 2.4.1` で Git 上に新規追加され、その時点で `Kazushi Minagawa` 名義ヘッダと `minagawa` コメントを含む。
- `Version 2.4.4` では、`2013/08/29` および `2013/06/24` を含む `minagawa` コメント付き変更が追加される。

### 3. `LaboTestPanel`: 前身には無かった署名付き修正が 2.4.4 でまとまって入る

- 現行位置: `client/src/main/java/open/dolphin/impl/lbtest/LaboTestPanel.java`
- 現行 `minagawa` ブロック例:
  - `//minagawa^ 全件表示修正^`
  - `//minagawa^ LSC 1.4 bug fix ラボデータの削除 2013/06/24`

#### 履歴確認
- 前身ファイルは `90be8e4c710fb181bdf3194d61668b929642dfe8` (`Version 1.4.7`) の `LaboTestDocument-1.4/src/open/dolphin/client/impl/LaboTestBean.java`。
- この前身版の該当箇所には、`minagawa` 署名コメントやラボ削除用の `modules` 保持・ヘッダ右クリック削除処理は確認できない。
- `741953d26637c2a9ad6adec96652b03ab2c145ba` (`Version 2.4.4`) で `LaboTestBean` から `LaboTestPanel` へ copy される差分の中で、次が**同時に追加**される。
  - `modules` フィールド追加
  - `moduleList` 保持と clear
  - ヘッダ右クリックでラボデータ削除を行う UI/処理
  - これらを囲う `//minagawa^ LSC 1.4 bug fix ラボデータの削除 2013/06/24`

#### 事実
- `LaboTestPanel` の前身 `LaboTestBean` の `Version 1.4.7` では、該当 `minagawa` コメントと削除処理は確認できない。
- `Version 2.4.4` では、`modules` フィールド追加、`moduleList` 保持、ヘッダ右クリック削除 UI/処理と同じ差分で `minagawa` コメントが現れる。
- コメント内の日付 `2013/06/24` は、コミット本文の版日付 `2014年2月1日` より前である。

## 補強材料

### 1. 2.4.1 の README に Minagawa 氏名が明示されている
`00894efcf6acce03b0dd7f3bd36b0f83614c4800` の `README.md` 冒頭には、次の記載がある。

- `2013-04-16　皆川和史　ライフサイエンスコンピューティング（株）`

同コミットの `License-sjis.txt` でも、著作権表記が `Kazushi Minagawa` ベースで更新されている。

### 2. Git author に `kazushi.minagawa@mac.com` が存在する
`git shortlog -sne --all` では次が確認できる。

- `Open Dolphin <kazushi.minagawa@mac.com>`: 5 commits
- `dolphin-dev <kazushi.minagawa@mac.com>`: 2 commits

代表例:

| Git日付 | コミット | 作者 | 件名 |
| --- | --- | --- | --- |
| 2015-08-08 | `ba93b8aaa76175376c1119bcdc4c975ae12cf2de` | Open Dolphin `<kazushi.minagawa@mac.com>` | Version 2.6.0 |
| 2016-04-12 | `a3005970363917c3c6ca194f928ce144af45c56e` | dolphin-dev `<kazushi.minagawa@mac.com>` | minor fix pom.xml, README |
| 2016-04-14 | `4760f40502d2b314f629949bd71b7d87fdfb553c` | dolphin-dev `<kazushi.minagawa@mac.com>` | Test commit |

## 補足事項

1. 2012-2013 当時の私有リポジトリや版管理外の原始履歴は、このリポジトリには残っていない。
2. 現行ファイルへの `git blame` は 2025 年の再導入コミットを指す箇所があり、初出確認には `git log --follow` と `git log -S` を使用した。

## 再現コマンド

```bash
git log --reverse --format='%h %ad %an <%ae> %s' --date=short --all | sed -n '1,12p'
git log --follow -p --reverse -S'minagawa^ 2012-07 claimConnectionを追加' -- client/src/main/java/open/dolphin/client/ClaimSender.java
git log --follow -p --reverse -S'minagawa^ LSC 1.4 bug fix ラボデータの削除 2013/06/24' -- client/src/main/java/open/dolphin/impl/lbtest/LaboTestPanel.java
git log --follow -p --reverse -S'minagawa^ 2013/08/29' -- server/src/main/java/open/orca/rest/OrcaResource.java
git show 00894efcf6acce03b0dd7f3bd36b0f83614c4800:client/src/main/java/open/dolphin/client/ClaimSender.java | sed -n '20,100p'
git show 90be8e4c710fb181bdf3194d61668b929642dfe8:LaboTestDocument-1.4/src/open/dolphin/client/impl/LaboTestBean.java | sed -n '40,140p'
git blame --date=iso -L 54,89 client/src/main/java/open/dolphin/client/ClaimSender.java
```
