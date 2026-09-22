import { ActionRecord, Card, GameState, HandWinner, PlayerState } from '../engine/types';
import { cardToString } from '../engine/Card';

export interface HandHistoryRecord {
  handId: number;
  timestamp: number;
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  initialStacks: Record<string, number>;
  finalStacks: Record<string, number>;
  players: {
    id: string;
    name: string;
    seat: number;
    position: string;
    isHuman: boolean;
    holeCards: Card[];
  }[];
  communityCards: Card[];
  actions: ActionRecord[];
  totalPot: number;
  winners: HandWinner[];
}

export class HandHistoryFormatter {
  public static toText(record: HandHistoryRecord): string {
    const lines: string[] = [];
    const dateStr = new Date(record.timestamp).toLocaleString();

    lines.push(`========================================================`);
    lines.push(`德州撲克牌譜紀錄 - 第 #${record.handId} 手 (${dateStr})`);
    lines.push(`盲注: ${record.smallBlind} / ${record.bigBlind}`);
    lines.push(`牌桌人數: ${record.players.length} 人`);
    lines.push(`--------------------------------------------------------`);

    // Players & Stacks
    for (const p of record.players) {
      const isDealer = p.seat === record.dealerSeat ? ' (莊家按鈕 Button)' : '';
      const initialStack = record.initialStacks[p.id] ?? 0;
      const displayName = p.isHuman ? '玩家 (Hero)' : p.name;
      lines.push(`座位 ${p.seat + 1}: ${displayName} [${p.position}] (${initialStack} 籌碼)${isDealer}`);
    }
    lines.push(`--------------------------------------------------------`);

    // Hole cards
    for (const p of record.players) {
      if (p.holeCards.length === 2) {
        const cardsStr = p.holeCards.map(cardToString).join(' ');
        const displayName = p.isHuman ? '玩家 (Hero)' : p.name;
        lines.push(`發牌給 ${displayName} [ ${cardsStr} ]`);
      }
    }
    lines.push(`--------------------------------------------------------`);

    // Actions grouped by street
    const streets = [
      { key: 'PREFLOP', name: '翻牌前 (PREFLOP)' },
      { key: 'FLOP', name: '翻牌圈 (FLOP)' },
      { key: 'TURN', name: '轉牌圈 (TURN)' },
      { key: 'RIVER', name: '河牌圈 (RIVER)' },
      { key: 'SHOWDOWN', name: '攤牌結算 (SHOWDOWN)' },
    ] as const;

    const actionZh: Record<string, string> = {
      FOLD: '棄牌 (Fold)',
      CHECK: '過牌 (Check)',
      CALL: '跟注 (Call)',
      BET: '下注 (Bet)',
      RAISE: '加注 (Raise)',
      ALL_IN: '全押 (All-in)',
    };

    for (const street of streets) {
      const streetActions = record.actions.filter((a) => a.street === street.key);
      if (streetActions.length === 0 && street.key !== 'PREFLOP') continue;

      lines.push(`*** ${street.name} ***`);
      if (street.key === 'FLOP' && record.communityCards.length >= 3) {
        lines.push(`公共牌: [ ${record.communityCards.slice(0, 3).map(cardToString).join(' ')} ]`);
      } else if (street.key === 'TURN' && record.communityCards.length >= 4) {
        lines.push(`公共牌: [ ${record.communityCards.slice(0, 4).map(cardToString).join(' ')} ]`);
      } else if (street.key === 'RIVER' && record.communityCards.length >= 5) {
        lines.push(`公共牌: [ ${record.communityCards.map(cardToString).join(' ')} ]`);
      }

      for (const act of streetActions) {
        const p = record.players.find((pl) => pl.id === act.playerId);
        const name = p?.isHuman ? '玩家 (Hero)' : act.playerName;
        let actDesc = `${name}: ${actionZh[act.action] || act.action}`;
        if (act.amount > 0) actDesc += ` ${act.amount}`;
        if (act.reasoning) actDesc += ` 【理由: ${act.reasoning}】`;
        lines.push(actDesc);
      }
      lines.push(``);
    }

    // Summary / Winners
    lines.push(`*** 結算總結 (SUMMARY) ***`);
    lines.push(`總底池: ${record.totalPot} 籌碼`);
    if (record.communityCards.length > 0) {
      lines.push(`最終公共牌: [ ${record.communityCards.map(cardToString).join(' ')} ]`);
    }

    for (const w of record.winners) {
      const p = record.players.find((player) => player.id === w.playerId);
      const name = p?.isHuman ? '玩家 (Hero)' : (p?.name || w.playerId);
      const desc = w.handEvaluation?.description ? ` (牌型: ${w.handEvaluation.description})` : '';
      lines.push(`🏆 ${name} 贏得 ${w.amount} 籌碼${desc}`);
    }

    lines.push(`========================================================\n`);
    return lines.join('\n');
  }

  public static createRecord(
    gameState: GameState,
    initialStacks: Record<string, number>,
    smallBlind: number,
    bigBlind: number
  ): HandHistoryRecord {
    const finalStacks: Record<string, number> = {};
    gameState.players.forEach((p) => {
      finalStacks[p.id] = p.stack;
    });

    return {
      handId: gameState.handId,
      timestamp: Date.now(),
      dealerSeat: gameState.dealerSeat,
      smallBlind,
      bigBlind,
      initialStacks,
      finalStacks,
      players: gameState.players.map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        position: p.position,
        isHuman: p.isHuman,
        holeCards: [...p.holeCards],
      })),
      communityCards: [...gameState.communityCards],
      actions: [...gameState.actionHistory],
      totalPot: gameState.pot,
      winners: gameState.winners ? [...gameState.winners] : [],
    };
  }
}
