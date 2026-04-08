import { _decorator, Component } from 'cc';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass, property } = _decorator;

/** 玩家属性定义 */
export interface IPlayerStats {
    maxHp:        number;  // 修为（最大生命值）
    attack:       number;  // 灵力（攻击倍率）
    moveSpeed:    number;  // 身法（移动速度）
    expRate:      number;  // 悟性（经验获取倍率）
    defense:      number;  // 护体（伤害减免 0~1）
    critRate:     number;  // 运势（暴击率 0~1）
    critDamage:   number;  // 暴击伤害倍率（默认 2.0）
    attackSpeed:  number;  // 攻速（武器冷却倍率，1.0 = 正常）
    range:        number;  // 技能范围倍率
    projectile:   number;  // 弹体数量追加
}

/**
 * 玩家属性组件
 * 管理基础属性、额外加成、经验/等级升级逻辑。
 */
@ccclass('PlayerStats')
export class PlayerStats extends Component {

    // ── 基础属性（由角色配置初始化） ─────────────────────────────────────────
    private _base: IPlayerStats = {
        maxHp:       100,
        attack:      1.0,
        moveSpeed:   160,
        expRate:     1.0,
        defense:     0,
        critRate:    0.05,
        critDamage:  2.0,
        attackSpeed: 1.0,
        range:       1.0,
        projectile:  0,
    };

    // ── 额外加成（被动叠加） ──────────────────────────────────────────────────
    private _bonus: IPlayerStats = {
        maxHp:       0,
        attack:      0,
        moveSpeed:   0,
        expRate:     0,
        defense:     0,
        critRate:    0,
        critDamage:  0,
        attackSpeed: 0,
        range:       0,
        projectile:  0,
    };

    // ── 当前血量 ──────────────────────────────────────────────────────────────
    private _currentHp: number = 100;

    // ── 经验 / 等级 ───────────────────────────────────────────────────────────
    private _level:   number = 1;
    private _exp:     number = 0;
    private _expToNext: number = 10; // 升级所需经验（随等级增长）

    // ─── 初始化 ──────────────────────────────────────────────────────────────

    initFromConfig(cfg: Partial<IPlayerStats>) {
        Object.assign(this._base, cfg);
        this._currentHp = this.maxHp;
        EventBus.emit(GameEvents.PLAYER_HP_CHANGED, {
            cur: this._currentHp, max: this.maxHp
        });
    }

    // ─── 合并属性获取器 ──────────────────────────────────────────────────────

    get maxHp()       { return this._base.maxHp       + this._bonus.maxHp; }
    get attack()      { return this._base.attack       + this._bonus.attack; }
    get moveSpeed()   { return this._base.moveSpeed    + this._bonus.moveSpeed; }
    get expRate()     { return this._base.expRate      + this._bonus.expRate; }
    get defense()     { return Math.min(0.75, this._base.defense + this._bonus.defense); }
    get critRate()    { return Math.min(1, this._base.critRate   + this._bonus.critRate); }
    get critDamage()  { return this._base.critDamage   + this._bonus.critDamage; }
    get attackSpeed() { return this._base.attackSpeed  + this._bonus.attackSpeed; }
    get range()       { return this._base.range        + this._bonus.range; }
    get projectile()  { return this._bonus.projectile; }
    get currentHp()   { return this._currentHp; }
    get level()       { return this._level; }
    get exp()         { return this._exp; }
    get expToNext()   { return this._expToNext; }

    // ─── 血量操作 ────────────────────────────────────────────────────────────

    takeDamage(rawDmg: number): number {
        const reduced = Math.max(1, rawDmg * (1 - this.defense));
        this._currentHp = Math.max(0, this._currentHp - reduced);
        EventBus.emit(GameEvents.PLAYER_HP_CHANGED, {
            cur: this._currentHp, max: this.maxHp
        });
        if (this._currentHp <= 0) {
            EventBus.emit(GameEvents.PLAYER_DIED);
        }
        return reduced;
    }

    heal(amount: number) {
        this._currentHp = Math.min(this.maxHp, this._currentHp + amount);
        EventBus.emit(GameEvents.PLAYER_HP_CHANGED, {
            cur: this._currentHp, max: this.maxHp
        });
    }

    // ─── 经验 / 等级 ─────────────────────────────────────────────────────────

    addExp(raw: number) {
        const gained = raw * this.expRate;
        this._exp += gained;
        EventBus.emit(GameEvents.PLAYER_EXP_CHANGED, {
            cur: this._exp, max: this._expToNext, level: this._level
        });
        while (this._exp >= this._expToNext) {
            this._exp -= this._expToNext;
            this._levelUp();
        }
    }

    private _levelUp() {
        this._level++;
        this._expToNext = Math.floor(this._expToNext * 1.18); // 经验需求增长 18%
        EventBus.emit(GameEvents.PLAYER_LEVEL_UP, { level: this._level });
    }

    // ─── 被动加成 ────────────────────────────────────────────────────────────

    addBonus(key: keyof IPlayerStats, value: number) {
        (this._bonus as any)[key] += value;
        // 若增加了 maxHp，同步增加当前血量
        if (key === 'maxHp') this._currentHp += value;
    }

    // ─── 暴击计算 ────────────────────────────────────────────────────────────

    calcDamage(baseDmg: number): { damage: number; isCrit: boolean } {
        const isCrit = Math.random() < this.critRate;
        const damage = baseDmg * this.attack * (isCrit ? this.critDamage : 1);
        return { damage: Math.floor(damage), isCrit };
    }
}
