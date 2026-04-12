-- ============================================================
-- HT 工序数据预处理系统 - 数据库 Schema
-- ============================================================
-- ER 图说明：
--   Material (1) ──< (N) Batch (1) ──< (1) ProcessParam
--   Batch (1) ──< (N) InvalidBatchLog
--
-- 实体：
--   1. material         物料品号主表
--   2. batch            生产批次表
--   3. process_param    工艺参数向量表
--   4. invalid_batch_log 异常批次日志表（审计用）
--
-- 实体关系：
--   - material : batch = 1 : N（一个物料品号有多个批次）
--   - batch : process_param = 1 : 1（一个批次有一组参数向量）
--
-- 字段约束：
--   - material_no  PRIMARY KEY + NOT NULL
--   - batch_no     PRIMARY KEY + NOT NULL + FK → material
--   - process_param.batch_no  UNIQUE + FK → batch (级联删除)
--   - 所有数值字段使用 DECIMAL(10,4) 保证精度
-- ============================================================

CREATE DATABASE IF NOT EXISTS ht_process_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ht_process_db;

-- --------------------------------------------------------
-- 1. 物料品号主表
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS material (
    material_no   VARCHAR(64)   NOT NULL                    COMMENT '物料品号（唯一标识）',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '创建时间',
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP               COMMENT '更新时间',
    PRIMARY KEY (material_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='物料品号主表，一个品号对应多个批次';

-- --------------------------------------------------------
-- 2. 生产批次表
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS batch (
    batch_no      VARCHAR(64)   NOT NULL                    COMMENT '批号（唯一标识）',
    material_no   VARCHAR(64)   NOT NULL                    COMMENT '所属物料品号',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT '入库时间',
    PRIMARY KEY (batch_no),
    INDEX         idx_material_no (material_no),
    CONSTRAINT fk_batch_material
        FOREIGN KEY (material_no)
        REFERENCES material(material_no)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='生产批次表，一个批次对应一组工艺参数';

-- --------------------------------------------------------
-- 3. 工艺参数向量表（核心表）
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS process_param (
    id                BIGINT        NOT NULL AUTO_INCREMENT  COMMENT '主键（自增）',
    batch_no          VARCHAR(64)   NOT NULL                 COMMENT '批号（关联 batch 表）',
    -- 8 个核心工艺参数
    cable_core_od     DECIMAL(10,4)                          COMMENT '缆芯外径 (mm)',
    sheath_od         DECIMAL(10,4)                          COMMENT '护套外径 (mm)',
    extrusion_inner   DECIMAL(10,4)                          COMMENT '挤出内模 (mm)',
    extrusion_outer   DECIMAL(10,4)                          COMMENT '挤出外模 (mm)',
    screw_speed       DECIMAL(10,4)                          COMMENT '螺杆速度 (rpm)',
    screw_current     DECIMAL(10,4)                          COMMENT '螺杆电流 (A)',
    prod_speed        DECIMAL(10,4)                          COMMENT '生产速度 (m/min)',
    actual_prod_speed DECIMAL(10,4)                          COMMENT '实际生产速度 (m/min)',
    -- 溯源字段
    source_file       VARCHAR(256)                           COMMENT '来源 Excel 文件名',
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '入库时间',
    -- 约束
    PRIMARY KEY (id),
    UNIQUE KEY  uq_batch_no (batch_no),
    CONSTRAINT fk_param_batch
        FOREIGN KEY (batch_no)
        REFERENCES batch(batch_no)
        ON DELETE CASCADE ON UPDATE CASCADE,
    -- 合法性检查约束（MySQL 8.0.16+）
    CONSTRAINT chk_cable_core_od    CHECK (cable_core_od    >= 0),
    CONSTRAINT chk_sheath_od        CHECK (sheath_od        >= 0),
    CONSTRAINT chk_extrusion_inner  CHECK (extrusion_inner  >= 0),
    CONSTRAINT chk_extrusion_outer  CHECK (extrusion_outer  >= 0),
    CONSTRAINT chk_extrusion_diff   CHECK (extrusion_outer  >  extrusion_inner),
    CONSTRAINT chk_sheath_vs_core   CHECK (sheath_od        >= cable_core_od),
    CONSTRAINT chk_screw_speed      CHECK (screw_speed      >= 0),
    CONSTRAINT chk_screw_current    CHECK (screw_current    >= 0),
    CONSTRAINT chk_prod_speed       CHECK (prod_speed       >= 0),
    CONSTRAINT chk_actual_prod_speed CHECK (actual_prod_speed >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='工艺参数向量表，每批次存一组 8 个工艺参数';

-- --------------------------------------------------------
-- 4. 异常批次日志表（不入 batch/process_param，仅审计）
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS invalid_batch_log (
    id            BIGINT        NOT NULL AUTO_INCREMENT  COMMENT '主键',
    batch_no      VARCHAR(64)                            COMMENT '批号',
    material_no   VARCHAR(64)                            COMMENT '物料品号',
    source_file   VARCHAR(256)                           COMMENT '来源文件',
    reason        TEXT                                   COMMENT '不合法原因',
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
    PRIMARY KEY (id),
    INDEX idx_inv_batch_no (batch_no),
    INDEX idx_inv_material_no (material_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  COMMENT='异常批次日志表，记录清洗时被过滤的批次';

-- ============================================================
-- 常用统计查询视图（可扩展）
-- ============================================================

-- 视图1：每个物料品号的批次数量
CREATE OR REPLACE VIEW v_material_batch_count AS
SELECT
    m.material_no,
    COUNT(b.batch_no) AS batch_count
FROM material m
LEFT JOIN batch b ON b.material_no = m.material_no
GROUP BY m.material_no;

-- 视图2：每个物料品号的工艺参数统计（均值）
CREATE OR REPLACE VIEW v_material_param_avg AS
SELECT
    b.material_no,
    AVG(p.cable_core_od)     AS avg_cable_core_od,
    AVG(p.sheath_od)         AS avg_sheath_od,
    AVG(p.extrusion_inner)   AS avg_extrusion_inner,
    AVG(p.extrusion_outer)   AS avg_extrusion_outer,
    AVG(p.screw_speed)       AS avg_screw_speed,
    AVG(p.screw_current)     AS avg_screw_current,
    AVG(p.prod_speed)        AS avg_prod_speed,
    AVG(p.actual_prod_speed) AS avg_actual_prod_speed
FROM batch b
JOIN process_param p ON p.batch_no = b.batch_no
GROUP BY b.material_no;

-- 视图3：不同工艺参数向量种类数（按物料品号）
CREATE OR REPLACE VIEW v_param_vector_types AS
SELECT
    b.material_no,
    COUNT(DISTINCT
        CONCAT_WS(',',
            p.cable_core_od, p.sheath_od,
            p.extrusion_inner, p.extrusion_outer,
            p.screw_speed, p.screw_current,
            p.prod_speed, p.actual_prod_speed)
    ) AS vector_type_count
FROM batch b
JOIN process_param p ON p.batch_no = b.batch_no
GROUP BY b.material_no;
