import { assetManager, JsonAsset } from 'cc';

/**
 * JSON 配置加载器（单例）
 * 统一管理所有游戏配置数据的加载与缓存。
 *
 * 使用示例：
 *   const skills = await ConfigLoader.load<SkillConfig[]>('skills');
 */
export class ConfigLoader {

    private static _cache: Map<string, unknown> = new Map();

    /** 预加载所有配置文件（在 GameManager 初始化时调用） */
    static async preloadAll(): Promise<void> {
        const keys = ['skills', 'enemies', 'stages', 'characters', 'upgrades'];
        await Promise.all(keys.map(k => this.load(k)));
    }

    /**
     * 异步加载指定配置
     * @param key  对应 assets/data/<key>.json
     */
    static async load<T = unknown>(key: string): Promise<T> {
        if (this._cache.has(key)) {
            return this._cache.get(key) as T;
        }

        return new Promise<T>((resolve, reject) => {
            assetManager.loadAny(
                { url: `data/${key}`, type: JsonAsset },
                (err, asset: JsonAsset) => {
                    if (err) {
                        console.error(`[ConfigLoader] Failed to load "${key}":`, err);
                        reject(err);
                        return;
                    }
                    const data = asset.json as T;
                    this._cache.set(key, data);
                    resolve(data);
                }
            );
        });
    }

    /**
     * 同步获取已缓存的配置（必须在 preloadAll() 完成后调用）
     */
    static get<T = unknown>(key: string): T {
        if (!this._cache.has(key)) {
            throw new Error(`[ConfigLoader] "${key}" not loaded yet. Call preloadAll() first.`);
        }
        return this._cache.get(key) as T;
    }

    static clearCache() {
        this._cache.clear();
    }
}
