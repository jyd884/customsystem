import { _decorator, Component, Node, Camera, Vec3 } from 'cc';
import { GameManager, GameState } from '../../core/GameManager';
const { ccclass, property } = _decorator;

const TILE_SIZE   = 128; // 单个 Tile 像素大小
const CHUNK_COLS  = 5;   // 单块格子列数
const CHUNK_ROWS  = 5;   // 单块格子行数
const VIEW_CHUNKS = 3;   // 玩家周围保持的块数（半径）

/**
 * 无限循环地图生成器
 * - 将地图划分为「Chunk」（块），以玩家位置为中心动态加载/卸载
 * - 每个 Chunk 由 Tilemap 节点组成
 * - 本实现使用简单 Sprite 占位；实际项目替换为 TiledMap 组件
 */
@ccclass('MapGenerator')
export class MapGenerator extends Component {

    @property(Node)
    public mapRoot: Node = null!;

    @property(Node)
    public playerNode: Node = null!;

    // 已加载的 chunk 键 -> Node
    private _loadedChunks: Map<string, Node> = new Map();

    private _lastChunkX: number = Infinity;
    private _lastChunkY: number = Infinity;

    update(_dt: number) {
        if (!this.playerNode) return;

        const px  = this.playerNode.worldPosition.x;
        const py  = this.playerNode.worldPosition.y;
        const chunkW = TILE_SIZE * CHUNK_COLS;
        const chunkH = TILE_SIZE * CHUNK_ROWS;
        const cx  = Math.round(px / chunkW);
        const cy  = Math.round(py / chunkH);

        if (cx === this._lastChunkX && cy === this._lastChunkY) return;
        this._lastChunkX = cx;
        this._lastChunkY = cy;

        this._updateChunks(cx, cy, chunkW, chunkH);
    }

    private _updateChunks(
        cx: number, cy: number,
        chunkW: number, chunkH: number
    ) {
        const needed = new Set<string>();

        for (let dx = -VIEW_CHUNKS; dx <= VIEW_CHUNKS; dx++) {
            for (let dy = -VIEW_CHUNKS; dy <= VIEW_CHUNKS; dy++) {
                const key = `${cx + dx},${cy + dy}`;
                needed.add(key);
                if (!this._loadedChunks.has(key)) {
                    this._loadChunk(cx + dx, cy + dy, chunkW, chunkH, key);
                }
            }
        }

        // 卸载不再需要的 Chunk
        for (const [key, node] of this._loadedChunks) {
            if (!needed.has(key)) {
                node.destroy();
                this._loadedChunks.delete(key);
            }
        }
    }

    private _loadChunk(
        cx: number, cy: number,
        chunkW: number, chunkH: number,
        key: string
    ) {
        const chunk = new Node(`Chunk_${key}`);
        chunk.setWorldPosition(cx * chunkW, cy * chunkH, -10);
        this.mapRoot.addChild(chunk);
        this._loadedChunks.set(key, chunk);
        // 实际项目在此 addComponent(TiledMap) 并加载对应地图资源
        // 此处仅创建占位节点，供 Tilemap 资源动态挂载
    }

    onDestroy() {
        this._loadedChunks.forEach(n => n.destroy());
        this._loadedChunks.clear();
    }
}
