import { _decorator, Component, Node } from 'cc';
import { EnemyBase, EnemyType } from './EnemyBase';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass, property } = _decorator;

/** BOSS 阶段定义 */
interface BossPhase {
    hpThreshold: number; // 进入该阶段的血量百分比（0~1）
    moveSpeed:   number;
    attackInterval: number;
}

/**
 * BOSS 控制器
 * 在 EnemyBase 基础上添加：
 * - 多阶段（Phases）：血量降到阈值切换
 * - 技能攻击（定时触发）
 * - 阶段切换时短暂无敌 + 特效
 */
@ccclass('BossController')
export class BossController extends EnemyBase {

    @property
    public bossId: string = 'boss_01';

    private _phases: BossPhase[] = [
        { hpThreshold: 1.0, moveSpeed: 45,  attackInterval: 3.0 },
        { hpThreshold: 0.6, moveSpeed: 65,  attackInterval: 2.0 },
        { hpThreshold: 0.3, moveSpeed: 90,  attackInterval: 1.2 },
    ];
    private _currentPhase: number = 0;
    private _attackTimer:  number = 0;
    private _invincible:   boolean = false;
    private _invTimer:     number  = 0;

    onLoad() {
        super.onLoad();
        this.hp.node.on('hpChanged', this._checkPhase, this);
    }

    update(dt: number) {
        if (this._invincible) {
            this._invTimer -= dt;
            if (this._invTimer <= 0) this._invincible = false;
            return;
        }
        super.update(dt);
        this._attackTimer -= dt;
        if (this._attackTimer <= 0) {
            const phase = this._phases[this._currentPhase];
            this._attackTimer = phase.attackInterval;
            this._doSkillAttack();
        }
    }

    private _checkPhase() {
        const ratio = this.hp.currentHp / this.hp.maxHp;
        for (let i = this._phases.length - 1; i >= 0; i--) {
            if (ratio <= this._phases[i].hpThreshold && i > this._currentPhase) {
                this._enterPhase(i);
                break;
            }
        }
    }

    private _enterPhase(idx: number) {
        this._currentPhase = idx;
        this.moveSpeed     = this._phases[idx].moveSpeed;
        // 短暂无敌动画
        this._invincible = true;
        this._invTimer   = 1.5;
        EventBus.emit('boss:phaseChange', { bossId: this.bossId, phase: idx });
    }

    /** BOSS 技能攻击（可根据阶段使用不同技能） */
    private _doSkillAttack() {
        if (!this._player) return;
        const phase = this._currentPhase;
        if (phase === 0)      this._skillSummonMinions();
        else if (phase === 1) this._skillSweepStrike();
        else                  this._skillDeathRay();
    }

    private _skillSummonMinions() {
        EventBus.emit('boss:skill', { type: 'summon', pos: this.node.worldPosition });
    }

    private _skillSweepStrike() {
        EventBus.emit('boss:skill', { type: 'sweep', pos: this.node.worldPosition });
    }

    private _skillDeathRay() {
        EventBus.emit('boss:skill', { type: 'deathRay', pos: this.node.worldPosition });
    }

    // 覆写：BOSS 死亡发布专属事件
    protected override onDestroy() {
        EventBus.emit(GameEvents.BOSS_DIED, { bossId: this.bossId });
    }
}
