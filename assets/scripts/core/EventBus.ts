import { EventTarget } from 'cc';

/**
 * 全局事件总线（单例）
 * 使用方式：
 *   EventBus.on('playerDied', handler, target);
 *   EventBus.emit('playerDied', { ... });
 *   EventBus.off('playerDied', handler, target);
 */
export class EventBus {
    private static _et: EventTarget = new EventTarget();

    static on<T = any>(
        event: string,
        callback: (arg?: T) => void,
        target?: unknown
    ) {
        this._et.on(event, callback, target);
    }

    static once<T = any>(
        event: string,
        callback: (arg?: T) => void,
        target?: unknown
    ) {
        this._et.once(event, callback, target);
    }

    static off<T = any>(
        event: string,
        callback: (arg?: T) => void,
        target?: unknown
    ) {
        this._et.off(event, callback, target);
    }

    static emit<T = any>(event: string, arg?: T) {
        this._et.emit(event, arg);
    }

    static targetOff(target: unknown) {
        this._et.targetOff(target);
    }
}

// ─── 游戏内公共事件名常量 ─────────────────────────────────────────────────────
export const GameEvents = {
    // 玩家
    PLAYER_LEVEL_UP:     'player:levelUp',
    PLAYER_DIED:         'player:died',
    PLAYER_HP_CHANGED:   'player:hpChanged',
    PLAYER_EXP_CHANGED:  'player:expChanged',

    // 敌人
    ENEMY_DIED:          'enemy:died',
    BOSS_APPEARED:       'boss:appeared',
    BOSS_DIED:           'boss:died',

    // 升级
    UPGRADE_SHOW:        'upgrade:show',
    UPGRADE_SELECTED:    'upgrade:selected',

    // 境界
    REALM_BREAK_TRIGGER: 'realmBreak:trigger',
    REALM_BREAK_SELECTED:'realmBreak:selected',

    // 游戏流程
    GAME_PAUSE:          'game:pause',
    GAME_RESUME:         'game:resume',
    GAME_OVER:           'game:over',
    GAME_WIN:            'game:win',

    // 伤害数字
    DAMAGE_NUMBER:       'ui:damageNumber',
} as const;
