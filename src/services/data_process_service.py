"""业务编排服务。

DataProcessService 是整个流水线的编排层，按顺序调用：
    ExcelReader → DataCleaner → DbRepository

不包含任何业务逻辑（业务逻辑分散在各自模块中），
只负责将各模块的输入输出串联起来。
"""
from __future__ import annotations

import logging
from typing import List, Tuple

from ..models.batch import Batch
from ..readers.excel_reader import ExcelReader
from ..cleaners.data_cleaner import DataCleaner
from ..repositories.db_repository import DbRepository
from ..config.config import AppConfig

logger = logging.getLogger(__name__)


class DataProcessService:
    """数据处理流水线编排服务。

    使用示例::

        config = AppConfig.from_yaml("config.yaml")
        service = DataProcessService(config)
        valid, invalid = service.run()
    """

    def __init__(self, config: AppConfig) -> None:
        self._config = config
        self._reader = ExcelReader(
            data_dir=config.excel.data_dir,
            file_pattern=config.excel.file_pattern,
        )
        self._cleaner = DataCleaner()
        self._repo = DbRepository(config.database)

    def run(self) -> Tuple[List[Batch], List[Batch]]:
        """执行完整的数据处理流水线。

        Returns:
            (valid_batches, invalid_batches)
        """
        logger.info("=== 数据处理流水线启动 ===")

        # 步骤 1: 读取
        raw_batches = self._reader.read_all()
        logger.info("读取原始批次: %d", len(raw_batches))

        # 步骤 2: 清洗
        valid_batches, invalid_batches = self._cleaner.clean(raw_batches)

        # 步骤 3: 持久化
        self._repo.initialize()
        self._repo.save_batches(valid_batches)
        self._repo.save_invalid_batches(invalid_batches)

        logger.info("=== 流水线完成：合法=%d, 异常=%d ===", len(valid_batches), len(invalid_batches))
        return valid_batches, invalid_batches

    @property
    def repository(self) -> DbRepository:
        """暴露 repository 供外部查询（如 StatService）。"""
        return self._repo
