import { _decorator, Component, Node, Vec3 } from 'cc';
import { EventBus, GameEvents } from '../../core/EventBus';
import { GameManager } from '../../core/GameManager';
import { PlayerController } from '../player/PlayerController';
import { PlayerStats } from '../player/PlayerStats';
const { ccclass, property } = _decorator;

/** 敌人分类 */
export enum EnemyType {
    NORMAL   = 'normal',
    ELITE    = 'elite',
    MINI_BOSS = 'mini_boss',
    BOSS     = 'boss',
}

/** 血量组件接口（供技能/武器调用） */
@ccclass('HealthComponent')
export class HealthComponent extends Component {
    public maxHp:     number = 50;
    public currentHp: number = 50;

    init(hp: number) {
        this.maxHp = this.currentHp = hp;
    }

    takeDamage(dmg: number): number {
        this.currentHp = Math.max(0, this.currentHp - dmg);
        this.node.emit('hpChanged', { cur: this.currentHp, max: this.maxHp });
        if (this.currentHp <= 0) {
            this.node.emit('died');
        }
        return dmg;
    }

    get isDead(): boolean { return this.currentHp <= 0; }
}

/**
 * 敌人基类
 * - 状态机：IDLE → MOVE → ATTACK → DEAD
 * - 移动：直线追玩家（带简单分离力避免堆叠）
 * - 血量：由 HealthComponent 管理
 * - 死亡：发布事件并归还对象池
 */
@ccclass('EnemyBase')
export class EnemyBase extends Component {

    @property
    public enemyType: EnemyType = EnemyType.NORMAL;

    @property
    public moveSpeed: number = 60;

    @property
    public expDrop: number = 2;

    @property
    public contactDamage: number = 10;  // 碰触玩家造成的伤害

    // ── 运行时 ────────────────────────────────────────────────────────────────
    protected _hp: HealthComponent | null = null;
    protected _player: Node | null        = null;
    private _contactCooldown: number      = 0;

    onLoad() {
        this._hp = this.getComponent(HealthComponent)
                ?? this.addComponent(HealthComponent);
        this._hp.node.on('died', this._onDied, this);
    }

    /** 由 EnemySpawner 在复用时调用 */
    init(cfg: { hp: number; speed: number; expDrop: number; contactDmg: number }) {
        this._hp!.init(cfg.hp);
        this.moveSpeed     = cfg.speed;
        this.expDrop       = cfg.expDrop;
        this.contactDamage = cfg.contactDmg;
        this._player       = null;
        this._contactCooldown = 0;
    }

    setPlayer(player: Node) { this._player = player; }

    update(dt: number) {
        if (!this._player || this._hp?.isDead) return;

        // 移动朝向玩家
        this._moveTowardsPlayer(dt);
        this._applySeparation();

        // 接触伤害检测
        if (this._contactCooldown > 0) {
            this._contactCooldown -= dt;
        } else {
            this._checkContactDamage();
        }
    }

    private _moveTowardsPlayer(dt: number) {
        const myPos   = this.node.worldPosition;
        const plyPos  = this._player!.worldPosition;
        const dx      = plyPos.x - myPos.x;
        const dy      = plyPos.y - myPos.y;
        const len     = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        this.node.setWorldPosition(
            myPos.x + (dx / len) * this.moveSpeed * dt,
            myPos.y + (dy / len) * this.moveSpeed * dt,
            0
        );
    }

    /** 简单分离力：与相邻同类保持最小距离 */
    private _applySeparation() {
        const siblings = this.node.parent?.children ?? [];
        const myPos    = this.node.worldPosition;
        const minDist  = 30;
        let fx = 0, fy = 0;
        for (const sib of siblings) {
            if (sib === this.node || !sib.active) continue;
            const dx = myPos.x - sib.worldPosition.x;
            const dy = myPos.y - sib.worldPosition.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < minDist * minDist && d2 > 0) {
                const d   = Math.sqrt(d2);
                const frc = (minDist - d) / d * 0.5;
                fx += dx * frc;
                fy += dy * frc;
            }
        }
        if (fx !== 0 || fy !== 0) {
            this.node.setWorldPosition(
                myPos.x + fx, myPos.y + fy, 0
            );
        }
    }

    private _checkContactDamage() {
        if (!this._player) return;
        const dist = Vec3.distance(this.node.worldPosition, this._player.worldPosition);
        if (dist < 28) {
            this._contactCooldown = 1.0;
            const ctrl = this._player.getComponent(PlayerController);
            if (ctrl && !ctrl.isInvincible) {
                const stats = this._player.getComponent(PlayerStats);
                stats?.takeDamage(this.contactDamage);
                ctrl.triggerInvincible();
            }
        }
    }

    private _onDied() {
        EventBus.emit(GameEvents.ENEMY_DIED, {
            pos: this.node.worldPosition,
            exp: this.expDrop,
            type: this.enemyType,
        });
        GameManager.instance?.addKill();
        this.node.active = false; // 归还池由 Spawner 监听
    }

    get hp(): HealthComponent { return this._hp!; }
}
