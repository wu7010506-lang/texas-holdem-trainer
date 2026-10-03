# RIVER. 德州撲克

一張六人牌桌、基本下注操作、即時勝率。單人 No-Limit Texas Hold'em 練習工具，不涉及真實金錢。

## 開發

Node.js 22.12+ 或 24 LTS，npm。

```sh
npm ci
npm run dev
npm test
npm run build
```

桌面與手機皆可操作。盲注 5 / 10，起始 1,000 籌碼。點擊合法動作進行牌局；結束後點「發下一手」。玩家破產時可補充籌碼並繼續，電腦破產則下一手自動補充。

## 介面與勝率

- 只保留牌桌、底池、手牌、籌碼、動作與勝率。移除歷史、重播、統計、Bot 編輯、診斷和設定介面及其持久化流程。
- 五個對手均使用新的 Expert 策略核心，風格差異只影響混合頻率與下注尺寸。舊規則、Elite 和 Apex 保留作為基準及回歸測試，不參與正式牌桌。
- Web Worker 在背景同時模擬所有存活對手，使用 2,500 次 Monte Carlo 模擬。單挑河牌使用精確枚舉。
- 「勝率估計」是**預期底池份額**，包含多人平手分池；它不是獨贏機率，也不包含下注造成的棄牌率。以未知隨機手牌作為透明的數學參考，非 GTO 建議。介面顯示約 95% 抽樣誤差，不能涵蓋對手範圍假設的誤差。
- 計算請求只包含玩家自己的牌、已發出的公牌及對手公開資料；換手、棄牌、對手數量改變時取消舊計算，避免顯示過期結果。

## 結構

```text
src/engine/       規則、發牌、牌型、主邊池、動作驗證
src/bot/expert/   五個獨立策略記憶、翻前策略、範圍推估、決策搜尋與背景 Worker
src/bot/          共用分析、舊策略基準、統一合法動作鉗制
src/equity/       公開資訊請求邊界與背景勝率計算
src/store/        單一牌局 session、串行 Bot 回合
src/components/   牌桌、卡牌、勝率與操作
src/tests/        引擎、AI、資訊隔離與遊戲流程回歸測試
```

核心約束：Bot 不讀其他玩家暗牌或真實 deck；權益率使用多人同時攤牌的 pot share；所有 Bot 出口依 legalActions 鉗制 action/amount，最後仍由 ActionValidator 驗證。

牌局初始化可重複呼叫但只發一次牌；遊戲進行中不允許發下一手；Bot 回合只有一個執行者。UI 讀取防禦性快照，補籌碼透過引擎方法完成。

## 對手策略

- 翻前以位置、加注順序、跟注者、有效籌碼及價格選擇混合動作；大額下注、短籌碼與再加注會進入權益搜尋。
- 逐一更新各對手的加權底牌組合。判斷歷史動作時只使用該街當時已公開的公牌；目前公牌與自身底牌用於 card removal。
- 翻後每次抽樣 900 組合法的多人底牌與公牌 runout，比較過牌、跟注、多種下注尺寸及低 SPR 全押。整組拒絕抽樣避免座位順序造成範圍偏差。
- 每次同時評估所有存活對手，依實際贏家數分池，並按下注貢獻分層計算主池、邊池及未獲跟注的退回額。
- 每個座位有獨立記憶，從公開下注紀錄學習過度棄牌、寬範圍參與及持續全押。至少 12 個相應樣本才開始使用部分調整，並以先驗與上限限制小樣本過度反應。記憶只存在於當前頁面 session。
- 五個 Web Worker 按需建立，只接收該座位自己的牌與明確列出的公開欄位。其他座位的實際底牌、deck、下注理由與策略內部記憶都不傳送；逾時或 Worker 錯誤會顯示錯誤，不偷偷降級到弱策略。

Expert 是**手工翻前基準 + 範圍與反應模型 + 有限搜尋**。後續街用保守的 equity realization 估計，對再加注的搜尋限於單挑。多人完整再加注樹、CFR 訓練、求解器策略庫與職業玩家勝率尚未建立；不得將它稱為 GTO solver 或已證明的職業級 AI。[策略設計與驗證](docs/expert-ai.md)。

短全押不足完整加注時不重新開放已行動玩家的加注權；累積短加注達到該玩家面對完整加注的門檻才重新開放。每條街重設此權利。

長期基準測試（PowerShell，平常測試只跑小樣本整合檢查）：

```powershell
$env:POKER_BENCH_HANDS = '750'
npx vitest run src/tests/ExpertBenchmark.test.ts --disableConsoleIntercept --silent=false
Remove-Item Env:POKER_BENCH_HANDS
$env:POKER_STRESS_HANDS = '180'
npx vitest run src/tests/ExpertStress.test.ts --disableConsoleIntercept --silent=false
Remove-Item Env:POKER_STRESS_HANDS
```

## 部署

`main` push 會由 `.github/workflows/deploy.yml` 執行乾淨安裝、測試、構建並部署至 [GitHub Pages](https://wu7010506-lang.github.io/texas-holdem-trainer/)。Vite 使用相對資產路徑，背景 Worker 也會產生獨立的部署資產。
