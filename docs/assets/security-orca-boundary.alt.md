# security-orca-boundary.png alt text

ブラウザは server-modernized の API だけに接続する。server-modernized は患者文脈検証、sanitized readiness、ORCA認証情報解決、監査・ログを担い、ORCA境界を越えて外部 ORCA API と通信する。認証情報や患者文脈の正本はブラウザに置かない。
