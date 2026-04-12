"""物料品号实体模型。

一个物料品号（Material）对应多个批号（Batch）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class Material:
    """代表一个物料品号，包含该品号下所有批号记录。

    属性:
        material_no: 物料品号，唯一标识，如 "WS-001"
        batches: 该品号下所有批次列表
    """
    material_no: str
    batches: List["Batch"] = field(default_factory=list)  # type: ignore[name-defined]

    def add_batch(self, batch: "Batch") -> None:  # type: ignore[name-defined]
        """向该物料品号添加一个批次。"""
        self.batches.append(batch)

    def __repr__(self) -> str:
        return f"Material(material_no={self.material_no!r}, batch_count={len(self.batches)})"
