"""应用配置加载模块。

负责从 YAML 配置文件中读取数据库连接、Excel 目录等参数，
并以强类型数据类对外暴露，避免配置散落在各处导致维护困难。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Optional

import yaml


@dataclass(frozen=True)
class DatabaseConfig:
    host: str = "127.0.0.1"
    port: int = 3306
    user: str = "root"
    password: str = ""
    db_name: str = "ht_process_db"

    def get_url(self) -> str:
        """返回 SQLAlchemy 连接字符串。"""
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.db_name}?charset=utf8mb4"
        )


@dataclass(frozen=True)
class ExcelConfig:
    data_dir: str = "data"
    file_pattern: str = "HT_工序*.xlsx"


@dataclass(frozen=True)
class AppConfig:
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    excel: ExcelConfig = field(default_factory=ExcelConfig)

    @staticmethod
    def from_yaml(path: str) -> "AppConfig":
        """从 YAML 文件加载配置。"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"配置文件不存在: {path}")
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        db_cfg = DatabaseConfig(**raw.get("database", {}))
        excel_cfg = ExcelConfig(**raw.get("excel", {}))
        return AppConfig(database=db_cfg, excel=excel_cfg)

    @staticmethod
    def default() -> "AppConfig":
        """返回默认配置（用于测试）。"""
        return AppConfig()
