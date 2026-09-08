# AI Web Site Builder Agent

Cloudflareの無料枠で動く、AIエージェントが自律的にウェブサイトを開発するプロジェクトです。

## セットアップ

1. R2バケット `agent-builder-storage` を作成
2. Workers Builds でデプロイ
3. Worker URLにアクセスしてチャットで指示

## 無料枠ガード機能

- R2ストレージ8GB超過で書き込み停止
- ファイル数50超過で書き込み停止
- エージェント最大12ステップで自動停止
