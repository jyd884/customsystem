import { _decorator, Node, Vec3, tween, v3 } from 'cc';
import { SkillBase } from './SkillBase';
import { HealthComponent } from '../enemy/EnemyBase';
import { ObjectPoolManager } from '../../core/ObjectPool';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass } = _decorator;

/**
 * 拳罡技能（体修·铁牛初始武器）
 * Lv1：近距离强力一拳，范围小但伤害高
 * Lv2：旋转拳气，持续伤害环绕
 * Lv3：罡气爆发，扩散冲击波 AOE
 */
@ccclass('FistAura')
export class FistAura extends SkillBase {

    skillId      = 'fist_aura';
    baseDamage   = 40;
    baseCooldown = 0.8;
    baseRange    = 80;

    protected onFire() {
        const myPos  = this.node.parent!.worldPosition;
        const range  = this.effectiveRange;

        if (this.level >= 3) {
            // 罡气爆发：大范围 AOE
            this._burstWave(myPos, range * 2);
        } else if (this.level === 2) {
            // 旋转拳气：360 度多目标
            const enemies = this.findEnemiesInRange(range);
            enemies.forEach(e => this._punch(e));
        } else {
            // Lv1：最近一个
            const t = this.findNearestEnemy(range);
            if (t) this._punch(t);
        }
    }

    private _punch(target: Node) {
        if (!target.active) return;
        const dmg = this.effectiveDamage;
        const hp  = target.getComponent(HealthComponent);
        if (hp) hp.takeDamage(dmg);

        const hit = ObjectPoolManager.get('fist_hit');
        hit.setWorldPosition(target.worldPosition);
        hit.active = true;
        tween(hit)
            .to(0.2, { scale: v3(1.4, 1.4, 1) })
            .call(() => ObjectPoolManager.put('fist_hit', hit))
            .start();

        EventBus.emit(GameEvents.DAMAGE_NUMBER, {
            pos: target.worldPosition, dmg, isCrit: false
        });
    }

    private _burstWave(center: Vec3, radius: number) {
        const enemies = this.findEnemiesInRange(radius);
        enemies.forEach(e => {
            const dmg = this.effectiveDamage;
            const hp  = e.getComponent(HealthComponent);
            if (hp) hp.takeDamage(dmg);
        });
        const wave = ObjectPoolManager.get('burst_wave');
        wave.setWorldPosition(center);
        wave.setScale(v3(0.1, 0.1, 1));
        wave.active = true;
        tween(wave)
            .to(0.35, { scale: v3(radius / 40, radius / 40, 1) })
            .to(0.1,  { scale: v3(0, 0, 1) })
            .call(() => ObjectPoolManager.put('burst_wave', wave))
            .start();
    }
}
