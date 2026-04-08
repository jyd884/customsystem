import { _decorator, Component, Node, Label, Sprite, SpriteFrame, Button } from 'cc';
import { UpgradeCardData, CardType } from './UpgradeManager';
import { EventBus, GameEvents } from '../../core/EventBus';
const { ccclass, property } = _decorator;

/**
 * 单张升级卡片 UI 组件
 * 绑定到 UpgradeCard Prefab 上，由 UpgradePanel 填充数据。
 */
@ccclass('UpgradeCard')
export class UpgradeCard extends Component {

    @property(Label)
    nameLabel: Label = null!;

    @property(Label)
    descLabel: Label = null!;

    @property(Label)
    rarityLabel: Label = null!;

    @property(Sprite)
    icon: Sprite = null!;

    @property(Node)
    border: Node = null!;   // 稀有度边框色块

    // 稀有度颜色（通过代码设置 border 颜色）
    private static readonly RARITY_COLORS = [
        '#8e9aaf',  // 普通 灰蓝
        '#5b8cdb',  // 稀有 蓝
        '#c47fff',  // 史诗 紫
    ];
    private static readonly RARITY_NAMES = ['普通', '稀有', '史诗'];

    private _data: UpgradeCardData | null = null;

    // ─── 填充数据 ────────────────────────────────────────────────────────────

    bind(data: UpgradeCardData) {
        this._data = data;
        this.nameLabel.string  = data.name;
        this.descLabel.string  = data.desc;
        this.rarityLabel.string = UpgradeCard.RARITY_NAMES[data.rarity - 1] ?? '';

        // 设置边框颜色
        const colorHex = UpgradeCard.RARITY_COLORS[data.rarity - 1];
        if (this.border) {
            const sprite = this.border.getComponent(Sprite);
            if (sprite) {
                const r = parseInt(colorHex.slice(1, 3), 16);
                const g = parseInt(colorHex.slice(3, 5), 16);
                const b = parseInt(colorHex.slice(5, 7), 16);
                sprite.color.set(r, g, b, 255);
                sprite.color = sprite.color; // trigger dirty
            }
        }

        // 为合成卡加特殊标记
        if (data.type === CardType.SYNTHESIS) {
            this.nameLabel.string = '★ ' + data.name;
        }
    }

    // ─── 点击选择 ────────────────────────────────────────────────────────────

    onClickSelect() {
        if (!this._data) return;
        EventBus.emit(GameEvents.UPGRADE_SELECTED, { card: this._data });
    }

    // ─── 悬停特效 ────────────────────────────────────────────────────────────

    onHoverIn() {
        this.node.setScale(1.05, 1.05, 1);
    }

    onHoverOut() {
        this.node.setScale(1, 1, 1);
    }
}
