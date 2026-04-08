import { NodePool, Node, Prefab, instantiate } from 'cc';

/**
 * 通用对象池管理器（单例）
 * 支持多种 Prefab 同时注册，按 key 取放节点。
 *
 * 用法：
 *   ObjectPoolManager.register('bullet', bulletPrefab, 50);
 *   const node = ObjectPoolManager.get('bullet');
 *   ObjectPoolManager.put('bullet', node);
 */
export class ObjectPoolManager {

    private static _pools: Map<string, NodePool>    = new Map();
    private static _prefabs: Map<string, Prefab>    = new Map();
    private static _maxSizes: Map<string, number>   = new Map();

    /**
     * 注册一个对象池
     * @param key       唯一标识符
     * @param prefab    对应的 Prefab
     * @param initSize  预热数量
     * @param maxSize   最大容量（超出时直接 destroy，默认 200）
     */
    static register(
        key: string,
        prefab: Prefab,
        initSize: number = 10,
        maxSize: number = 200
    ) {
        if (this._pools.has(key)) return;

        const pool = new NodePool();
        this._pools.set(key, pool);
        this._prefabs.set(key, prefab);
        this._maxSizes.set(key, maxSize);

        // 预热
        for (let i = 0; i < initSize; i++) {
            const node = instantiate(prefab);
            pool.put(node);
        }
    }

    /**
     * 从对象池取出一个节点（若池为空则 instantiate）
     */
    static get(key: string): Node {
        const pool   = this._pools.get(key);
        const prefab = this._prefabs.get(key);

        if (!pool || !prefab) {
            throw new Error(`[ObjectPool] Key "${key}" not registered.`);
        }

        if (pool.size() > 0) {
            return pool.get()!;
        }
        return instantiate(prefab);
    }

    /**
     * 将节点归还对象池
     */
    static put(key: string, node: Node) {
        const pool    = this._pools.get(key);
        const maxSize = this._maxSizes.get(key) ?? 200;

        if (!pool) {
            node.destroy();
            return;
        }

        if (pool.size() >= maxSize) {
            node.destroy();
        } else {
            pool.put(node);
        }
    }

    /**
     * 清空指定对象池
     */
    static clear(key: string) {
        const pool = this._pools.get(key);
        if (pool) pool.clear();
    }

    /**
     * 清空所有对象池（场景切换时调用）
     */
    static clearAll() {
        this._pools.forEach(pool => pool.clear());
        this._pools.clear();
        this._prefabs.clear();
        this._maxSizes.clear();
    }

    /**
     * 查询某池当前可用数量
     */
    static size(key: string): number {
        return this._pools.get(key)?.size() ?? 0;
    }
}
