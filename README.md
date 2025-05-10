# line-obsidian-worker
lineの投稿をobsidianで読み込めるようにする君

## システム

```mermaid
sequenceDiagram
    participant LP as LINE Messaging API
    participant WS as cloudflare worker
    participant KV as KV Storage
    participant OB as Obsidian

    LP->>WS: Webhook Event
    WS->>KV: メッセージを格納
    Note over WS,KV: 10日保持
    
    OB->>WS: 同期処理
    WS-->>KV: メッセージを取得
    Note over WS,KV: 取得後10分保持
    WS->>OB: メッセージ連携
```

## その他システム

- **LINE Messaging API**: LINEから設定しwebhookをcloudflare workerのurlで登録
- **Obsidian**: [plugin](https://github.com/ujiuji1259/obsidian-line-plugin)をobsidianに登録
