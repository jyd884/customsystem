"""端到端集成测试（不需要真实 MySQL）。

通过内存中的 SQLite 替代 MySQL 验证完整流水线：
ExcelReader → DataCleaner → DbRepository (SQLite)

关键验证点：
1. 端到端不遗漏：Excel 中的批次全部最终入库（合法的）
2. 端到端不错误：入库后查询出的数值与原始值一致
3. 无效批次不入库
"""
import os
import tempfile
import pytest

import openpyxl

from src.models.batch import Batch
from src.models.process_param import ProcessParam
from src.readers.excel_reader import ExcelReader
from src.cleaners.data_cleaner import DataCleaner
from src.repositories.db_repository import DbRepository
from src.config.config import DatabaseConfig
from tests.test_helpers import (
    build_excel_file,
    make_standard_header,
    make_batch_rows,
    ALL_8_PARAMS,
)


# --------------------------------------------------------------------------- #
# SQLite 替换 MySQL 的 DbRepository 子类
# --------------------------------------------------------------------------- #

class SqliteDbRepository(DbRepository):
    """使用 SQLite 内存数据库替换 MySQL，用于集成测试（无需真实 DB 环境）。"""

    def __init__(self):
        from sqlalchemy import create_engine, text
        from sqlalchemy.engine import Engine
        self._engine = create_engine("sqlite:///:memory:", echo=False)
        self._config = None
        # SQLite 不支持 ON UPDATE CASCADE 等 MySQL 专有语法，简化建表
        self._create_sqlite_tables()

    def _create_sqlite_tables(self):
        from sqlalchemy import text
        ddl = [
            """
            CREATE TABLE IF NOT EXISTS material (
                material_no TEXT NOT NULL PRIMARY KEY,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS batch (
                batch_no    TEXT NOT NULL PRIMARY KEY,
                material_no TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS process_param (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no          TEXT NOT NULL UNIQUE,
                cable_core_od     REAL,
                sheath_od         REAL,
                extrusion_inner   REAL,
                extrusion_outer   REAL,
                screw_speed       REAL,
                screw_current     REAL,
                prod_speed        REAL,
                actual_prod_speed REAL,
                source_file       TEXT,
                created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS invalid_batch_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_no    TEXT,
                material_no TEXT,
                source_file TEXT,
                reason      TEXT,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """,
        ]
        with self._engine.begin() as conn:
            for stmt in ddl:
                conn.execute(text(stmt))

    def initialize(self):
        pass  # 已在构造函数中初始化

    def _upsert_material(self, conn, material_no: str) -> None:
        from sqlalchemy import text
        conn.execute(
            text("INSERT OR IGNORE INTO material (material_no) VALUES (:material_no)"),
            {"material_no": material_no},
        )

    def _insert_batch(self, conn, batch) -> None:
        from sqlalchemy import text
        conn.execute(
            text("""
                INSERT OR IGNORE INTO batch (batch_no, material_no)
                VALUES (:batch_no, :material_no)
            """),
            {"batch_no": batch.batch_no, "material_no": batch.material_no},
        )
        p = batch.process_param
        conn.execute(
            text("""
                INSERT OR IGNORE INTO process_param
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

    def save_invalid_batches(self, batches) -> None:
        from sqlalchemy import text
        if not batches:
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


# --------------------------------------------------------------------------- #
# 集成测试
# --------------------------------------------------------------------------- #

class TestEndToEndPipeline:
    def _run_pipeline(self, excel_path):
        """执行 Reader → Cleaner → Repo 完整流水线，返回 repo 实例。"""
        reader = ExcelReader(os.path.dirname(excel_path), os.path.basename(excel_path))
        raw = reader.read_file(excel_path)
        cleaner = DataCleaner()
        valid, invalid = cleaner.clean(raw)
        repo = SqliteDbRepository()
        repo.save_batches(valid)
        repo.save_invalid_batches(invalid)
        return repo, valid, invalid

    def test_valid_batch_persisted_not_missing(self):
        """不遗漏：合法批次入库后能查询到。"""
        path = build_excel_file(
            make_batch_rows("B001", "M001", ALL_8_PARAMS),
            make_standard_header(),
        )
        repo, valid, _ = self._run_pipeline(path)
        rows = repo.fetch_batches_by_material("M001")
        assert len(rows) == 1
        assert rows[0]["batch_no"] == "B001"

    def test_valid_batch_values_not_wrong(self):
        """不错误：入库后查询出的 8 个参数值与原始值完全一致。"""
        path = build_excel_file(
            make_batch_rows("B001", "M001", ALL_8_PARAMS),
            make_standard_header(),
        )
        repo, _, _ = self._run_pipeline(path)
        row = repo.fetch_batches_by_material("M001")[0]
        assert row["cable_core_od"] == ALL_8_PARAMS["缆芯外径"]
        assert row["sheath_od"] == ALL_8_PARAMS["护套外径"]
        assert row["extrusion_inner"] == ALL_8_PARAMS["挤出内模"]
        assert row["extrusion_outer"] == ALL_8_PARAMS["挤出外模"]
        assert row["screw_speed"] == ALL_8_PARAMS["螺杆速度"]
        assert row["screw_current"] == ALL_8_PARAMS["螺杆电流"]
        assert row["prod_speed"] == ALL_8_PARAMS["生产速度"]
        assert row["actual_prod_speed"] == ALL_8_PARAMS["实际生产速度"]

    def test_invalid_batch_not_persisted_to_main_tables(self):
        """无效批次（参数缺失）不进入 batch/process_param 表。"""
        header = make_standard_header()
        rows = make_batch_rows("B001", "M001", {"缆芯外径": 10.5})  # 只有 1 个参数
        path = build_excel_file(rows, header)
        repo, valid, invalid = self._run_pipeline(path)
        assert len(valid) == 0
        assert len(invalid) == 1
        result = repo.fetch_batches_by_material("M001")
        assert result == []

    def test_multiple_batches_all_persisted(self):
        """多批次不遗漏：每个合法批次都入库。"""
        header = make_standard_header()
        params1 = {**ALL_8_PARAMS, "缆芯外径": 10.0}
        params2 = {**ALL_8_PARAMS, "缆芯外径": 11.0}
        rows = make_batch_rows("B001", "M001", params1) + make_batch_rows("B002", "M001", params2)
        path = build_excel_file(rows, header)
        repo, valid, _ = self._run_pipeline(path)
        result = repo.fetch_batches_by_material("M001")
        assert len(result) == 2
        batch_nos = {r["batch_no"] for r in result}
        assert "B001" in batch_nos
        assert "B002" in batch_nos

    def test_multiple_batches_values_not_cross_contaminated(self):
        """多批次各自参数值不串批。"""
        header = make_standard_header()
        params1 = {**ALL_8_PARAMS, "缆芯外径": 10.0}
        params2 = {**ALL_8_PARAMS, "缆芯外径": 11.0}
        rows = make_batch_rows("B001", "M001", params1) + make_batch_rows("B002", "M001", params2)
        path = build_excel_file(rows, header)
        repo, _, _ = self._run_pipeline(path)
        result = {r["batch_no"]: r for r in repo.fetch_batches_by_material("M001")}
        assert result["B001"]["cable_core_od"] == 10.0
        assert result["B002"]["cable_core_od"] == 11.0

    def test_mixed_valid_invalid_only_valid_persisted(self):
        """合法+无效混合：只有合法批次入库。"""
        header = make_standard_header()
        good_rows = make_batch_rows("B001", "M001", ALL_8_PARAMS)
        bad_rows = make_batch_rows("B002", "M001", {"缆芯外径": 10.5})  # 缺失 7 个参数
        path = build_excel_file(good_rows + bad_rows, header)
        repo, valid, invalid = self._run_pipeline(path)
        assert len(valid) == 1
        assert len(invalid) == 1
        result = repo.fetch_batches_by_material("M001")
        assert len(result) == 1
        assert result[0]["batch_no"] == "B001"

    def test_fetch_all_material_nos(self):
        """fetch_all_material_nos 能返回所有物料品号。"""
        header = make_standard_header()
        rows = (
            make_batch_rows("B001", "M001", ALL_8_PARAMS) +
            make_batch_rows("B002", "M002", ALL_8_PARAMS)
        )
        path = build_excel_file(rows, header)
        repo, _, _ = self._run_pipeline(path)
        mat_nos = repo.fetch_all_material_nos()
        assert "M001" in mat_nos
        assert "M002" in mat_nos
