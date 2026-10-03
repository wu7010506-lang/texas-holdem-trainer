import { HeroModel } from './HeroModel';

const STORAGE_KEY = 'apex_bot_hero_model_v1';

export class HeroModelStore {
  public static load(): HeroModel {
    const model = new HeroModel();
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return model;
      }
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return model;

      const data = JSON.parse(raw);
      if (data && typeof data.handsTracked === 'number') {
        model.handsTracked = data.handsTracked;
        if (data.preflopByPosition) {
          model.preflopByPosition = data.preflopByPosition;
        }
        if (data.flopStatsByTexture) {
          model.flopStatsByTexture = data.flopStatsByTexture;
        }
        if (data.turnDoubleBarrel) {
          model.turnDoubleBarrel = data.turnDoubleBarrel;
        }
        if (data.turnFoldVsBet) {
          model.turnFoldVsBet = data.turnFoldVsBet;
        }
        if (data.riverStats) {
          model.riverStats = data.riverStats;
        }
        if (data.preflopAllInShove) {
          model.preflopAllInShove = data.preflopAllInShove;
        }
      }
    } catch (e) {
      console.warn('HeroModelStore: Failed to load hero model from localStorage, using fresh model', e);
    }
    return model;
  }

  public static save(model: HeroModel): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const data = {
        handsTracked: model.handsTracked,
        preflopByPosition: model.preflopByPosition,
        flopStatsByTexture: model.flopStatsByTexture,
        turnDoubleBarrel: model.turnDoubleBarrel,
        turnFoldVsBet: model.turnFoldVsBet,
        preflopAllInShove: model.preflopAllInShove,
        riverStats: model.riverStats,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('HeroModelStore: Failed to save hero model to localStorage', e);
    }
  }

  public static clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('HeroModelStore: Failed to clear hero model', e);
    }
  }
}
