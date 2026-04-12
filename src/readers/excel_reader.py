"""Excel 读取模块。

负责读取 HT_工序记录 Excel 文件，按批号收集 8 个工艺参数，
返回 Batch 对象列表。不做业务校验（校验由 DataCleaner 负责）。

HT_工序记录 Excel 的典型结构（每月一个文件）：
    每个工作表（Sheet）或连续行块代表若干批次的数据。
    同一批号的 8 个参数可能分布在非连续行（按"项目名称"列匹配）。
    关键列：批号列、物料品号列、项目名称列、参数值列。
"""
from __future__ import annotations

import glob
import logging
import os
from typing import Dict, List, Optional, Tuple

import openpyxl
from openpyxl.worksheet.worksheet import Worksheet

from ..models.batch import Batch
from ..models.process_param import ProcessParam, PARAM_NAMES

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# 列名常量：匹配 Excel 表头时的候选名称列表（兼容不同月份表头略有差异的情况）
# --------------------------------------------------------------------------- #
_BATCH_NO_CANDIDATES = ("批号", "批次号", "生产批号", "Batch No")
_MATERIAL_NO_CANDIDATES = ("物料品号", "物料编号", "品号", "Material No")
_PARAM_NAME_CANDIDATES = ("项目名称", "工艺参数", "参数名称", "Parameter")
_PARAM_VALUE_CANDIDATES = ("参数值", "数值", "Value", "值")


