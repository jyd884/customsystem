"""数据清洗模块。

负责对从 Excel 读取的原始 Batch 列表进行：
1. 完整性校验（8 个参数是否全部存在）
2. 业务合法性校验（数值范围、字段间数学关系）
3. 重复批号检测
4. 将不合法记录标记（不入库）并记录原因
"""
from __future__ import annotations

import logging
from typing import Dict, List, Tuple

from ..models.batch import Batch

logger = logging.getLogger(__name__)


class DataCleaner:
    """对 Batch 列表执行完整性和合法性清洗。

    使用示例::

        cleaner = DataCleaner()
        valid_batches, invalid_batches = cleaner.clean(raw_batches)
    """

    def clean(self, batches: List[Batch]) -> Tuple[List[Batch], List[Batch]]:
        """对 Batch 列表进行清洗，返回 (合法批次, 不合法批次)。

        Args:
            batches: 从 ExcelReader 获得的原始批次列表

        Returns:
            (valid_batches, invalid_batches)
        """
        self._detect_duplicate_batch_nos(batches)
        for batch in batches:
            self._validate_batch(batch)

        valid = [b for b in batches if b.is_valid]
        invalid = [b for b in batches if not b.is_valid]
        logger.info("清洗结果: 合法=%d, 不合法=%d", len(valid), len(invalid))
        return valid, invalid

    # ------------------------------------------------------------------ #
    # 内部校验方法
    # ------------------------------------------------------------------ #

    def _detect_duplicate_batch_nos(self, batches: List[Batch]) -> None:
        """检测重复批号，将重复批次标记为无效。"""
        seen: Dict[str, Batch] = {}
        for batch in batches:
            if batch.batch_no in seen:
                batch.mark_invalid([f"批号 {batch.batch_no!r} 重复（与已有记录冲突）"])
                logger.warning("发现重复批号: %s", batch.batch_no)
            else:
                seen[batch.batch_no] = batch

    def _validate_batch(self, batch: Batch) -> None:
        """对单个 Batch 执行完整性 + 合法性校验。"""
        if not batch.is_valid:
            return  # 已被重复检测标记为无效

        if batch.process_param is None:
            batch.mark_invalid(["process_param 为空"])
            return

        # 完整性校验
        if not batch.process_param.is_complete():
            missing = batch.process_param.missing_fields()
            batch.mark_invalid([f"参数缺失: {missing}"])
            logger.warning("批号 %s 缺少参数: %s", batch.batch_no, missing)
            return

        # 合法性校验
        passed, errors = batch.process_param.is_valid()
        if not passed:
            batch.mark_invalid(errors)
            logger.warning("批号 %s 参数不合法: %s", batch.batch_no, errors)
