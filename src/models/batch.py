"""批次实体模型。

一个批号（Batch）属于一个物料品号（Material），
并包含一组 8 个工艺参数（ProcessParam）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .process_param import ProcessParam


@dataclass
class Batch:
    """代表一次生产批次。

    属性:
        batch_no:     批号，唯一标识，如 "HT-2024-001"
        material_no:  所属物料品号
        process_param: 该批次的 8 个工艺参数
        is_valid:     是否通过校验（默认 True，清洗后可能变为 False）
        invalid_reasons: 不合法的原因列表
    """
    batch_no: str
    material_no: str
    process_param: Optional[ProcessParam] = None
    is_valid: bool = True
    invalid_reasons: list = field(default_factory=list)

    def mark_invalid(self, reasons: list) -> None:
        """将该批次标记为无效，并记录原因。"""
        self.is_valid = False
        self.invalid_reasons.extend(reasons)

    def __repr__(self) -> str:
        return (
            f"Batch(batch_no={self.batch_no!r}, "
            f"material_no={self.material_no!r}, "
            f"valid={self.is_valid})"
        )