class ExcelReader:
    """读取指定目录下所有 HT_工序记录 Excel 文件。

    职责单一：只负责文件 I/O 和原始数据提取，不做任何业务逻辑。

    使用示例::

        reader = ExcelReader(data_dir="data", file_pattern="HT_工序*.xlsx")
        batches = reader.read_all()
    """

    def __init__(self, data_dir: str, file_pattern: str = "HT_工序*.xlsx") -> None:
        self._data_dir = data_dir
        self._file_pattern = file_pattern

    # ------------------------------------------------------------------ #
    # 公共接口
    # ------------------------------------------------------------------ #

    def read_all(self) -> List[Batch]:
        """读取目录下所有匹配文件，返回所有批次列表。"""
        file_paths = self._discover_files()
        if not file_paths:
            logger.warning("未找到任何匹配文件: %s/%s", self._data_dir, self._file_pattern)
            return []

        all_batches: List[Batch] = []
        for path in file_paths:
            logger.info("读取文件: %s", path)
            batches = self.read_file(path)
            all_batches.extend(batches)
            logger.info("  解析批次数: %d", len(batches))

        logger.info("共解析批次数: %d（来自 %d 个文件）", len(all_batches), len(file_paths))
        return all_batches

    def read_file(self, file_path: str) -> List[Batch]:
        """解析单个 Excel 文件，返回该文件中所有批次。"""
        file_name = os.path.basename(file_path)
        try:
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        except Exception as exc:
            logger.error("无法打开文件 %s: %s", file_path, exc)
            return []

        all_batches: List[Batch] = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            batches = self._parse_sheet(ws, file_name)
            all_batches.extend(batches)

        wb.close()
        return all_batches

    # ------------------------------------------------------------------ #
    # 内部解析逻辑
    # ------------------------------------------------------------------ #

    def _discover_files(self) -> List[str]:
        """返回目录下所有匹配文件的完整路径列表。"""
        pattern = os.path.join(self._data_dir, self._file_pattern)
        return sorted(glob.glob(pattern))

    def _parse_sheet(self, ws: Worksheet, file_name: str) -> List[Batch]:
        """解析一个工作表，返回该表中所有批次。

        策略：
        1. 读取表头，定位各关键列的列索引。
        2. 逐行扫描，按批号将参数行归组。
        3. 每个批号对应一个 dict {参数名: 值}，满 8 个参数后构造 ProcessParam。
        """
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        header_idx, col_map = self._find_header(rows)
        if header_idx is None:
            logger.warning("工作表未找到有效表头，跳过")
            return []

        return self._extract_batches(rows, header_idx + 1, col_map, file_name)

    def _find_header(
        self, rows: list
    ) -> Tuple[Optional[int], Dict[str, int]]:
        """在前 10 行中寻找包含关键列名的表头行。

        Returns:
            (header_row_index, col_map)
            col_map keys: "batch_no", "material_no", "param_name", "param_value"
        """
        for idx, row in enumerate(rows[:10]):
            col_map = self._match_columns(row)
            if col_map:
                return idx, col_map
        return None, {}

    def _match_columns(self, row: tuple) -> Dict[str, int]:
        """将一行表头映射到关键列索引。"""
        col_map: Dict[str, int] = {}
        for col_idx, cell_val in enumerate(row):
            if cell_val is None:
                continue
            cell_str = str(cell_val).strip()
            if cell_str in _BATCH_NO_CANDIDATES and "batch_no" not in col_map:
                col_map["batch_no"] = col_idx
            if cell_str in _MATERIAL_NO_CANDIDATES and "material_no" not in col_map:
                col_map["material_no"] = col_idx
            if cell_str in _PARAM_NAME_CANDIDATES and "param_name" not in col_map:
                col_map["param_name"] = col_idx
            if cell_str in _PARAM_VALUE_CANDIDATES and "param_value" not in col_map:
                col_map["param_value"] = col_idx

        # 至少需要批号列和参数名列才算有效表头
        if "batch_no" in col_map and "param_name" in col_map:
            return col_map
        return {}

    def _extract_batches(
        self,
        rows: list,
        data_start: int,
        col_map: Dict[str, int],
        file_name: str,
    ) -> List[Batch]:
        """从数据行中按批号聚合参数，构造 Batch 列表。

        同一批号的参数可能跨越多行（非连续字段），通过批号索引聚合。
        """
        # {batch_no: {"material_no": str, "params": {param_name: value}}}
        batch_registry: Dict[str, dict] = {}
        # 保持批号首次出现的顺序
        batch_order: List[str] = []

        current_batch_no: Optional[str] = None
        current_material_no: Optional[str] = None

        for row in rows[data_start:]:
            batch_no = self._get_cell(row, col_map, "batch_no")
            material_no = self._get_cell(row, col_map, "material_no")
            param_name = self._get_cell(row, col_map, "param_name")
            param_value_raw = self._get_cell(row, col_map, "param_value")

            # 更新当前批号（空白行继承上一行的批号，常见于合并单元格）
            if batch_no:
                current_batch_no = str(batch_no).strip()
            if material_no:
                current_material_no = str(material_no).strip()

            if not current_batch_no or not param_name:
                continue

            # 只收集 8 个标准工艺参数
            if param_name not in PARAM_NAMES:
                continue

            if current_batch_no not in batch_registry:
                batch_registry[current_batch_no] = {
                    "material_no": current_material_no or "",
                    "params": {},
                }
                batch_order.append(current_batch_no)
            elif current_material_no:
                # 覆盖更新 material_no（以最新出现为准）
                batch_registry[current_batch_no]["material_no"] = current_material_no

            param_value = self._parse_float(param_value_raw)
            batch_registry[current_batch_no]["params"][param_name] = param_value

        return self._build_batches(batch_registry, batch_order, file_name)

    def _build_batches(
        self,
        registry: Dict[str, dict],
        order: List[str],
        file_name: str,
    ) -> List[Batch]:
        """将聚合字典转换为 Batch 对象列表。"""
        batches: List[Batch] = []
        for batch_no in order:
            entry = registry[batch_no]
            process_param = ProcessParam.from_dict(entry["params"], source_file=file_name)
            batch = Batch(
                batch_no=batch_no,
                material_no=entry["material_no"],
                process_param=process_param,
            )
            batches.append(batch)
        return batches

    @staticmethod
    def _get_cell(row: tuple, col_map: Dict[str, int], key: str):
        """安全取列值，列不存在时返回 None。"""
        idx = col_map.get(key)
        if idx is None or idx >= len(row):
            return None
        val = row[idx]
        if val is None:
            return None
        stripped = str(val).strip()
        return stripped if stripped else None

    @staticmethod
    def _parse_float(raw) -> Optional[float]:
        """将原始单元格值解析为 float；无法解析时返回 None。"""
        if raw is None:
            return None
        try:
            return float(str(raw).strip().replace(",", ""))
        except (ValueError, TypeError):
            return None
