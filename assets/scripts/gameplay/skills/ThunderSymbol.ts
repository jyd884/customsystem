import { _decorator, Node, Vec3, tween, v3 } from 'cc';
import { SkillBase } from './SkillBase';
import { ObjectPoolManager } from '../../core/ObjectPool';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass } = _decorator;

/**
 * 雷符技能（符修·灵素初始武器）
 * Lv1：在玩家周围随机召唤 1 道雷，范围 AOE
 * Lv2：同时 3 道雷，范围更广
 * Lv3：九天雷劫 - 链式连锁，击中一个敌人后自动跳至附近敌人
 */
@ccclass('ThunderSymbol')
export class ThunderSymbol extends SkillBase {

    skillId      = 'thunder_symbol';
    baseDamage   = 25;
    baseCooldown = 2.0;
    baseRange    = 150;

    protected onFire() {
        const count   = this.level >= 2 ? 3 : 1;
        const enemies = this.findEnemiesInRange(this.effectiveRange);
        if (enemies.length === 0) return;

        for (let i = 0; i < count; i++) {
            const e = enemies[Math.floor(Math.random() * enemies.length)];
            if (!e) continue;
            this._strikeAt(e, this.effectiveDamage, this.level >= 3 ? 2 : 0);
        }
    }

    private _strikeAt(target: Node, dmg: number, chainLeft: number) {
        if (!target.active) return;

        const bolt = ObjectPoolManager.get('thunder_bolt');
        bolt.setWorldPosition(target.worldPosition);
        bolt.active = true;

        // 闪电动画（简单缩放+淡出）
        tween(bolt)
            .to(0.05, { scale: v3(1.5, 1.5, 1) })
            .to(0.15, { scale: v3(0,   0,   1) })
            .call(() => {
                ObjectPoolManager.put('thunder_bolt', bolt);
                // 伤害
                const hp = target.getComponent('HealthComponent') as any;
                if (hp) hp.takeDamage(dmg);
                EventBus.emit(GameEvents.DAMAGE_NUMBER, {
                    pos: target.worldPosition, dmg, isCrit: false
                });
                // 链式（九天雷劫）
                if (chainLeft > 0) {
                    const nearby = this.findEnemiesInRange(120)
                        .filter(e => e !== target);
                    if (nearby.length > 0) {
                        const next = nearby[Math.floor(Math.random() * nearby.length)];
                        setTimeout(() => this._strikeAt(next, dmg * 0.7, chainLeft - 1), 150);
                    }
                }
            })
            .start();
    }
}
