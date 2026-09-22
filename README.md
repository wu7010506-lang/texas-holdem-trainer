# Texas Hold'em Trainer (德州撲克單人訓練平台)

一個專為德州撲克技術訓練打造的單人訓練平台。採用 **純 TypeScript 核心遊戲引擎** 與 **React + Tailwind CSS** 前端完全解耦的現代化架構。

> 本專案純粹用於撲克策略與技術研發、練習，不涉及真實金錢、儲值、提款或線上博弈。

---

## 目錄 (Table of Contents)

- [一、核心特色](#一核心特色)
- [二、如何安裝與啟動](#二如何安裝與啟動)
- [三、如何執行自動化測試](#三如何執行自動化測試)
- [四、專案資料夾結構](#四專案資料夾結構)
- [五、Poker Engine 架構說明](#五poker-engine-架構說明)
- [六、Bot 決策系統與擴充說明](#六bot-決策系統與擴充說明)
  - [1. 如何自訂與建立新的 Bot Profile](#1-如何自訂與建立新的-bot-profile)
  - [2. 如何實作新的 Bot Strategy](#2-如何實作新的-bot-strategy)
  - [3. 如何在遊戲中即時調整 Bot 參數](#3-如何在遊戲中即時調整-bot-parameters)
- [七、訓練與除錯工具 (HUD & Debugger)](#七訓練與除錯工具-hud--debugger)
- [八、手牌歷史與重播器 (Hand History & Replay)](#八手牌歷史與重播器-hand-history--replay)
- [九、統計分析系統 (Statistics Tracker)](#九統計分析系統-statistics-tracker)

---

## 一、核心特色

1. **嚴謹合規的 No-Limit 德州撲克規則**：
   - 包含完整的 Dealer Button、Small Blind、Big Blind 輪轉。
   - 支援 2 人 (Heads-Up) 至 9 人 (Full Ring) 彈性座位配置。
   - 完整支援 Heads-Up 特殊盲注規則（Button 為 SB 翻前先動、翻後後動）。
   - 正確處理 Min-Raise 下注下限計算、All-In、以及多方不同籌碼之 **Main Pot & 多層級 Side Pots**。
   - 7 選 5 最佳手牌評估器，完全支援 10 種標準牌型、輪子順 (A-2-3-4-5) 與所有 Kicker 細節對比及平手拆池 (Split Pot)。
2. **純邏輯核心完全解耦**：
   - Poker Engine 獨立於 React 框架，無任何 DOM 依賴，具備 100% 可單元測試性。
   - Poker Engine 不包含任何 Bot AI 邏輯，僅接受標準行動（FOLD, CHECK, CALL, BET, RAISE, ALL_IN）。
3. **透明可解釋的 Bot AI 系統**：
   - 拒絕黑盒，所有決策包含加權打分、隨機骰點與清晰的教育性 `reasoning`。
   - 內建 6 種經典撲克風格：**Nit**、**TAG**、**LAG**、**Calling Station**、**Maniac**、**Balanced**。
   - 整合 169 手牌矩陣 (169-Hand Chart)、牌面結構分析 (Board Wetness / Connectivity)、底池賠率 (Pot Odds) 與 SPR。
   - 內建非阻塞獨立 **Monte Carlo Equity 模擬器**。
4. **完整訓練 HUD 與歷史重播**：
   - 即時顯示當前 Pot Odds、SPR、當前成牌與聽牌分類。
   - 每一手牌自動記錄為 Machine-readable JSON 與 Human-readable 牌譜。
   - 步進式重播器 (Step Forward / Step Backward / Jump to Street)。
   - 即時追蹤 VPIP、PFR、3-Bet%、C-Bet%、WTSD、W$SD、BB/100 與盈虧指標。

---

## 二、如何安裝與啟動

### 環境需求
- [Node.js](https://nodejs.org/) v18+ (建議 v20 或 v22/v24)
- npm 或 pnpm

### 安裝依賴
```bash
npm install
```

### 啟動本機開發伺服器
```bash
npm run dev
```
啟動後於瀏覽器中開啟 `http://localhost:5173/` 即可立即開始練習。

### 建置生產環境版本 (Production Build)
```bash
npm run build
```
產出檔案位於 `dist/` 目錄。

---

## 三、如何執行自動化測試

本專案使用 [Vitest](https://vitest.dev/) 針對核心引擎進行嚴謹的單元與整合測試：

```bash
npm run test
```

測試涵蓋以下核心項目：
- `Deck.test.ts`：52 張標準牌無重複、抽牌計數、種子 PRNG 重現性。
- `HandEvaluator.test.ts`：10 種牌型判定、Wheel 順子、Kicker 嚴格比對、7 選 5 最佳組合、平手拆池。
- `PotManager.test.ts`：多方 All-In 邊池切分、棄牌籌碼留存、邊池資格判斷、奇數籌碼 (Odd chips) 依序分配。
- `ActionValidator.test.ts`：Check/Call/Bet/Raise/All-In 合法性邊界、Min-Raise 計算。
- `HeadsUp.test.ts`：Heads-Up 按鈕兼 SB 先後手行動規則。
- `GameFlow.test.ts`：完整階段流轉、全棄牌獲勝、莊家按鈕輪轉。
- `BotStrategy.test.ts`：169 記號轉換、牌面濕度、Pot Odds 計算、Nit 與 Maniac 風格反應。

---

## 四、專案資料夾結構

```
src/
├── engine/                       # 純 TypeScript 遊戲核心（零 React 依賴）
│   ├── types.ts                  # Card, Suit, Rank, PlayerState, GameState, etc.
│   ├── Card.ts                   # 卡牌解析、符號與數值輔助工具
│   ├── Deck.ts                   # 52張標準牌洗牌與 PRNG 發牌器
│   ├── HandEvaluator.ts          # 7選5手牌判定器、字典序比對
│   ├── PotManager.ts             # 主池、邊池、多方 All-in 與分池管理
│   ├── ActionValidator.ts        # 下注額與行動合法性檢驗器
│   ├── TurnManager.ts            # 座位、行動輪轉與 Heads-up 特例
│   └── PokerGame.ts              # 核心遊戲狀態機與階段推進器
├── bot/                          # Bot 決策與 AI 系統（完全可抽換）
│   ├── types.ts                  # BotDecisionContext, BotProfile, IBotStrategy
│   ├── BotStrategy.ts            # 策略共同介面
│   ├── ProfileDrivenStrategy.ts  # 結合矩陣、材質與參數之標準策略實作
│   ├── PreflopRanges.ts          # 169 翻前手牌矩陣與位置門檻
│   ├── BoardAnalyzer.ts          # 翻後公牌材質分析 (Dry/Wet/Two-tone/Connected)
│   ├── HandStrength.ts           # 成牌分級 (Top Pair, Overpair) 與聽牌偵測
│   ├── PotOddsCalculator.ts      # 底池賠率與 SPR 計算工具
│   ├── MonteCarloEquity.ts       # 獨立蒙地卡羅勝率模擬器
│   ├── defaultProfiles.ts        # 6 種預設風格 (Nit, TAG, LAG, Station, Maniac, Balanced)
│   └── BotController.ts          # 銜接 GameState 與 Strategy 之適配器
├── history/                      # 牌譜儲存與重播
│   ├── HandHistory.ts            # 資料模型與人類可讀文字格式化工具
│   ├── HandReplayer.ts           # 步進重播狀態引擎
│   └── StorageRepository.ts      # 本機儲存 (LocalStorage) 與擴充介面
├── stats/                        # 統計分析系統
│   ├── types.ts                  # VPIP, PFR, 3-Bet, BB/100 結構
│   └── StatsTracker.ts           # 歷史手牌統計累計計算器
├── store/                        # 狀態管理
│   └── usePokerStore.ts          # Zustand Store 協調非同步 Bot 思考與 UI
├── components/                   # React UI 呈現層
│   ├── table/                    # 牌桌 (PokerTable, PlayerSeat, PlayingCard, CommunityCards)
│   ├── controls/                 # 玩家操作按鈕、下注滑桿、底池比例快捷鍵
│   ├── panels/                   # 即時訓練 HUD (TrainingPanel) 與 Bot 除錯日誌 (BotDebugPanel)
│   └── modals/                   # 牌譜檢視、步進重播器、Bot 編輯器、統計報表、遊戲設定
├── tests/                        # Vitest 測試套件
├── App.tsx                       # 主頁面進入點
└── main.tsx
```

---

## 五、Poker Engine 架構說明

Poker Engine 採用 **Pure State Transitions** 設計：
1. **輸入與輸出完全分離**：
   - 引擎只接收外部傳入的純 Action：
     ```typescript
     game.applyAction({ type: 'RAISE', amount: 60 });
     ```
   - 引擎絕不呼叫任何 Bot 決策或 UI 程式碼，也不進行任何非同步 `setTimeout`。
2. **Side Pot 計算模型**：
   - 根據所有玩家投入底池的籌碼分階切分（Tiers）。
   - 只有已投入該階層且尚未棄牌（Fold）的玩家具備競爭該邊池之資格。
3. **Showdown 判定**：
   - 使用 `HandEvaluator.evaluate()` 計算所有存活玩家的最佳 5 張組合。
   - 回傳數值向量評分（Score Vector），進行無誤差字典序比較。若平手均分底池，畸零籌碼依照撲克公認規則優先分給按鈕後方位置在前者。

---

## 六、Bot 決策系統與擴充說明

### 1. 如何自訂與建立新的 Bot Profile

Bot 的參數完全以 JSON / TypeScript 宣告，結構如下：

```typescript
import { BotProfile } from './bot/types';

export const myCustomProfile: BotProfile = {
  id: 'my_aggro_bot',
  name: 'Ultra Shark',
  description: 'Custom aggressive bot with high c-bet and bluff frequencies',
  vpip: 0.28,             // 自願進池率 (28%)
  pfr: 0.24,              // 翻前加注率 (24%)
  threeBetFrequency: 0.11,// 3-bet 頻率 (11%)
  aggression: 0.75,       // 翻後激進指數 (0.0 ~ 1.0)
  bluffFrequency: 0.18,   // 翻後詐唬頻率
  foldToThreeBet: 0.45,   // 面對 3-bet 之棄牌率
  continuationBet: 0.70,  // 持續下注 (C-Bet) 頻率
  foldToCBet: 0.38,       // 面對 C-Bet 之棄牌率
  checkRaiseFrequency: 0.10, // Check-Raise 頻率
  riverBluffFrequency: 0.15, // 河牌詐唬頻率
  betSizing: {
    small: 0.33,          // 乾燥牌面 / 小型下注 1/3 Pot
    medium: 0.66,         // 標準下注 2/3 Pot
    large: 0.80,          // 潮濕牌面 / 強價值下注
    overbet: 1.35,        // 超額下注 (Overbet)
  },
};
```

### 2. 如何實作新的 Bot Strategy

所有 Bot 策略均實作共用介面 `IBotStrategy`：

```typescript
export interface IBotStrategy {
  name: string;
  decideAction(context: BotDecisionContext, profile: BotProfile, rng?: () => number): BotDecision;
}
```

例如，未來欲新增 **GTOBotStrategy**、**ExploitativeBotStrategy** 或 **MonteCarloBotStrategy**：
```typescript
import { IBotStrategy, BotDecisionContext, BotDecision, BotProfile } from './bot/types';

export class MyNewBotStrategy implements IBotStrategy {
  public name = 'MyNewBotStrategy';

  public decideAction(context: BotDecisionContext, profile: BotProfile, rng = Math.random): BotDecision {
    // 讀取 context 中的 holeCards, communityCards, potOdds, spr, boardTexture...
    if (context.handStrength.estimatedEquity > context.potOdds) {
      return {
        action: 'CALL',
        amount: context.legalActions.callAmount,
        reasoning: 'Positive EV call based on equity vs pot odds.',
      };
    }

    return {
      action: 'FOLD',
      reasoning: 'Negative EV fold.',
    };
  }
}
```
然後直接將其實例傳入 `BotController`：
```typescript
botController.setStrategy(new MyNewBotStrategy());
```
遊戲核心 `PokerGame` 完全不受任何影響！

### 3. 如何在遊戲中即時調整 Bot 參數

1. 在遊戲介面點擊頂部 **"Bots"** 按鈕開啟 **Bot Editor**。
2. 選擇欲修改的 Bot Profile（或點擊 **Clone** 複製新設定檔）。
3. 拖拉滑桿即時微調 VPIP、PFR、Aggression、Bluff、Sizing 等數值。
4. 點擊 **Save Profile** 立即自動生效並寫入 LocalStorage。
5. 支援 **Export JSON** 匯出設定檔與 **Import JSON** 載入外部自訂設定。

---

## 七、訓練與除錯工具 (HUD & Debugger)

- **Training HUD**：
  - 即時顯示英雄（Hero）之 **位置 (Position)**、**籌碼 (BB)**、**底池 (BB)**、**SPR**。
  - **Pot Odds 計算器**：清楚標示跟注金額、跟注後總池、所需勝率（Required Equity）。
  - **手牌強度辨識**：自動識別頂對好踢腳、超對、兩對、三條、同花聽牌 (Flush Draw)、雙頭順 (OESD)、卡順 (Gutshot) 等。
  - **即時蒙地卡羅勝率 (Monte Carlo Equity)**：獨立背景模擬當前手牌面對所有對手時的實時勝率分布（Win / Tie / Loss）。
- **Bot Decision Debugger**：
  - 即時印出每一手牌各個電腦玩家之決策思考過程。
  - 清楚列出 Fold 評分、Call 評分、Raise 評分、隨機骰點數值與最終選擇原因（例如：`Top pair + dry board + high aggression TAG profile -> Bet 66% pot`）。

---

## 八、手牌歷史與重播器 (Hand History & Replay)

- **雙格式儲存**：
  - **Readable Text**：國際標準撲克文字紀錄，包含盲注、發牌、各街行動、底池變化與獲勝手牌。
  - **JSON 格式**：機器可讀完整物件結構，方便匯出與二度分析。
- **步進式重播器 (Replayer)**：
  - 支援 **Previous** / **Next** 一步一步重演牌局。
  - 支援 **Preflop / Flop / Turn / River** 街別快速跳轉。
  - 牌桌同時動態呈現公共牌發牌歷程、各玩家下注金額與棄牌狀態。

---

## 九、統計分析系統 (Statistics Tracker)

系統會即時追蹤 Hero 以及同桌所有電腦 Bot 的戰績與風格指標：
- **Hands Played**：總遊戲手數
- **Total Profit**：總盈虧籌碼
- **BB / 100**：每百手贏得大盲數 (Win Rate)
- **VPIP**：主動入池率 (%)
- **PFR**：翻前加注率 (%)
- **3-Bet %**：面對公開加注再度加注之頻率
- **C-Bet %**：翻牌圈持續下注頻率
- **WTSD**：攤牌率 (%)
- **W$SD**：攤牌勝率 (%)
- **Biggest Pot Won / Lost**：最大贏得與輸掉底池
