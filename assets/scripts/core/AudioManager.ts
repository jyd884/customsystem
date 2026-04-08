import { _decorator, Component, AudioClip, AudioSource, Node, game, sys } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 音频管理器（单例 Component）
 * 挂载在场景的常驻根节点上。
 * 支持 BGM 渐入渐出、SFX 池化播放。
 */
@ccclass('AudioManager')
export class AudioManager extends Component {

    private static _instance: AudioManager | null = null;

    /** BGM 专用 AudioSource */
    @property(AudioSource)
    private bgmSource: AudioSource = null!;

    /** SFX 专用 AudioSource（多路同时播放） */
    @property([AudioSource])
    private sfxSources: AudioSource[] = [];

    // 音量设置
    private _bgmVolume: number  = 0.7;
    private _sfxVolume: number  = 1.0;
    private _sfxPointer: number = 0;   // 循环使用 sfxSources

    onLoad() {
        if (AudioManager._instance && AudioManager._instance !== this) {
            this.node.destroy();
            return;
        }
        AudioManager._instance = this;
        game.addPersistRootNode(this.node);
        this._loadVolumeSettings();
    }

    static get instance(): AudioManager {
        return AudioManager._instance!;
    }

    // ─── BGM ──────────────────────────────────────────────────────────────────

    playBGM(clip: AudioClip, loop: boolean = true) {
        if (this.bgmSource.clip === clip && this.bgmSource.playing) return;
        this.bgmSource.clip   = clip;
        this.bgmSource.loop   = loop;
        this.bgmSource.volume = this._bgmVolume;
        this.bgmSource.play();
    }

    stopBGM() {
        this.bgmSource.stop();
    }

    fadeOutBGM(duration: number = 1.0) {
        const step      = 0.05;
        const intervals = Math.ceil(duration / step);
        const decrease  = this._bgmVolume / intervals;
        let count       = 0;
        const timer     = setInterval(() => {
            this.bgmSource.volume = Math.max(0, this.bgmSource.volume - decrease);
            count++;
            if (count >= intervals) {
                clearInterval(timer);
                this.bgmSource.stop();
                this.bgmSource.volume = this._bgmVolume;
            }
        }, step * 1000);
    }

    // ─── SFX ──────────────────────────────────────────────────────────────────

    playSFX(clip: AudioClip, volumeScale: number = 1.0) {
        if (this.sfxSources.length === 0) return;
        const src     = this.sfxSources[this._sfxPointer];
        this._sfxPointer = (this._sfxPointer + 1) % this.sfxSources.length;
        src.clip      = clip;
        src.volume    = this._sfxVolume * volumeScale;
        src.play();
    }

    // ─── 音量 ─────────────────────────────────────────────────────────────────

    set bgmVolume(v: number) {
        this._bgmVolume         = Math.max(0, Math.min(1, v));
        this.bgmSource.volume   = this._bgmVolume;
        this._saveVolumeSettings();
    }
    get bgmVolume(): number { return this._bgmVolume; }

    set sfxVolume(v: number) {
        this._sfxVolume = Math.max(0, Math.min(1, v));
        this._saveVolumeSettings();
    }
    get sfxVolume(): number { return this._sfxVolume; }

    // ─── 持久化 ───────────────────────────────────────────────────────────────

    private _saveVolumeSettings() {
        sys.localStorage.setItem('audio_settings', JSON.stringify({
            bgm: this._bgmVolume,
            sfx: this._sfxVolume,
        }));
    }

    private _loadVolumeSettings() {
        const raw = sys.localStorage.getItem('audio_settings');
        if (raw) {
            try {
                const d = JSON.parse(raw);
                this._bgmVolume = d.bgm ?? 0.7;
                this._sfxVolume = d.sfx ?? 1.0;
            } catch { /* ignore */ }
        }
    }
}
