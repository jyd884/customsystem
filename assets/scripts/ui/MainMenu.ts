import { _decorator, Component, Node, Label, Button } from 'cc';
import { GameManager } from '../core/GameManager';
const { ccclass, property } = _decorator;

/**
 * 主菜单 UI
 * - 角色选择（3 个初始角色）
 * - 关卡/地图选择
 * - 天赋板入口（预留）
 * - 设置入口（音量）
 */
@ccclass('MainMenu')
export class MainMenu extends Component {

    @property(Label)  daoGuoLabel:    Label   = null!;
    @property([Node]) characterCards: Node[]  = [];

    private _selectedChar: string = 'sword_mingyuan';
    private _selectedStage: string = 'stage_01';

    private static readonly CHAR_IDS = [
        'sword_mingyuan',
        'symbol_lingsu',
        'body_tieNiu',
    ];

    onLoad() {
        this._refreshDaoGuo();
        this._updateCharacterSelection(0);
    }

    private _refreshDaoGuo() {
        const gm = GameManager.instance;
        if (gm && this.daoGuoLabel) {
            this.daoGuoLabel.string = `道果：${gm.daoGuo}`;
        }
    }

    // ─── 角色选择 ────────────────────────────────────────────────────────────

    onSelectChar(idx: number) {
        this._selectedChar = MainMenu.CHAR_IDS[idx] ?? MainMenu.CHAR_IDS[0];
        this._updateCharacterSelection(idx);
    }

    private _updateCharacterSelection(selected: number) {
        this.characterCards.forEach((card, i) => {
            card.setScale(i === selected ? 1.05 : 1, i === selected ? 1.05 : 1, 1);
        });
    }

    // ─── 开始游戏 ────────────────────────────────────────────────────────────

    onStartGame() {
        GameManager.instance?.startGame(this._selectedChar, this._selectedStage);
    }

    // ─── 设置 ────────────────────────────────────────────────────────────────

    onOpenSettings() {
        // TODO: 打开设置面板（音量）
    }

    // ─── 天赋板（预留） ──────────────────────────────────────────────────────

    onOpenTalentBoard() {
        // TODO: 打开天赋板
    }
}
