import { _decorator, Component, Node, director, game } from 'cc';
const { ccclass, property } = _decorator;

/** 游戏全局状态枚举 */
export enum GameState {
    MAIN_MENU = 'MAIN_MENU',
    PLAYING   = 'PLAYING',
    PAUSED    = 'PAUSED',
    UPGRADE   = 'UPGRADE',       // 升级选择界面（暂停战斗）
    REALM_BREAK = 'REALM_BREAK', // 境界突破（暂停战斗）
    GAME_OVER = 'GAME_OVER',
    WIN       = 'WIN',
}

/** 游戏全局管理器（单例） */
@ccclass('GameManager')
export class GameManager extends Component {

    private static _instance: GameManager | null = null;

    // ── 当前局内运行时数据 ────────────────────────────────
    private _state: GameState = GameState.MAIN_MENU;
    private _elapsedTime: number = 0;       // 局内已运行秒数
    private _killCount: number = 0;         // 当前局击杀数
    private _totalDamage: number = 0;       // 当前局总伤害

    // ── 局外永久货币 ──────────────────────────────────────
    private _daoGuo: number = 0;            // 道果（永久货币）

    // ── 关卡配置（由主场景注入） ──────────────────────────
    public stageId: string = 'stage_01';
    public characterId: string = 'sword_mingyuan';

    // ── 生命周期 ──────────────────────────────────────────

    onLoad() {
        if (GameManager._instance && GameManager._instance !== this) {
            this.node.destroy();
            return;
        }
        GameManager._instance = this;
        game.addPersistRootNode(this.node);
        this._loadPersistData();
    }

    static get instance(): GameManager {
        return GameManager._instance!;
    }

    // ── 状态控制 ─────────────────────────────────────────

    get state(): GameState { return this._state; }

    changeState(newState: GameState) {
        const prev = this._state;
        this._state = newState;
        this.node.emit('stateChanged', { prev, cur: newState });
    }

    get isPlaying(): boolean { return this._state === GameState.PLAYING; }

    // ── 局内计时 ─────────────────────────────────────────

    update(dt: number) {
        if (this._state === GameState.PLAYING) {
            this._elapsedTime += dt;
        }
    }

    get elapsedTime(): number { return this._elapsedTime; }

    resetRuntime() {
        this._elapsedTime = 0;
        this._killCount   = 0;
        this._totalDamage = 0;
    }

    // ── 击杀 / 伤害统计 ──────────────────────────────────

    addKill(count: number = 1) { this._killCount += count; }
    addDamage(dmg: number)     { this._totalDamage += dmg; }
    get killCount()  { return this._killCount; }
    get totalDamage(){ return this._totalDamage; }

    // ── 道果（永久货币） ──────────────────────────────────

    get daoGuo(): number { return this._daoGuo; }

    earnDaoGuo(amount: number) {
        this._daoGuo += amount;
        this._savePersistData();
    }

    spendDaoGuo(amount: number): boolean {
        if (this._daoGuo < amount) return false;
        this._daoGuo -= amount;
        this._savePersistData();
        return true;
    }

    // ── 场景切换 ─────────────────────────────────────────

    gotoMainMenu() {
        this.changeState(GameState.MAIN_MENU);
        director.loadScene('Main');
    }

    startGame(characterId: string, stageId: string) {
        this.characterId = characterId;
        this.stageId     = stageId;
        this.resetRuntime();
        this.changeState(GameState.PLAYING);
        director.loadScene('Game');
    }

    gotoResult() {
        // 结算道果：击杀数 + 时间奖励
        const earned = Math.floor(this._killCount * 0.5 + this._elapsedTime * 0.1);
        this.earnDaoGuo(earned);
        director.loadScene('Result');
    }

    // ── 持久化存档 ───────────────────────────────────────

    private _savePersistData() {
        const data = { daoGuo: this._daoGuo };
        sys.localStorage.setItem('blade_survivor_save', JSON.stringify(data));
    }

    private _loadPersistData() {
        const raw = sys.localStorage.getItem('blade_survivor_save');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                this._daoGuo = data.daoGuo ?? 0;
            } catch { /* ignore corrupt save */ }
        }
    }
}
