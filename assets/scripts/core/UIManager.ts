import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
const { ccclass } = _decorator;

/**
 * UI 管理器（单例）
 * 采用「栈式管理」，支持 push / pop / replace 面板。
 * 面板 Prefab 需在此注册后方可使用。
 */
@ccclass('UIManager')
export class UIManager extends Component {

    private static _instance: UIManager | null = null;

    /** UI 根节点（Canvas 下专用层级） */
    private _root: Node = null!;

    /** 已注册的面板 Prefab */
    private _prefabMap: Map<string, Prefab> = new Map();

    /** 已实例化的面板节点 */
    private _nodeMap: Map<string, Node> = new Map();

    /** 面板栈（记录当前活跃面板顺序） */
    private _stack: string[] = [];

    onLoad() {
        if (UIManager._instance && UIManager._instance !== this) {
            this.node.destroy();
            return;
        }
        UIManager._instance = this;
        this._root = this.node;
    }

    static get instance(): UIManager { return UIManager._instance!; }

    // ─── 注册 ─────────────────────────────────────────────────────────────────

    register(key: string, prefab: Prefab) {
        this._prefabMap.set(key, prefab);
    }

    // ─── 展示面板 ─────────────────────────────────────────────────────────────

    /**
     * 推入面板（入栈），可同时隐藏背后的面板
     */
    push(key: string, hideBelow: boolean = false): Node {
        if (hideBelow && this._stack.length > 0) {
            const topKey  = this._stack[this._stack.length - 1];
            const topNode = this._nodeMap.get(topKey);
            if (topNode) topNode.active = false;
        }

        const node = this._getOrCreate(key);
        node.active = true;
        node.setSiblingIndex(999); // 置顶
        this._stack.push(key);
        return node;
    }

    /**
     * 弹出当前面板（出栈），显示下面的面板
     */
    pop() {
        const key = this._stack.pop();
        if (key) {
            const node = this._nodeMap.get(key);
            if (node) node.active = false;
        }
        if (this._stack.length > 0) {
            const prevKey  = this._stack[this._stack.length - 1];
            const prevNode = this._nodeMap.get(prevKey);
            if (prevNode) prevNode.active = true;
        }
    }

    /**
     * 替换当前顶部面板
     */
    replace(key: string): Node {
        this.pop();
        return this.push(key);
    }

    /**
     * 直接关闭指定面板（不管栈顺序）
     */
    close(key: string) {
        const node = this._nodeMap.get(key);
        if (node) node.active = false;
        const idx = this._stack.indexOf(key);
        if (idx >= 0) this._stack.splice(idx, 1);
    }

    /**
     * 清空所有面板（场景切换时调用）
     */
    closeAll() {
        this._nodeMap.forEach(n => n.destroy());
        this._nodeMap.clear();
        this._stack = [];
    }

    // ─── 私有工具 ─────────────────────────────────────────────────────────────

    private _getOrCreate(key: string): Node {
        if (this._nodeMap.has(key)) return this._nodeMap.get(key)!;

        const prefab = this._prefabMap.get(key);
        if (!prefab) throw new Error(`[UIManager] Prefab "${key}" not registered.`);

        const node = instantiate(prefab);
        this._root.addChild(node);
        this._nodeMap.set(key, node);
        return node;
    }

    // ─── 查询 ─────────────────────────────────────────────────────────────────

    getPanel(key: string): Node | undefined {
        return this._nodeMap.get(key);
    }

    get currentKey(): string | undefined {
        return this._stack[this._stack.length - 1];
    }
}
