import { GameConfig } from '../engine/types';
import { BotProfile } from '../bot/types';
import { HandHistoryRecord } from './HandHistory';
import { PlayerStats } from '../stats/types';
import { DEFAULT_PROFILES } from '../bot/defaultProfiles';

export interface IHandHistoryRepository {
  saveHand(record: HandHistoryRecord): Promise<void>;
  getHands(): Promise<HandHistoryRecord[]>;
  getHandById(id: number): Promise<HandHistoryRecord | null>;
  clear(): Promise<void>;
}

export interface ISettingsRepository {
  saveConfig(config: GameConfig): Promise<void>;
  getConfig(): Promise<GameConfig | null>;
}

export interface IBotProfileRepository {
  saveProfiles(profiles: Record<string, BotProfile>): Promise<void>;
  getProfiles(): Promise<Record<string, BotProfile>>;
}

export interface IStatsRepository {
  saveStats(stats: Record<string, PlayerStats>): Promise<void>;
  getStats(): Promise<Record<string, PlayerStats>>;
}

export class LocalStorageRepository
  implements IHandHistoryRepository, ISettingsRepository, IBotProfileRepository, IStatsRepository
{
  private readonly HANDS_KEY = 'poker_trainer_hands';
  private readonly CONFIG_KEY = 'poker_trainer_config';
  private readonly PROFILES_KEY = 'poker_trainer_profiles';
  private readonly STATS_KEY = 'poker_trainer_stats';

  public async saveHand(record: HandHistoryRecord): Promise<void> {
    try {
      const hands = await this.getHands();
      hands.unshift(record); // newest first
      // Keep last 100 hands to avoid local storage overflow
      const trimmed = hands.slice(0, 100);
      localStorage.setItem(this.HANDS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Failed to save hand history to LocalStorage:', e);
    }
  }

  public async getHands(): Promise<HandHistoryRecord[]> {
    try {
      const raw = localStorage.getItem(this.HANDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  public async getHandById(id: number): Promise<HandHistoryRecord | null> {
    const hands = await this.getHands();
    return hands.find((h) => h.handId === id) || null;
  }

  public async clear(): Promise<void> {
    localStorage.removeItem(this.HANDS_KEY);
  }

  public async saveConfig(config: GameConfig): Promise<void> {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config to LocalStorage:', e);
    }
  }

  public async getConfig(): Promise<GameConfig | null> {
    try {
      const raw = localStorage.getItem(this.CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public async saveProfiles(profiles: Record<string, BotProfile>): Promise<void> {
    try {
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.error('Failed to save profiles to LocalStorage:', e);
    }
  }

  public async getProfiles(): Promise<Record<string, BotProfile>> {
    try {
      const raw = localStorage.getItem(this.PROFILES_KEY);
      return raw ? { ...DEFAULT_PROFILES, ...JSON.parse(raw) } : { ...DEFAULT_PROFILES };
    } catch {
      return { ...DEFAULT_PROFILES };
    }
  }

  public async saveStats(stats: Record<string, PlayerStats>): Promise<void> {
    try {
      localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save stats to LocalStorage:', e);
    }
  }

  public async getStats(): Promise<Record<string, PlayerStats>> {
    try {
      const raw = localStorage.getItem(this.STATS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}
