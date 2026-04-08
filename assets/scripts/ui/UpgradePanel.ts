import { _decorator, Component, Node, instantiate, Prefab, tween } from 'cc';
import { EventBus, GameEvents } from '../core/EventBus';
import { UpgradeCardData } from '../gameplay/upgrade/UpgradeManager';
import { UpgradeCard } from '../gameplay/upgrade/UpgradeCard';
const { ccclass, property } = _decorator;

/**
 * 升级选择面板
 * 显示 3 张技能卡，玩家点击后关闭并恢复游戏。
 */
@ccclass('UpgradePanel')
export class UpgradePanel extends Component {

    @property(Prefab)
    cardPrefab: Prefab = null!;

    @property(Node)
    cardContainer: Node = null!;

    private _cardNodes: Node[] = [];

    onLoad() {
        EventBus.on(GameEvents.UPGRADE_SHOW, this._onShow, this);
        EventBus.on(GameEvents.UPGRADE_SELECTED, this._onSelected, this);
        this.node.active = false;
    }

    onDestroy() {
        EventBus.targetOff(this);
    }

    private _onShow(data: { cards: UpgradeCardData[] }) {
        // 清除旧卡
        this._cardNodes.forEach(n => n.destroy());
        this._cardNodes = [];

        for (const cardData of data.cards) {
            const cardNode = instantiate(this.cardPrefab);
            const cardComp = cardNode.getComponent(UpgradeCard)!;
            cardComp.bind(cardData);
            this.cardContainer.addChild(cardNode);
            this._cardNodes.push(cardNode);
        }

        this.node.active = true;
        // 动画：从下方弹出
        this.node.setScale(0.8, 0.8, 1);
        tween(this.node)
            .to(0.2, { scale: { x: 1, y: 1, z: 1 } }, { easing: 'backOut' })
            .start();
    }

    private _onSelected(_data: unknown) {
        this.node.active = false;
    }
}
