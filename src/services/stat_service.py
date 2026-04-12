"""统计报表服务。

StatService 从数据库查询数据，计算每个物料品号的工艺参数统计分布，
包括：参数向量种类、各参数的均值/方差/最大最小值、可扩展到聚类分析。

职责：只读查询 + 统计计算，不写数据库，不做清洗。
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..repositories.db_repository import DbRepository

logger = logging.getLogger(__name__)


class StatService:
    """工艺参数统计分析服务。

    使用示例::

        stat = StatService(repo)
        report = stat.material_param_report("WS-001")
        print(report)
    """

    # 参数字段名列表（与数据库列名一致）
    _PARAM_FIELDS = [
        "cable_core_od",
        "sheath_od",
        "extrusion_inner",
        "extrusion_outer",
        "screw_speed",
        "screw_current",
        "prod_speed",
        "actual_prod_speed",
    ]

    _PARAM_LABELS = {
        "cable_core_od":    "缆芯外径",
        "sheath_od":        "护套外径",
        "extrusion_inner":  "挤出内模",
        "extrusion_outer":  "挤出外模",
        "screw_speed":      "螺杆速度",
        "screw_current":    "螺杆电流",
        "prod_speed":       "生产速度",
        "actual_prod_speed": "实际生产速度",
    }

    def __init__(self, repository: DbRepository) -> None:
        self._repo = repository

    def material_param_report(self, material_no: str) -> Dict[str, Any]:
        """生成指定物料品号的工艺参数统计报表。

        Returns:
            {
                "material_no": str,
                "batch_count": int,
                "param_vector_types": int,   # 不同参数向量组合的种类数
                "param_stats": {             # 每个参数的统计信息
                    "缆芯外径": {"mean": ..., "std": ..., "min": ..., "max": ..., "count": ...},
                    ...
                }
            }
        """
        rows = self._repo.fetch_batches_by_material(material_no)
        if not rows:
            logger.warning("物料品号 %s 无数据", material_no)
            return {"material_no": material_no, "batch_count": 0}

        param_stats = self._compute_param_stats(rows)
        vector_types = self._count_vector_types(rows)

        return {
            "material_no": material_no,
            "batch_count": len(rows),
            "param_vector_types": vector_types,
            "param_stats": param_stats,
        }

    def all_materials_summary(self) -> List[Dict[str, Any]]:
        """对库中所有物料品号生成汇总报表列表。"""
        material_nos = self._repo.fetch_all_material_nos()
        return [self.material_param_report(m) for m in material_nos]

    # ------------------------------------------------------------------ #
    # 统计计算（纯 Python，无 pandas 依赖，便于在受限环境运行）
    # ------------------------------------------------------------------ #

    def _compute_param_stats(self, rows: List[dict]) -> Dict[str, Dict[str, Any]]:
        stats: Dict[str, Dict[str, Any]] = {}
        for field_name in self._PARAM_FIELDS:
            values = [r[field_name] for r in rows if r.get(field_name) is not None]
            label = self._PARAM_LABELS[field_name]
            if not values:
                stats[label] = {"count": 0, "mean": None, "std": None, "min": None, "max": None}
                continue
            n = len(values)
            mean = sum(values) / n
            variance = sum((v - mean) ** 2 for v in values) / (n - 1) if n > 1 else 0.0
            std = variance ** 0.5
            stats[label] = {
                "count": n,
                "mean": round(mean, 4),
                "std": round(std, 4),
                "min": min(values),
                "max": max(values),
            }
        return stats

    def _count_vector_types(self, rows: List[dict]) -> int:
        """统计不重复的工艺参数向量种类数。"""
        unique_vectors = set()
        for row in rows:
            vector = tuple(row.get(f) for f in self._PARAM_FIELDS)
            unique_vectors.add(vector)
        return len(unique_vectors)
