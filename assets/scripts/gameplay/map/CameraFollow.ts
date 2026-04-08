import { _decorator, Component, Node, Camera, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 摄像机平滑跟随组件
 * 挂载在摄像机节点或其父节点上。
 */
@ccclass('CameraFollow')
export class CameraFollow extends Component {

    @property(Node)
    public target: Node = null!;

    /** 跟随平滑系数（0=瞬移，1=不移动）*/
    @property({ range: [0, 1], slide: true })
    public smoothFactor: number = 0.12;

    /** 相机震动强度 */
    private _shakeIntensity: number = 0;
    private _shakeDuration:  number = 0;
    private _shakeTimer:     number = 0;

    private _basePos: Vec3 = new Vec3();

    update(dt: number) {
        if (!this.target) return;

        const tPos  = this.target.worldPosition;
        const myPos = this.node.worldPosition;

        // 平滑插值跟随
        const lerpFactor = 1 - Math.pow(this.smoothFactor, dt * 60);
        const nx = myPos.x + (tPos.x - myPos.x) * lerpFactor;
        const ny = myPos.y + (tPos.y - myPos.y) * lerpFactor;
        this._basePos.set(nx, ny, myPos.z);

        // 叠加震动偏移
        if (this._shakeTimer > 0) {
            this._shakeTimer -= dt;
            const progress = this._shakeTimer / this._shakeDuration;
            const mag      = this._shakeIntensity * progress;
            const ox = (Math.random() * 2 - 1) * mag;
            const oy = (Math.random() * 2 - 1) * mag;
            this.node.setWorldPosition(nx + ox, ny + oy, myPos.z);
        } else {
            this.node.setWorldPosition(this._basePos);
        }
    }

    /**
     * 触发相机震动
     * @param intensity  震动幅度（像素）
     * @param duration   持续时间（秒）
     */
    shake(intensity: number = 8, duration: number = 0.25) {
        this._shakeIntensity = intensity;
        this._shakeDuration  = duration;
        this._shakeTimer     = duration;
    }
}
