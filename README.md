# 足を上げましょう（ashi-up）

高齢者向け動作トレーニングWebアプリのPoC。カメラ映像から骨格を推定し、画面上の **Target（目標位置）に右足首を合わせる**ゲーム形式で「片足上げ」を行います。

- 骨格推定は MediaPipe Pose Landmarker（`@mediapipe/tasks-vision`、VIDEOモード）をブラウザ内で実行
- **カメラ映像・骨格データは外部に送信しません**（WASM・モデルも同一オリジンから配信）
- Frontend: React + TypeScript + Vite / Backend なし

> ⚠️ 片足上げは転倒の可能性があります。**安定した支持物（壁・手すり・椅子の背）の近く**で使用してください。実際の高齢者を対象とする評価の前に、安全性の確認が必要です。

## 使い方

1. 「開始」→ カメラを許可
2. 全身（腰〜足首）が映る位置でまっすぐ立つ（約1秒静止すると基準姿勢を取得）
3. Target が表示されたら、右足を上げて足首（オレンジ色の点）を Target に合わせる
4. 0.7秒間入り続けると CLEAR → 「成功!」 →「やり直す」で再挑戦

全身が映らない／人物が大きく動いた場合は、自動的に基準を取り直します。

## 開発

要件: Node.js 20 以上

```bash
npm install
npm run dev      # http://localhost:5173/ashi-up/
npm test         # 判定ロジックのテスト（vitest）
npm run build    # dist/ に出力
npm run preview
```

カメラは `localhost` または HTTPS でのみ使えます。スマホ実機で試すには GitHub Pages の URL を開くのが簡単です。

### 開発者用設定

URL に `?dev` を付けると右下に開発者パネルが出ます（通常画面には出ません）。

- Target の高さ・半径（脚長比）、保持時間の調整
- 上げる足（左右）、前面／背面カメラの切り替え
- fps・使用中のデリゲート（GPU/CPU）・Target までの距離・膝角度の表示

## 判定の仕組み

| 項目 | 内容 |
| --- | --- |
| 使用ランドマーク | 腰 23/24、膝 25/26、足首 27/28 |
| 基準姿勢 | 全身が映り、両脚が真っ直ぐ・左右の脚長が近く、約1秒静止したときの平均 |
| Target 位置 | 基準の足首の真上、**腰→足首の距離の30%**（PoC暫定値。医学的に検証された基準ではありません） |
| Target 半径 | 腰→足首の距離の15%（暫定値） |
| 成功条件 | 足首が検出（信頼度 0.5 以上）され、Target 内に **0.7秒連続**で入る |
| 安定化 | 座標の指数移動平均、Target 境界のヒステリシス、フレーム落ち時の時間加算上限 |
| 誤判定防止 | Target は基準姿勢で固定。立位のままでは Target の外にあるため CLEAR にならない |

座標はすべて**動画のピクセル座標**で計算し、描画時のみ `src/geometry/viewTransform.ts` で表示座標へ変換します（映像の `object-fit: contain` と左右反転を一箇所で吸収するため、骨格・Target・映像がずれません）。前面カメラは鏡像表示です。

## 構成

```
src/
  camera/       getUserMedia / MediaStream の解放
  pose/         MediaPipe ラッパー（GPU→CPUフォールバック）、ランドマーク定義、平滑化
  logic/        純粋ロジック（calibration / target / reachJudge / formJudge）
  geometry/     座標変換
  engine/       推論ループ・状態遷移（Reactの再描画と独立）
  render/       canvas 描画
  components/   画面（Start / Training / Finish / Error / DevPanel）
tests/          ロジックのテスト
```

- Target 到達判定（`reachJudge`）とフォーム判定（`formJudge`、膝の曲げなど）は独立。フォーム判定は現状、開発者パネルの表示のみ
- 動作は `LegRaiseSpec`（左右・挙上量・半径・保持時間）で定義。左足上げは `side: 'left'` で動作します（UI からの選択は未実装）

## GitHub Pages への公開

`main` ブランチへ push すると `.github/workflows/deploy.yml` がテスト・ビルド・デプロイを行います。

初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。公開 URL は `https://<ユーザー名>.github.io/ashi-up/` です。

`vite.config.ts` の `base`（`/ashi-up/`）は**リポジトリ名と一致**させてください。リポジトリ名を変える場合は合わせて変更します。

## 対応ブラウザ

iOS Safari / Android Chrome / PC Chrome / PC Safari を想定（GPU が使えない環境では CPU に自動で切り替え）。

## ライセンス・クレジット

- MediaPipe Pose Landmarker（Apache-2.0）、モデル `pose_landmarker_lite`（`public/models/`）
