import { _decorator, Component, Node, Label, ProgressBar } from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
const { ccclass, property } = _decorator;

/**
 * 游戏 HUD（极简）
 * - 血量条
 * - 经验条 + 等级
 * - 已过时间
 * - 已装备技能图标栏
 */
@ccclass('HUD')
export class HUD extends Component {

    @property(ProgressBar)
    hpBar: ProgressBar = null!;

    @property(Label)
    hpLabel: Label = null!;

    @property(ProgressBar)
    expBar: ProgressBar = null!;

    @property(Label)
    levelLabel: Label = null!;

    @property(Label)
    timeLabel: Label = null!;

    @property(Label)
    killLabel: Label = null!;

    onLoad() {
        EventBus.on(GameEvents.PLAYER_HP_CHANGED,  this._onHpChanged,  this);
        EventBus.on(GameEvents.PLAYER_EXP_CHANGED, this._onExpChanged, this);
    }

    onDestroy() {
        EventBus.targetOff(this);
    }

    update(_dt: number) {
        // 时间与击杀数每帧刷新
        const gm = GameManager.instance;
        if (!gm) return;
        const t  = gm.elapsedTime;
        const m  = Math.floor(t / 60);
        const s  = Math.floor(t % 60);
        this.timeLabel.string = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
        this.killLabel.string = `击杀 ${gm.killCount}`;
    }

    private _onHpChanged(data: { cur: number; max: number }) {
        this.hpBar.progress      = data.cur / data.max;
        this.hpLabel.string      = `${data.cur} / ${data.max}`;
    }

    private _onExpChanged(data: { cur: number; max: number; level: number }) {
        this.expBar.progress     = data.cur / data.max;
        this.levelLabel.string   = `Lv.${data.level}`;
    }
}
