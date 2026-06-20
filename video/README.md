# AIトレンド Digest — 動画生成 (Remotion)

既存の日次 Markdown + ナレーション音声 (`public/audio/daily/<date>.mp3`) から、
YouTube 向けの解説動画 (1920×1080 / H.264+AAC) を生成する Remotion プロジェクト。

字幕は **強制アライメント**で生成する: 表示テキストは台本そのまま（誤認識ゼロ）、
タイミングだけ Whisper の語単位タイムスタンプから借りる。台本文字列と Whisper 出力を
LCS で対応付け、各字幕を「実際に喋っている瞬間」に出す（音声は作り直さない）。
トピックカードも、台本内のキーワード位置を同じ時間軸に写像して同期させる。

```
src/content/docs/daily/<date>.md   (トピック)        public/audio/daily/<date>.mp3 (ナレーション)
                       \                                   /
                        →  scripts/build-data.mjs  ←  OpenAI Whisper (字幕の時間軸)
                                   ↓
                        video/data/<date>.json   (1日分を表す唯一の JSON)
                                   ↓
                        Remotion (src/) ── render / publish-assets ──→ out/video/daily/<date>/
```

1日分の成果物は **日付フォルダ 1 つ**にまとまる（`research/daily/<date>/` と同じ流儀）:

```
out/video/daily/<date>/
├── video.mp4         # 本編（render）
├── thumbnail.png     # YouTube サムネイル 1280x720（publish-assets）
├── captions.srt      # 字幕（publish-assets）
├── chapters.txt      # 概要欄に貼るチャプター（publish-assets）
└── description.txt   # 概要欄テンプレ（publish-assets）
```

## このプロジェクトの位置づけ

Astro 本体とは依存を分離するため、`video/` は独自の `package.json` /
`pnpm-workspace.yaml` を持つ **独立プロジェクト**（React + Remotion + Chromium）。
生成物 (`out/`) と字幕データ (`video/data/`) は `.gitignore` 済み。

## 前提

- リポジトリ直下に `.env`（`OPENAI_API_KEY` … Whisper 用。`--no-whisper` なら不要）
- `ffmpeg` / `ffprobe`（音声長の取得に使用）
- Node 18+ / pnpm

## セットアップ

```bash
cd video
pnpm install            # React + Remotion を隔離インストール（Chromium は初回 render 時に取得）
```

## 使い方

```bash
# 1) データ生成（Whisper で字幕の時間軸を作成）
pnpm build-data -- --date 2026-06-18
pnpm build-data -- --date 2026-06-18 --no-whisper   # API を使わず台本から等間隔で割り当て
pnpm build-data -- --date 2026-06-18 --force        # 既存 data を上書き

# 2) レンダリング（out/video/daily/<date>/video.mp4 へ出力）
pnpm render -- --date 2026-06-18
pnpm render -- --date 2026-06-18 --concurrency=4     # 余分な引数は remotion render に渡る

# 3) 公開素材（同じ日付フォルダに chapters / srt / description / thumbnail を生成）
pnpm publish-assets -- --date 2026-06-18

# 4) プレビュー / 字幕・レイアウトの調整
pnpm studio
```

`video/data/<date>.json` は人手で編集可能（誤認識した字幕の修正、トピック表示時刻 `startMs`
の微調整など）。編集後に `pnpm render` すれば即反映される。

## 構成

- `src/DailyDigest.tsx` — 本編の合成（音声・背景・ヘッダ・カバー・各トピック・字幕・進捗バー）
- `src/Thumbnail.tsx` — サムネイル合成（1280x720、字幕なし・頭条大字）
- `src/components/` — 各シーン / 部品
- `src/theme.ts` — ブランド配色とフォント（`src/assets/ai-trend-logo.svg` 由来）
- `scripts/build-data.mjs` — Markdown 解析 + Whisper + 強制アライメント → `data/<date>.json`
- `scripts/render.mjs` — `remotion render` の薄いラッパ（→ `out/video/daily/<date>/video.mp4`）
- `scripts/publish-assets.mjs` — chapters / srt / description / thumbnail を日付フォルダに生成

## 既知の制約 / 次の改善候補

- 字幕テキストは台本準拠なので正確（強制アライメント済み）。タイミングが微妙な日は
  `video/data/<date>.json` の `captions[].startMs` を手で微調整できる。
- `--no-whisper` 時は台本を文字数で比例配分するだけなので、字幕/カードのタイミングは近似。
- 縦型 (9:16 Shorts)、BGM 多重トラック、サムネイル自動生成、YouTube 自動アップロードは未実装。
- **公式デモ動画 / 画像の差し込み**: `Topic` に `media` フィールドを足し、`TopicScene` で
  `<Img>` / `<OffthreadVideo>` を出すだけで拡張できる（データ駆動なので構造変更は不要）。
- Remotion は個人/小規模は無料、一定規模の企業は商用ライセンスが必要（利用前に要確認）。
