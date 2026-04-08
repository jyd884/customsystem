import { _decorator, Component, Label } from 'cc';
import { GameManager } from '../core/GameManager';
import { EventBus, GameEvents } from '../core/EventBus';
const { ccclass, property } = _decorator;

/**
 * 结算面板
 * 显示本局统计数据，并提供「再来一局」与「返回主菜单」按钮。
 */
@ccclass('ResultPanel')
export class ResultPanel extends Component {

    @property(Label) killLabel:    Label = null!;
    @property(Label) damageLabel:  Label = null!;
    @property(Label) timeLabel:    Label = null!;
    @property(Label) daoGuoLabel:  Label = null!;
    @property(Label) totalDaoGuo:  Label = null!;

    onLoad() {
        EventBus.on(GameEvents.GAME_OVER, this._show, this);
        EventBus.on(GameEvents.GAME_WIN,  this._show, this);
        this.node.active = false;
    }

    onDestroy() {
        EventBus.targetOff(this);
    }

    private _show() {
        const gm = GameManager.instance;
        const t  = gm.elapsedTime;
        const m  = Math.floor(t / 60);
        const s  = Math.floor(t % 60);

        this.killLabel.string   = `击杀妖魔：${gm.killCount}`;
        this.damageLabel.string = `总伤害：  ${gm.totalDamage.toLocaleString()}`;
        this.timeLabel.string   = `生存时长：${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

        const earned = Math.floor(gm.killCount * 0.5 + t * 0.1);
        this.daoGuoLabel.string = `获得道果：+${earned}`;
        this.totalDaoGuo.string = `道果总计：${gm.daoGuo}`;

        this.node.active = true;
    }

    /** 按钮回调：再来一局 */
    onPlayAgain() {
        const gm = GameManager.instance;
        gm.startGame(gm.characterId, gm.stageId);
    }

    /** 按钮回调：返回主菜单 */
    onMainMenu() {
        GameManager.instance.gotoMainMenu();
    }
}
