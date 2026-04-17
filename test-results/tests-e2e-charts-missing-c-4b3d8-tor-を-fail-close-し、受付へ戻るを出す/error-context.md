# Page snapshot

```yaml
- main [ref=e3]:
  - region "OpenDolphin Web ログイン" [ref=e4]:
    - generic [ref=e5]:
      - heading "OpenDolphin Web ログイン" [level=1] [ref=e6]
      - img "OpenDolphin システムアイコン" [ref=e9]
      - status [ref=e10]:
        - paragraph [ref=e11]: ステップ 1/2
        - paragraph [ref=e12]: 認証情報の入力
        - paragraph [ref=e13]: 施設ID・ユーザーID・パスワードを確認してサインインします。
      - status [ref=e14]:
        - paragraph [ref=e15]: ログイン後の移動先
        - paragraph [ref=e16]: 移動先が指定されていなかったため、/f/1.3.6.1.4.1.9414.72.103/reception を既定の着地点として開きます。
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]: 施設ID
        - textbox "施設ID" [ref=e20]:
          - /placeholder: "例: 0001"
          - text: 1.3.6.1.4.1.9414.72.103
      - generic [ref=e21]:
        - generic [ref=e22]: ユーザーID
        - textbox "ユーザーID" [ref=e23]:
          - /placeholder: "例: doctor01"
          - text: doctor1
      - generic [ref=e24]:
        - generic [ref=e25]: パスワード
        - textbox "パスワード" [ref=e26]: pass
      - button "ログイン" [ref=e28] [cursor=pointer]
      - alert [ref=e29]: ログイン先が見つかりません。接続先設定を確認してください。
```