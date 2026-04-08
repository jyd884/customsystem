import { _decorator, Component, Node, Vec2, Vec3, input, Input, KeyCode, EventKeyboard, EventTouch } from 'cc';
import { EventBus, GameEvents } from '../../core/EventBus';
import { GameManager, GameState } from '../../core/GameManager';
const { ccclass, property } = _decorator;

/**
 * 玩家控制器
 * 负责：
 * - 键盘（WASD / 方向键）与虚拟摇杆（移动端触屏）输入
 * - 施加移动速度到角色节点
 * - 摄像机目标跟随通知
 */
@ccclass('PlayerController')
export class PlayerController extends Component {

    /** 基础移动速度（像素/秒），由 PlayerStats 注入实际值 */
    @property
    public moveSpeed: number = 160;

    // 输入方向（归一化）
    private _dir: Vec2 = new Vec2();

    // 键盘按键状态
    private _keys: Set<KeyCode> = new Set();

    // 无敌帧计时（受击后短暂无敌）
    private _invincibleTimer: number = 0;
    private _invincibleDuration: number = 0.5;

    public isInvincible: boolean = false;

    onLoad() {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP,   this._onKeyUp,   this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP,   this._onKeyUp,   this);
    }

    update(dt: number) {
        if (GameManager.instance?.state !== GameState.PLAYING) return;

        // 更新无敌帧
        if (this._invincibleTimer > 0) {
            this._invincibleTimer -= dt;
            if (this._invincibleTimer <= 0) {
                this.isInvincible = false;
            }
        }

        this._updateDirection();
        this._applyMovement(dt);
    }

    // ─── 输入处理 ─────────────────────────────────────────────────────────────

    private _onKeyDown(e: EventKeyboard) { this._keys.add(e.keyCode); }
    private _onKeyUp(e: EventKeyboard)   { this._keys.delete(e.keyCode); }

    private _updateDirection() {
        let x = 0, y = 0;
        if (this._keys.has(KeyCode.KEY_A) || this._keys.has(KeyCode.ARROW_LEFT))  x -= 1;
        if (this._keys.has(KeyCode.KEY_D) || this._keys.has(KeyCode.ARROW_RIGHT)) x += 1;
        if (this._keys.has(KeyCode.KEY_W) || this._keys.has(KeyCode.ARROW_UP))    y += 1;
        if (this._keys.has(KeyCode.KEY_S) || this._keys.has(KeyCode.ARROW_DOWN))  y -= 1;

        if (x !== 0 || y !== 0) {
            this._dir.set(x, y).normalize();
        } else {
            this._dir.set(0, 0);
        }
    }

    /** 外部注入（虚拟摇杆）调用此方法更新方向 */
    setJoystickDirection(dir: Vec2) {
        this._dir.set(dir);
        if (this._dir.lengthSqr() > 1) this._dir.normalize();
    }

    private _applyMovement(dt: number) {
        if (this._dir.lengthSqr() < 0.001) return;
        const pos = this.node.position;
        this.node.setPosition(
            pos.x + this._dir.x * this.moveSpeed * dt,
            pos.y + this._dir.y * this.moveSpeed * dt,
            pos.z,
        );
        // 翻转朝向
        this.node.setScale(this._dir.x < 0 ? -1 : 1, 1, 1);
    }

    // ─── 受击无敌帧 ──────────────────────────────────────────────────────────

    triggerInvincible() {
        this.isInvincible     = true;
        this._invincibleTimer = this._invincibleDuration;
    }

    // ─── 对外获取方向 ────────────────────────────────────────────────────────

    get moveDirection(): Vec2 { return this._dir; }
}
