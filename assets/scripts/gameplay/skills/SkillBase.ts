import { _decorator, Component, Node, Vec3 } from 'cc';
import { PlayerStats } from '../player/PlayerStats';
const { ccclass, property } = _decorator;

/**
 * 技能/武器基类
 * 所有主动技能均继承此类，重写 onFire() 实现各自弹道逻辑。
 */
@ccclass('SkillBase')
export class SkillBase extends Component {

    /** 技能唯一 ID（与配置表对应） */
    @property
    public skillId: string = '';

    /** 当前等级（1-3） */
    public level: number = 1;

    /** 基础伤害 */
    @property
    public baseDamage: number = 10;

    /** 基础冷却时间（秒） */
    @property
    public baseCooldown: number = 1.5;

    /** 基础范围半径（像素） */
    @property
    public baseRange: number = 80;

    /** 基础弹体数量 */
    @property
    public baseProjectile: number = 1;

    // ── 运行时 ────────────────────────────────────────────────────────────────
    protected _cooldownTimer: number  = 0;
    protected _stats: PlayerStats | null = null;

    // ─── 生命周期钩子（WeaponManager 调用） ─────────────────────────────────

    onEquip(stats: PlayerStats) {
        this._stats = stats;
        this._cooldownTimer = 0; // 装备时立即可发射
    }

    onUpgrade(newLevel: number, stats: PlayerStats) {
        this.level  = newLevel;
        this._stats = stats;
    }

    // ─── 每帧驱动（由 WeaponManager.update() 调用） ──────────────────────────

    tick(dt: number, stats: PlayerStats) {
        this._stats = stats;
        this._cooldownTimer -= dt;
        if (this._cooldownTimer <= 0) {
            this._cooldownTimer = this.effectiveCooldown;
            this.onFire();
        }
    }

    // ─── 子类重写 ────────────────────────────────────────────────────────────

    /** 触发攻击，子类实现具体弹道/特效逻辑 */
    protected onFire() { /* override */ }

    // ─── 派生属性 ────────────────────────────────────────────────────────────

    get effectiveDamage(): number {
        const s = this._stats;
        return s ? this.baseDamage * (1 + (this.level - 1) * 0.3) * s.attack : this.baseDamage;
    }

    get effectiveCooldown(): number {
        const s = this._stats;
        const speed = s ? s.attackSpeed : 1.0;
        return Math.max(0.15, this.baseCooldown / speed);
    }

    get effectiveRange(): number {
        const s = this._stats;
        return s ? this.baseRange * s.range : this.baseRange;
    }

    get effectiveProjectile(): number {
        const s = this._stats;
        return this.baseProjectile + (s?.projectile ?? 0) + (this.level - 1);
    }

    // ─── 工具：寻找最近敌人 ──────────────────────────────────────────────────

    protected findNearestEnemy(range: number): Node | null {
        const enemies = this.node.parent?.parent
            ?.getChildByName('Enemies')?.children ?? [];
        let best: Node | null = null;
        let bestDist = range * range;
        const myPos = this.node.parent!.worldPosition; // 父节点 = 玩家
        for (const e of enemies) {
            if (!e.active) continue;
            const d = Vec3.squaredDistance(e.worldPosition, myPos);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
    }

    protected findEnemiesInRange(range: number): Node[] {
        const enemies = this.node.parent?.parent
            ?.getChildByName('Enemies')?.children ?? [];
        const r2      = range * range;
        const myPos   = this.node.parent!.worldPosition;
        return enemies.filter(e =>
            e.active && Vec3.squaredDistance(e.worldPosition, myPos) < r2
        );
    }
}
