"""数据库存储模块。

负责将合法 Batch 对象持久化到 MySQL 数据库。
使用 SQLAlchemy Core（不依赖 ORM 映射类），便于未来迁移到其他数据库。
"""
from __future__ import annotations

import logging
from typing import List, Optional

from sqlalchemy import (
    create_engine,
    text,
    Engine,
)

from ..models.batch import Batch
from ..config.config import DatabaseConfig

logger = logging.getLogger(__name__)


class DbRepository:
    """提供对 MySQL 数据库的读写操作。

    职责：
    - 建表（若不存在）
    - 写入 Material、Batch、ProcessParam 记录
    - 查询接口（供 StatService 使用）

    使用示例::

        repo = DbRepository(db_config)
        repo.initialize()
        repo.save_batches(valid_batches)
    """

    def __init__(self, db_config: DatabaseConfig) -> None:
        self._config = db_config
        self._engine: Optional[Engine] = None

    def initialize(self) -> None:
        """连接数据库并创建所需表结构（幂等操作）。"""
        url = self._config.get_url()
        self._engine = create_engine(url, echo=False, pool_pre_ping=True)
        self._create_tables()
        logger.info("数据库初始化完成: %s", self._config.db_name)

    def save_batches(self, batches: List[Batch]) -> int:
        """批量写入合法 Batch 记录，返回成功写入数量。

        使用 INSERT IGNORE 避免重复插入（批号为唯一键）。
        """
        if not batches:
            return 0
        if self._engine is None:
            raise RuntimeError("请先调用 initialize() 初始化数据库连接")

        saved = 0
        with self._engine.begin() as conn:
            for batch in batches:
                self._upsert_material(conn, batch.material_no)
                self._insert_batch(conn, batch)
                saved += 1

        logger.info("成功写入批次数: %d", saved)
        return saved

    def fetch_batches_by_material(self, material_no: str) -> list:
        """查询指定物料品号的所有批次及工艺参数。"""
        if self._engine is None:
            raise RuntimeError("请先调用 initialize() 初始化数据库连接")
        sql = text("""
            SELECT b.batch_no, b.material_no,
                   p.cable_core_od, p.sheath_od,
                   p.extrusion_inner, p.extrusion_outer,
                   p.screw_speed, p.screw_current,
                   p.prod_speed, p.actual_prod_speed,
                   p.source_file
            FROM batch b
            JOIN process_param p ON p.batch_no = b.batch_no
            WHERE b.material_no = :material_no
        """)
        with self._engine.connect() as conn:
            result = conn.execute(sql, {"material_no": material_no})
            return [dict(row._mapping) for row in result]

    def fetch_all_material_nos(self) -> List[str]:
        """查询库中全部物料品号。"""
        if self._engine is None:
            raise RuntimeError("请先调用 initialize() 初始化数据库连接")
        with self._engine.connect() as conn:
            rows = conn.execute(text("SELECT material_no FROM material ORDER BY material_no"))
            return [row[0] for row in rows]

    # ------------------------------------------------------------------ #
    # 建表 DDL（与 sql/schema.sql 保持一致）
    # ------------------------------------------------------------------ #

    def _create_tables(self) -> None:
        ddl_statements = [
            """
            CREATE TABLE IF NOT EXISTS material (
                material_no   VARCHAR(64)  NOT NULL COMMENT '物料品号',
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (material_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物料品号主表';
            """,
            """
            CREATE TABLE IF NOT EXISTS batch (
                batch_no      VARCHAR(64)  NOT NULL COMMENT '批号',
                material_no   VARCHAR(64)  NOT NULL COMMENT '物料品号',
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (batch_no),
                INDEX idx_material_no (material_no),
                CONSTRAINT fk_batch_material
                    FOREIGN KEY (material_no)
                    REFERENCES material(material_no)
                    ON DELETE RESTRICT ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产批次表';
            """,
            """
            CREATE TABLE IF NOT EXISTS process_param (
                id                BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
                batch_no          VARCHAR(64)  NOT NULL COMMENT '批号（关联 batch 表）',
                cable_core_od     DECIMAL(10,4) COMMENT '缆芯外径 (mm)',
                sheath_od         DECIMAL(10,4) COMMENT '护套外径 (mm)',
                extrusion_inner   DECIMAL(10,4) COMMENT '挤出内模 (mm)',
                extrusion_outer   DECIMAL(10,4) COMMENT '挤出外模 (mm)',
                screw_speed       DECIMAL(10,4) COMMENT '螺杆速度 (rpm)',
                screw_current     DECIMAL(10,4) COMMENT '螺杆电流 (A)',
                prod_speed        DECIMAL(10,4) COMMENT '生产速度 (m/min)',
                actual_prod_speed DECIMAL(10,4) COMMENT '实际生产速度 (m/min)',
                source_file       VARCHAR(256)  COMMENT '来源文件名',
                created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_batch_no (batch_no),
                CONSTRAINT fk_param_batch
                    FOREIGN KEY (batch_no)
                    REFERENCES batch(batch_no)
                    ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工艺参数向量表';
            """,
            """
            CREATE TABLE IF NOT EXISTS invalid_batch_log (
                id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
                batch_no      VARCHAR(64)  COMMENT '批号',
                material_no   VARCHAR(64)  COMMENT '物料品号',
                source_file   VARCHAR(256) COMMENT '来源文件',
                reason        TEXT         COMMENT '不合法原因',
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异常批次日志表';
            """,
        ]
        with self._engine.begin() as conn:
            for ddl in ddl_statements:
                conn.execute(text(ddl))

    def _upsert_material(self, conn, material_no: str) -> None:
        conn.execute(
            text("INSERT IGNORE INTO material (material_no) VALUES (:material_no)"),
            {"material_no": material_no},
        )

    def _insert_batch(self, conn, batch: Batch) -> None:
        conn.execute(
            text("""
                INSERT IGNORE INTO batch (batch_no, material_no)
                VALUES (:batch_no, :material_no)
            """),
            {"batch_no": batch.batch_no, "material_no": batch.material_no},
        )
        p = batch.process_param
        conn.execute(
            text("""
                INSERT IGNORE INTO process_param
                    (batch_no, cable_core_od, sheath_od,
                     extrusion_inner, extrusion_outer,
                     screw_speed, screw_current,
                     prod_speed, actual_prod_speed, source_file)
                VALUES
                    (:batch_no, :cable_core_od, :sheath_od,
                     :extrusion_inner, :extrusion_outer,
                     :screw_speed, :screw_current,
                     :prod_speed, :actual_prod_speed, :source_file)
            """),
            {
                "batch_no": batch.batch_no,
                "cable_core_od": p.cable_core_od,
                "sheath_od": p.sheath_od,
                "extrusion_inner": p.extrusion_inner,
                "extrusion_outer": p.extrusion_outer,
                "screw_speed": p.screw_speed,
                "screw_current": p.screw_current,
                "prod_speed": p.prod_speed,
                "actual_prod_speed": p.actual_prod_speed,
                "source_file": p.source_file,
            },
        )

    def save_invalid_batches(self, batches: List[Batch]) -> None:
        """将无效批次写入日志表，便于后续人工核查。"""
        if not batches or self._engine is None:
            return
        with self._engine.begin() as conn:
            for batch in batches:
                source = batch.process_param.source_file if batch.process_param else ""
                reason = "; ".join(batch.invalid_reasons)
                conn.execute(
                    text("""
                        INSERT INTO invalid_batch_log
                            (batch_no, material_no, source_file, reason)
                        VALUES
                            (:batch_no, :material_no, :source_file, :reason)
                    """),
                    {
                        "batch_no": batch.batch_no,
                        "material_no": batch.material_no,
                        "source_file": source,
                        "reason": reason,
                    },
                )
