import { HeroModel, getPosteriorRate } from '../model/HeroModel';

export interface LeakReportItem {
  id: string;
  category: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
  title: string;
  description: string;
  observedRate: string;
  gtoBaseline: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface HeroLeakReport {
  handsTracked: number;
  overallAssessment: string;
  leaks: LeakReportItem[];
}

export class HeroLeakReporter {
  public static generateReport(model: HeroModel): HeroLeakReport {
    const leaks: LeakReportItem[] = [];

    // 1. River Overfold vs Overbet
    const riverOverbetOpps = model.riverStats.foldVsOverbet.opportunities;
    const riverOverbetFold = getPosteriorRate(model.riverStats.foldVsOverbet);
    if (riverOverbetOpps >= 3 && riverOverbetFold > 0.72) {
      leaks.push({
        id: 'RIVER_OVERFOLD_OVERBET',
        category: 'RIVER',
        title: 'River 面對超池下注過度棄牌 (Overfold vs Overbet)',
        description: '面對 125% 超池下注時棄牌頻率過高，使對手的純詐唬下注具有極高長期正期望值 (+EV)。',
        observedRate: `${(riverOverbetFold * 100).toFixed(1)}%`,
        gtoBaseline: '~64.0%',
        severity: riverOverbetFold > 0.80 ? 'HIGH' : 'MEDIUM',
        recommendation: '適度擴展抓詐（Bluff-catcher）防守範圍，包含頂對好踢腳或持有關鍵阻擋牌的組合。',
      });
    }

    // 2. River Calling Station (Overcalling)
    const riverLargeOpps = model.riverStats.foldVsLarge.opportunities;
    const riverLargeFold = getPosteriorRate(model.riverStats.foldVsLarge);
    if (riverLargeOpps >= 4 && riverLargeFold < 0.35) {
      leaks.push({
        id: 'RIVER_OVERCALL',
        category: 'RIVER',
        title: 'River 跟注過度（Calling Station 傾向）',
        description: '在河牌面對大尺寸下注時過度跟注中度價值牌，使對手可擴大薄價值（Thin Value）下注並完全停止詐唬。',
        observedRate: `棄牌率僅 ${(riverLargeFold * 100).toFixed(1)}%`,
        gtoBaseline: '~45.0% - 55.0%',
        severity: riverLargeFold < 0.25 ? 'HIGH' : 'MEDIUM',
        recommendation: '面對對手大尺寸下注時，果斷棄掉無法擊敗任何價值組合的中對或弱對。',
      });
    }

    // 3. River Underbluffing
    const riverBluffOpps = model.riverStats.bluffEstimate.opportunities;
    const riverBluffRate = getPosteriorRate(model.riverStats.bluffEstimate);
    if (riverBluffOpps >= 4 && riverBluffRate < 0.10) {
      leaks.push({
        id: 'RIVER_UNDERBLUFF',
        category: 'RIVER',
        title: 'River 詐唬嚴重不足 (River Underbluffing)',
        description: '在河牌幾乎只用堅果或強價值牌下注，使得對手面對您的主動進攻時可以毫無損失地過度棄牌。',
        observedRate: `詐唬率約 ${(riverBluffRate * 100).toFixed(1)}%`,
        gtoBaseline: '~20.0% - 33.0%',
        severity: 'MEDIUM',
        recommendation: '挑選持有對手跟注範圍阻擋牌（如關鍵花色 Ace 或高張）的未成牌作為河牌詐唬候選。',
      });
    }

    // 4. Preflop 3-Bet Overfold
    const btnStats = model.getPreflopStats('BTN');
    const facing3BetOpps = btnStats.facingThreeBetFold.opportunities;
    const facing3BetFold = getPosteriorRate(btnStats.facingThreeBetFold);
    if (facing3BetOpps >= 4 && facing3BetFold > 0.65) {
      leaks.push({
        id: 'PREFLOP_3BET_OVERFOLD',
        category: 'PREFLOP',
        title: '翻前 BTN 開牌後面臨 3-Bet 過度棄牌',
        description: '在 BTN 開牌後面臨盲注位 3-Bet 時棄牌過多，對手可以用大量投機手牌對您進行剝削性 3-Bet 詐唬。',
        observedRate: `${(facing3BetFold * 100).toFixed(1)}%`,
        gtoBaseline: '~50.0% - 55.0%',
        severity: 'MEDIUM',
        recommendation: '擴展有位置時的 4-Bet 範圍或用同花連張、中等對子跟注看翻牌。',
      });
    }

    // 5. Flop Dry Texture Overfold
    const dryFlop = model.getFlopStats('DRY');
    const dryFoldOpps = dryFlop.foldVsCbet.opportunities;
    const dryFold = getPosteriorRate(dryFlop.foldVsCbet);
    if (dryFoldOpps >= 5 && dryFold > 0.60) {
      leaks.push({
        id: 'FLOP_DRY_OVERFOLD',
        category: 'FLOP',
        title: '翻牌乾燥面過度棄牌 (Overfold on Dry Board)',
        description: '在乾燥面（如 K-7-2r）面對持續下注（C-Bet）過於輕易棄牌，讓進攻者只需 33% 尺寸即可無風險收池。',
        observedRate: `${(dryFold * 100).toFixed(1)}%`,
        gtoBaseline: '~45.0%',
        severity: 'LOW',
        recommendation: '在乾燥面上可用有後門花順潛力的後手牌、或低位對子提高漂浮跟注（Float）頻率。',
      });
    }

    // Overall assessment
    let overallAssessment = '目前樣本數尚在累積中，策略大致維持平衡。';
    if (leaks.length >= 3) {
      overallAssessment = '偵測到多處明顯的偏離平衡點之漏洞，Apex Bot 已全面啟動有針對性的剝削調整！';
    } else if (leaks.length > 0) {
      overallAssessment = '偵測到少數行為偏差，建議參考下方診斷建議進行策略修復。';
    }

    return {
      handsTracked: model.handsTracked,
      overallAssessment,
      leaks,
    };
  }
}
