import { _decorator, Component, Node, Prefab, director } from 'cc';
import { GameManager, GameState } from '../core/GameManager';
import { EventBus, GameEvents } from '../core/EventBus';
import { ObjectPoolManager } from '../core/ObjectPool';
import { ConfigLoader } from '../data/ConfigLoader';
import { EnemySpawner, WaveConfig } from '../gameplay/enemy/EnemySpawner';
import { PlayerController } from '../gameplay/player/PlayerController';
import { PlayerStats } from '../gameplay/player/PlayerStats';
import { WeaponManager } from '../gameplay/player/WeaponManager';
import { UpgradeManager } from '../gameplay/upgrade/UpgradeManager';
import { CameraFollow } from '../gameplay/map/CameraFollow';
const { ccclass, property } = _decorator;

/**
 * Game 场景引导器
 * 挂载在 Game 场景根节点，负责：
 * 1. 加载配置数据
 * 2. 初始化玩家属性
 * 3. 注册对象池
 * 4. 启动刷怪器
 * 5. 监听游戏结束事件
 */
@ccclass('GameBootstrap')
export class GameBootstrap extends Component {

    @property(Node)  playerNode:     Node    = null!;
    @property(Node)  enemiesRoot:    Node    = null!;
    @property(Node)  cameraNode:     Node    = null!;

    // 敌人 Prefab（在编辑器中拖入）
    @property(Prefab) demonSmallPrefab:    Prefab = null!;
    @property(Prefab) demonElitePrefab:    Prefab = null!;
    @property(Prefab) miniBossTigerPrefab: Prefab = null!;
    @property(Prefab) bossMountainPrefab:  Prefab = null!;

    // 技能特效 Prefab
    @property(Prefab) flyingSwordPrefab:   Prefab = null!;
    @property(Prefab) thunderBoltPrefab:   Prefab = null!;
    @property(Prefab) fistHitPrefab:       Prefab = null!;
    @property(Prefab) burstWavePrefab:     Prefab = null!;

    async onLoad() {
        // 1. 加载所有配置
        await ConfigLoader.preloadAll();

        // 2. 注册对象池
        this._registerPools();

        // 3. 初始化玩家
        this._initPlayer();

        // 4. 初始化摄像机跟随
        const cam = this.cameraNode?.getComponent(CameraFollow);
        if (cam) cam.target = this.playerNode;

        // 5. 启动刷怪器
        await this._initSpawner();

        // 6. 初始化升级词条
        this._initUpgrades();

        // 7. 监听事件
        EventBus.on(GameEvents.PLAYER_DIED, this._onPlayerDied, this);
        EventBus.on(GameEvents.GAME_WIN,    this._onGameWin,    this);
    }

    onDestroy() {
        EventBus.targetOff(this);
        ObjectPoolManager.clearAll();
    }

    // ─── 对象池注册 ──────────────────────────────────────────────────────────

    private _registerPools() {
        ObjectPoolManager.register('demon_small',       this.demonSmallPrefab,    60, 300);
        ObjectPoolManager.register('demon_elite',       this.demonElitePrefab,    20, 100);
        ObjectPoolManager.register('mini_boss_tiger',   this.miniBossTigerPrefab,  3,  10);
        ObjectPoolManager.register('boss_mountain_demon',this.bossMountainPrefab,  1,   2);
        ObjectPoolManager.register('flying_sword',      this.flyingSwordPrefab,   30, 200);
        ObjectPoolManager.register('thunder_bolt',      this.thunderBoltPrefab,   20, 100);
        ObjectPoolManager.register('fist_hit',          this.fistHitPrefab,       20, 100);
        ObjectPoolManager.register('burst_wave',        this.burstWavePrefab,      5,  20);
    }

    // ─── 玩家初始化 ──────────────────────────────────────────────────────────

    private _initPlayer() {
        const gm   = GameManager.instance;
        const chars = ConfigLoader.get<any[]>('characters');
        const cfg   = chars.find(c => c.id === gm.characterId) ?? chars[0];

        const stats = this.playerNode.getComponent(PlayerStats)
                   ?? this.playerNode.addComponent(PlayerStats);
        stats.initFromConfig(cfg.stats);

        const ctrl  = this.playerNode.getComponent(PlayerController)
                   ?? this.playerNode.addComponent(PlayerController);
        ctrl.moveSpeed = cfg.stats.moveSpeed;
    }

    // ─── 刷怪器初始化 ────────────────────────────────────────────────────────

    private async _initSpawner() {
        const spawner = this.getComponent(EnemySpawner)
                     ?? this.addComponent(EnemySpawner);
        spawner.enemiesRoot = this.enemiesRoot;
        spawner.playerNode  = this.playerNode;

        const stages = ConfigLoader.get<any[]>('stages');
        const gm     = GameManager.instance;
        const stage  = stages.find(s => s.id === gm.stageId) ?? stages[0];
        spawner.loadWaves(stage.waves as WaveConfig[]);

        // 注册对象池（已在上方 registerPools 完成）
    }

    // ─── 升级词条初始化 ──────────────────────────────────────────────────────

    private _initUpgrades() {
        const um = this.getComponent(UpgradeManager)
                ?? this.addComponent(UpgradeManager);
        const upgrades = ConfigLoader.get<any[]>('upgrades');
        um.loadCards(upgrades);
    }

    // ─── 事件处理 ────────────────────────────────────────────────────────────

    private _onPlayerDied() {
        GameManager.instance?.changeState(GameState.GAME_OVER);
        EventBus.emit(GameEvents.GAME_OVER);
        this.scheduleOnce(() => GameManager.instance?.gotoResult(), 2.5);
    }

    private _onGameWin() {
        GameManager.instance?.changeState(GameState.WIN);
        this.scheduleOnce(() => GameManager.instance?.gotoResult(), 3.0);
    }
}
