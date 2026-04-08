import { _decorator, Component, Node, Prefab, Vec3 } from 'cc';
import { EnemyBase, EnemyType } from './EnemyBase';
import { ObjectPoolManager } from '../../core/ObjectPool';
import { EventBus, GameEvents } from '../../core/EventBus';
import { GameManager, GameState } from '../../core/GameManager';
const { ccclass, property } = _decorator;

/** 波次配置（对应 stages.json 中单条 wave 数据） */
export interface WaveConfig {
    time:       number;   // 触发时间（秒）
    enemyId:    string;   // 对象池 key
    count:      number;   // 数量
    interval:   number;   // 每只间隔（秒）
    hp:         number;
    speed:      number;
    expDrop:    number;
    contactDmg: number;
    type:       EnemyType;
}

/**
 * 敌人生成器
 * - 按 stages.json 中的时间轴波次刷怪
 * - 维护活跃敌人列表供技能查询
 * - 回收死亡敌人到对象池
 */
@ccclass('EnemySpawner')
export class EnemySpawner extends Component {

    /** 挂载所有已生成敌人的父节点 */
    @property(Node)
    public enemiesRoot: Node = null!;

    /** 玩家节点（注入给每个敌人） */
    @property(Node)
    public playerNode: Node = null!;

    // 波次队列
    private _waves: WaveConfig[]     = [];
    private _waveIdx: number         = 0;

    // 子波次计时
    private _spawnBatchLeft: number  = 0;   // 当前波次还剩多少只
    private _spawnBatchTimer: number = 0;   // 下只间隔计时
    private _currentWaveCfg: WaveConfig | null = null;

    // 活跃敌人缓存
    private _poolKeys: Set<string> = new Set();

    onLoad() {
        EventBus.on(GameEvents.ENEMY_DIED, this._onEnemyDied, this);
    }

    onDestroy() {
        EventBus.off(GameEvents.ENEMY_DIED, this._onEnemyDied, this);
    }

    /** 由场景初始化时注入波次数据 */
    loadWaves(waves: WaveConfig[]) {
        this._waves  = [...waves].sort((a, b) => a.time - b.time);
        this._waveIdx = 0;
    }

    /** 注册敌人 Prefab 到对象池 */
    registerEnemyPool(key: string, prefab: Prefab, initSize: number = 20) {
        ObjectPoolManager.register(key, prefab, initSize, 300);
        this._poolKeys.add(key);
    }

    update(dt: number) {
        if (GameManager.instance?.state !== GameState.PLAYING) return;

        const elapsed = GameManager.instance.elapsedTime;

        // 触发新波次
        while (
            this._waveIdx < this._waves.length &&
            elapsed >= this._waves[this._waveIdx].time
        ) {
            this._startWave(this._waves[this._waveIdx]);
            this._waveIdx++;
        }

        // 子波次逐只生成
        if (this._spawnBatchLeft > 0) {
            this._spawnBatchTimer -= dt;
            if (this._spawnBatchTimer <= 0) {
                this._spawnOne(this._currentWaveCfg!);
                this._spawnBatchLeft--;
                this._spawnBatchTimer = this._currentWaveCfg!.interval;
            }
        }
    }

    private _startWave(cfg: WaveConfig) {
        this._currentWaveCfg  = cfg;
        this._spawnBatchLeft  = cfg.count;
        this._spawnBatchTimer = 0;
    }

    private _spawnOne(cfg: WaveConfig) {
        const node  = ObjectPoolManager.get(cfg.enemyId);
        const enemy = node.getComponent(EnemyBase)!;
        enemy.init({
            hp:         cfg.hp,
            speed:      cfg.speed,
            expDrop:    cfg.expDrop,
            contactDmg: cfg.contactDmg,
        });
        enemy.setPlayer(this.playerNode);

        // 在玩家视野外随机位置生成
        const angle = Math.random() * Math.PI * 2;
        const dist  = 480 + Math.random() * 80;
        const px    = this.playerNode.worldPosition.x;
        const py    = this.playerNode.worldPosition.y;
        node.setWorldPosition(
            px + Math.cos(angle) * dist,
            py + Math.sin(angle) * dist,
            0
        );
        node.active = true;
        node.setParent(this.enemiesRoot);
    }

    private _onEnemyDied(data: { pos: Vec3; exp: number }) {
        // 经验掉落（由 ExperienceDrop 节点处理，这里触发事件即可）
        // 真正的归还在 EnemyBase._onDied 已设 active=false，
        // 本帧结束后统一回收
        this.scheduleOnce(() => {
            for (const child of this.enemiesRoot.children) {
                if (!child.active) {
                    const enemy = child.getComponent(EnemyBase);
                    if (enemy) {
                        const key = this._resolveKey(child);
                        if (key) ObjectPoolManager.put(key, child);
                    }
                }
            }
        }, 0);
    }

    private _resolveKey(node: Node): string | null {
        // 根据敌人组件判断用哪个池
        for (const key of this._poolKeys) {
            if (node.name.includes(key)) return key;
        }
        return null;
    }

    get activeEnemyCount(): number {
        return this.enemiesRoot.children.filter(c => c.active).length;
    }
}
