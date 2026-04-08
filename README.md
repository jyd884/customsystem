# 《幸存之刃》Blade Survivor

**引擎：Cocos Creator 3.8.8 | 类型：Roguelite 弹幕割草 | 语言：TypeScript**

> "让玩家在短短 15-20 分钟内，体验从弱小到无敌的成长爽感"

---

## 游戏简介

《幸存之刃》是一款以东方仙侠为背景的 Roguelite 生存割草游戏。玩家扮演不同门派的散修，在被妖魔封锁的禁地中独自求生。通过不断击杀妖魔积累修为，选择功法强化自身，在 BOSS 的冲击下证道飞升或遗憾陨落。

---

## 项目结构

```
assets/
├── scripts/
│   ├── core/                    # 核心框架
│   │   ├── GameManager.ts       # 全局游戏状态（单例）
│   │   ├── EventBus.ts          # 事件总线 + 事件名常量
│   │   ├── ObjectPool.ts        # 通用对象池管理器
│   │   ├── AudioManager.ts      # 音频管理（BGM渐入/SFX池化）
│   │   └── UIManager.ts         # UI 栈式面板管理
│   ├── gameplay/
│   │   ├── GameBootstrap.ts     # Game场景入口引导器
│   │   ├── player/
│   │   │   ├── PlayerController.ts   # WASD/虚拟摇杆移动 + 无敌帧
│   │   │   ├── PlayerStats.ts        # 属性系统（6大属性 + 暴击计算）
│   │   │   └── WeaponManager.ts      # 技能槽管理（最多6种）
│   │   ├── skills/
│   │   │   ├── SkillBase.ts          # 技能基类（冷却/进阶/寻敌）
│   │   │   ├── FlyingSword.ts        # 飞剑（Lv3：万剑归宗）
│   │   │   ├── ThunderSymbol.ts      # 雷符（Lv3：九天雷劫）
│   │   │   └── FistAura.ts           # 拳罡（Lv3：罡气爆发）
│   │   ├── enemy/
│   │   │   ├── EnemyBase.ts          # 敌人基类 + HealthComponent
│   │   │   ├── EnemySpawner.ts       # 时间轴波次刷怪
│   │   │   └── BossController.ts     # 多阶段BOSS（无敌/必杀技）
│   │   ├── upgrade/
│   │   │   ├── UpgradeManager.ts     # 三选一升级 + 合成检测
│   │   │   └── UpgradeCard.ts        # 单张卡片UI组件
│   │   └── map/
│   │       ├── MapGenerator.ts       # 动态Chunk无限地图
│   │       └── CameraFollow.ts       # 平滑跟随 + 屏幕震动
│   ├── ui/
│   │   ├── HUD.ts                    # 血条/经验条/时间/击杀
│   │   ├── UpgradePanel.ts           # 升级选择弹窗
│   │   ├── ResultPanel.ts            # 结算统计面板
│   │   └── MainMenu.ts               # 主菜单（角色选择）
│   └── data/
│       └── ConfigLoader.ts           # JSON配置异步加载+缓存
├── data/
│   ├── skills.json                   # 技能定义（含合成条件）
│   ├── enemies.json                  # 敌人属性配置
│   ├── stages.json                   # 关卡时间轴波次
│   ├── characters.json               # 3个初始角色配置
│   └── upgrades.json                 # 全部升级词条（20+条）
├── scenes/         # Main / Game / Result 场景（编辑器创建）
├── prefabs/        # 敌人、技能特效、UI Prefab（编辑器创建）
├── textures/       # 美术资源
├── audio/          # BGM + SFX
└── animations/     # 动画资源
```

---

## 核心玩法循环

```
选择角色 → 进入关卡 → 自动攻击 + 手动走位
→ 击杀积累经验 → 升级三选一功法
→ 时间推进 / BOSS 出现
→ 死亡结算（获得道果）→ 局外解锁 → 新一局
```

---

## 角色

| 角色 | 门派 | 初始武器 | 特性 |
|------|------|----------|------|
| 剑修·明远 | 剑宗 | 飞剑 | 攻速快、暴击高 |
| 符修·灵素 | 符宗 | 雷符 | AOE 广、范围强 |
| 体修·铁牛 | 武宗 | 拳罡 | 高血量、近身爆发 |

---

## 合成技能

| 武器 | + 被动 | → 天道技能 |
|------|--------|------------|
| 飞剑 | 剑意强化 | **御剑飞行**（追踪穿透） |
| 雷符 | 范围增幅 | **九天雷劫**（全屏链式落雷） |

---

## 技术亮点

| 模块 | 方案 |
|------|------|
| 性能 | NodePool 对象池（子弹/敌人/特效），支持 500+ 同屏敌人 |
| 碰撞 | 自写圆形距离检测，不使用物理引擎 |
| 架构 | 组件化 ECS 思想 + EventBus 解耦 |
| 数据 | JSON 配置驱动，所有数值外部可调 |
| 存档 | sys.localStorage 保存局外道果进度 |

---

## 快速开始

1. 使用 **Cocos Creator 3.8.8** 打开本项目根目录
2. 在 `assets/scenes/` 下创建三个场景：`Main`、`Game`、`Result`
3. 将 `GameManager` 挂载在 Main 场景的常驻根节点
4. 在 Game 场景根节点挂载 `GameBootstrap`，并在 Inspector 中拖入所有 Prefab 引用
5. 创建对应 Prefab（敌人、技能特效），挂载对应脚本组件
6. 点击运行，从 Main 场景启动

---

## 开发里程碑

| 阶段 | 目标 | 时长 |
|------|------|------|
| Prototype | 玩家移动 + 1武器 + 刷怪 + 升级界面 | 2 周 |
| Alpha | 3角色 + 8技能 + BOSS + 完整局内 | 4 周 |
| Beta | 局外进度 + 3关卡 + 音效特效 | 3 周 |
| Release | Bug修复 + 性能优化 + H5发布 | 2 周 |

**总计约 11 周**