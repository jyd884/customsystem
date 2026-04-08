import { _decorator, Component } from 'cc';
import { EventBus, GameEvents } from '../../core/EventBus';
import { WeaponManager } from '../player/WeaponManager';
import { PlayerStats } from '../player/PlayerStats';
import { GameManager, GameState } from '../../core/GameManager';
const { ccclass, property } = _decorator;

/** 升级词条类型 */
export enum CardType {
    NEW_WEAPON   = 'new_weapon',
    WEAPON_UP    = 'weapon_up',
    PASSIVE      = 'passive',
    SPECIAL      = 'special',
    SYNTHESIS    = 'synthesis',
}

/** 升级词条数据（来自 upgrades.json） */
export interface UpgradeCardData {
    id:          string;
    type:        CardType;
    name:        string;
    desc:        string;
    rarity:      number;   // 1=普通 2=稀有 3=史诗
    weaponId?:   string;   // type=NEW_WEAPON/WEAPON_UP/SYNTHESIS 时使用
    passiveKey?: string;   // type=PASSIVE 时修改的属性 key
    passiveVal?: number;   // 加成数值
    requireWeapon?: string; // 合成前置武器
    requirePassive?: string; // 合成前置被动
}

/**
 * 升级管理器
 * - 持有完整的 UpgradeCardData 池
 * - 每次升级随机抽取 3 张（保证稀有度权重 + 不重复已满级）
 * - 玩家确认后执行词条效果
 * - 检测合成触发
 */
@ccclass('UpgradeManager')
export class UpgradeManager extends Component {

    private _allCards: UpgradeCardData[]   = [];
    private _pickedPassives: Set<string>   = new Set();   // 已选过的被动

    onLoad() {
        EventBus.on(GameEvents.PLAYER_LEVEL_UP, this._onLevelUp, this);
        EventBus.on(GameEvents.UPGRADE_SELECTED, this._onCardSelected, this);
    }

    onDestroy() {
        EventBus.targetOff(this);
    }

    loadCards(cards: UpgradeCardData[]) {
        this._allCards = cards;
    }

    // ─── 升级触发 ────────────────────────────────────────────────────────────

    private _onLevelUp() {
        const wm = this._getWeaponManager();
        const options = this._drawCards(3, wm);
        if (options.length === 0) return;
        GameManager.instance?.changeState(GameState.UPGRADE);
        EventBus.emit(GameEvents.UPGRADE_SHOW, { cards: options });
    }

    // ─── 抽卡算法 ────────────────────────────────────────────────────────────

    private _drawCards(count: number, wm: WeaponManager | null): UpgradeCardData[] {
        const pool = this._allCards.filter(c => this._isAvailable(c, wm));
        if (pool.length === 0) return [];

        // 权重随机（稀有度越高概率越低）
        const weights = pool.map(c => [3, 2, 1][c.rarity - 1] ?? 1);
        const total   = weights.reduce((s, w) => s + w, 0);
        const result: UpgradeCardData[] = [];
        const picked  = new Set<string>();

        let tries = 0;
        while (result.length < count && tries < 200) {
            tries++;
            let r   = Math.random() * total;
            let idx = 0;
            for (let i = 0; i < pool.length; i++) {
                r -= weights[i];
                if (r <= 0) { idx = i; break; }
            }
            const card = pool[idx];
            if (!picked.has(card.id)) {
                picked.add(card.id);
                result.push(card);
            }
        }
        return result;
    }

    private _isAvailable(card: UpgradeCardData, wm: WeaponManager | null): boolean {
        if (!wm) return card.type === CardType.PASSIVE;

        switch (card.type) {
            case CardType.NEW_WEAPON:
                return !wm.hasSkill(card.weaponId!) && !wm.isFull;
            case CardType.WEAPON_UP:
                return wm.hasSkill(card.weaponId!) && wm.getSkillLevel(card.weaponId!) < 3;
            case CardType.PASSIVE:
                return !this._pickedPassives.has(card.id) || (card.passiveVal !== undefined);
            case CardType.SYNTHESIS:
                return wm.hasSkill(card.requireWeapon!)
                    && this._pickedPassives.has(card.requirePassive!);
            case CardType.SPECIAL:
                return true;
        }
    }

    // ─── 执行词条效果 ────────────────────────────────────────────────────────

    private _onCardSelected(data: { card: UpgradeCardData }) {
        const card = data.card;
        const wm   = this._getWeaponManager();
        const stats = this.node.parent?.getComponentInChildren(PlayerStats);

        switch (card.type) {
            case CardType.NEW_WEAPON:
                EventBus.emit('upgrade:addWeapon', { weaponId: card.weaponId });
                break;
            case CardType.WEAPON_UP:
                wm?.upgradeSkill(card.weaponId!, wm.getSkillLevel(card.weaponId!) + 1);
                break;
            case CardType.PASSIVE:
                this._pickedPassives.add(card.id);
                if (stats && card.passiveKey && card.passiveVal !== undefined) {
                    stats.addBonus(card.passiveKey, card.passiveVal);
                }
                break;
            case CardType.SYNTHESIS:
                EventBus.emit('upgrade:synthesis', {
                    replaceId: card.requireWeapon,
                    newId:     card.weaponId,
                });
                break;
            case CardType.SPECIAL:
                EventBus.emit('upgrade:special', { cardId: card.id });
                break;
        }

        // 检测合成条件是否达成
        this._checkSynthesis(wm);

        GameManager.instance?.changeState(GameState.PLAYING);
        EventBus.emit(GameEvents.GAME_RESUME);
    }

    private _checkSynthesis(wm: WeaponManager | null) {
        if (!wm) return;
        const synthCards = this._allCards.filter(c => c.type === CardType.SYNTHESIS);
        for (const sc of synthCards) {
            if (
                wm.hasSkill(sc.requireWeapon!) &&
                this._pickedPassives.has(sc.requirePassive!)
            ) {
                // 合成提示（不强制）
                EventBus.emit('upgrade:synthAvailable', { card: sc });
            }
        }
    }

    private _getWeaponManager(): WeaponManager | null {
        return this.node.parent?.getComponentInChildren(WeaponManager) ?? null;
    }
}
