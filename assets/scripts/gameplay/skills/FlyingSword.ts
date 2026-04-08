import { _decorator, Node, Vec3, tween, v3 } from 'cc';
import { SkillBase } from './SkillBase';
import { HealthComponent } from '../enemy/EnemyBase';
import { ObjectPoolManager } from '../../core/ObjectPool';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass, property } = _decorator;

/**
 * 飞剑技能
 * Lv1：单枚飞剑射向最近敌人
 * Lv2：剑雨，一次发射 3 枚，扇形散射
 * Lv3：万剑归宗，发射 count 枚追踪弹，穿透
 */
@ccclass('FlyingSword')
export class FlyingSword extends SkillBase {

    skillId      = 'flying_sword';
    baseDamage   = 18;
    baseCooldown = 1.2;
    baseRange    = 300;

    protected onFire() {
        const count  = this.effectiveProjectile;
        const target = this.findNearestEnemy(this.effectiveRange);
        const origin = this.node.parent!.worldPosition;

        if (this.level >= 3) {
            // 万剑归宗：全方向追踪
            this._fireSpread(count, origin, target, true);
        } else if (this.level === 2) {
            // 剑雨：扇形散射
            this._fireSpread(Math.max(3, count), origin, target, false);
        } else {
            // Lv1：单枚
            if (target) this._fireSingle(origin, target.worldPosition, false);
        }
    }

    private _fireSpread(
        count: number,
        origin: Vec3,
        target: Node | null,
        tracking: boolean
    ) {
        const baseAngle = target
            ? Math.atan2(
                target.worldPosition.y - origin.y,
                target.worldPosition.x - origin.x
              )
            : 0;
        const spread = (count - 1) * 0.25; // 扇形总角度（弧度）
        for (let i = 0; i < count; i++) {
            const angle = baseAngle - spread / 2 + i * (spread / Math.max(count - 1, 1));
            const dest  = new Vec3(
                origin.x + Math.cos(angle) * this.effectiveRange,
                origin.y + Math.sin(angle) * this.effectiveRange,
                0
            );
            this._fireSingle(origin, dest, tracking ? target : null);
        }
    }

    private _fireSingle(from: Vec3, to: Vec3 | null, target: Node | null) {
        const sword = ObjectPoolManager.get('flying_sword');
        sword.setWorldPosition(from);
        sword.active = true;

        const dest = to ?? new Vec3(from.x + 200, from.y, 0);
        const dmg  = this.effectiveDamage;

        // 飞行动画
        tween(sword)
            .to(0.25, { worldPosition: dest }, { easing: 'linear' })
            .call(() => {
                // 到达目标位置时检测伤害
                if (target && target.active) {
                    const hp = target.getComponent(HealthComponent);
                    if (hp) hp.takeDamage(dmg);
                    EventBus.emit(GameEvents.DAMAGE_NUMBER, { pos: dest, dmg, isCrit: false });
                }
                // 穿透：Lv3 继续飞
                if (this.level >= 3) {
                    tween(sword)
                        .by(0.1, { worldPosition: new Vec3(dest.x - from.x, dest.y - from.y, 0) })
                        .call(() => ObjectPoolManager.put('flying_sword', sword))
                        .start();
                } else {
                    ObjectPoolManager.put('flying_sword', sword);
                }
            })
            .start();
    }
}
