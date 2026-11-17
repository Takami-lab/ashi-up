# CLAUDE.md

足を上げましょう：高齢者向け動作トレーニングの Web PoC（React + TypeScript + Vite、MediaPipe Pose、バックエンドなし、GitHub Pages）。

## 運用ルール
- 責任者は髙見仁人。不明点・確認が必要な事項は作業を中断して質問する。
- push・公開など外部に出る操作は、必ず事前に承認を得る。
- Claude の使用量の残りが 20%（週間・全モデルの使用率 80%）になったら作業を中断する。
- 未検証の事項は正直に報告する。実機カメラでの動作は未確認の項目が多い。
- 日本語で応答する。

## 開発
- `npm run dev` / `npm run build`（先に MediaPipe の WASM を `public/mediapipe/wasm` へコピー。gitignore 済み）
- `npm test`（vitest）、`npm run lint`（oxlint）
- Windows の PowerShell では毎回 PATH を更新する：
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User")`
- push は WSL 経由（Windows 側の gh は未認証）：
  `wsl -e bash -lc "cd /mnt/c/Users/student/ashi-up && git -c safe.directory='*' push origin main"`
- main への push で GitHub Actions が Pages にデプロイする。結果は `gh run list`（WSL 経由）で確認。

## 設計の要点
- 判定は動画ピクセル座標。脚長 L（縦）と腰幅 W（横）で正規化し、基準の立位姿勢に Target を固定する。
- 動作は 片足上げ → 横ステップ の順。各 700 ms 連続成立で成功、基準取得後 20 秒で時間切れ。
- 判定値の既定は `src/types.ts` の `DEFAULT_SPEC`。暫定値で、医学的根拠はない。
- 画面は `?dev` で開発者パネルを表示できる。

## ドキュメント
- 要件・判定条件：`docs/requirements.md`
- 画面・遷移：`docs/screens.md`
- 検証計画と記録表（WBS 8）：`docs/verification.md`

## 進捗（2026-11-18 時点）
- WBS 1〜7 完了・push 済み（コミット 51f3a4f）。
- WBS 8（実機・カメラ位置ごとの検証）は未実施。ユーザーが実機で行う。
- WBS 9（判定値の調整）は WBS 8 の結果待ち。
- WBS 10（GitHub 公開整備、11/19〜11/25）、WBS 11（最終デモ準備）は未着手。
- 未検証：実機カメラ（iPhone/Android/PC）、判定しきい値の妥当性、スマホ縦画面での全画面表示、横ステップ未達成時の画面表示。
