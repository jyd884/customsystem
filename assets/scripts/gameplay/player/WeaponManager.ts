import { _decorator, Component, Node, Prefab } from 'cc';
import { SkillBase } from '../skills/SkillBase';
import { PlayerStats } from './PlayerStats';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass, property } = _decorator;

const MAX_WEAPONS = 6;

/**
 * 武器/技能管理器
 * 负责：
 * - 持有当前已装备的技能列表（上限 6 种）
 * - 每帧驱动各技能的冷却与触发
 * - 武器升级（进阶）
 * - 合成检测（武器 + 被动 => 天道技能）
 */
@ccclass('WeaponManager')
export class WeaponManager extends Component {

    private _stats: PlayerStats | null = null;
    private _weapons: SkillBase[] = [];

    onLoad() {
        this._stats = this.node.getComponent(PlayerStats);
    }

    update(dt: number) {
        for (const w of this._weapons) {
            if (w && w.enabled) {
                w.tick(dt, this._stats!);
            }
        }
    }

    // ─── 装备技能 ─────────────────────────────────────────────────────────────

    /**
     * 添加一个技能组件（新武器）
     * @returns true 成功 / false 已满
     */
    addSkill(skillNode: Node): boolean {
        if (this._weapons.length >= MAX_WEAPONS) return false;
        const skill = skillNode.getComponent(SkillBase);
        if (!skill) return false;
        skillNode.setParent(this.node);
        this._weapons.push(skill);
        skill.onEquip(this._stats!);
        return true;
    }

    /**
     * 升级已有技能（进阶）
     */
    upgradeSkill(skillId: string, level: number) {
        const skill = this._weapons.find(w => w.skillId === skillId);
        skill?.onUpgrade(level, this._stats!);
    }

    /**
     * 查找并替换（合成天道技能）
     */
    replaceSkill(oldId: string, newSkillNode: Node) {
        const idx = this._weapons.findIndex(w => w.skillId === oldId);
        if (idx < 0) return;
        this._weapons[idx].node.destroy();
        const skill = newSkillNode.getComponent(SkillBase)!;
        newSkillNode.setParent(this.node);
        this._weapons[idx] = skill;
        skill.onEquip(this._stats!);
    }

    hasSkill(skillId: string): boolean {
        return this._weapons.some(w => w.skillId === skillId);
    }

    getSkillLevel(skillId: string): number {
        return this._weapons.find(w => w.skillId === skillId)?.level ?? 0;
    }

    get weaponCount(): number { return this._weapons.length; }
    get isFull(): boolean     { return this._weapons.length >= MAX_WEAPONS; }
}
