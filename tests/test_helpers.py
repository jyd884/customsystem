"""测试工具：生成 Excel 测试文件的辅助函数。"""
from __future__ import annotations

import os
import tempfile
from typing import Dict, List, Optional, Tuple

import openpyxl


def build_excel_file(
    rows: List[Tuple],
    header: Tuple,
    sheet_name: str = "Sheet1",
) -> str:
    """在临时目录创建一个带表头的 Excel 文件，返回文件路径。"""
    tmp_dir = tempfile.mkdtemp()
    path = os.path.join(tmp_dir, "test.xlsx")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_name
    ws.append(header)
    for row in rows:
        ws.append(row)
    wb.save(path)
    return path


def make_standard_header() -> Tuple:
    """返回标准表头行（与 ExcelReader 支持的候选列名一致）。"""
    return ("批号", "物料品号", "项目名称", "参数值")


def make_batch_rows(
    batch_no: str,
    material_no: str,
    params: Dict[str, Optional[float]],
    include_batch_no_only_first: bool = False,
) -> List[Tuple]:
    """
    为一个批次生成多行数据（每个参数一行）。

    Args:
        batch_no: 批号
        material_no: 物料品号
        params: {参数名: 数值}
        include_batch_no_only_first: 若为 True，仅第一行含批号/品号（模拟合并单元格）
    """
    rows = []
    for i, (name, value) in enumerate(params.items()):
        if i == 0 or not include_batch_no_only_first:
            rows.append((batch_no, material_no, name, value))
        else:
            rows.append((None, None, name, value))
    return rows


ALL_8_PARAMS = {
    "缆芯外径":    10.5,
    "护套外径":    14.0,
    "挤出内模":    9.0,
    "挤出外模":    13.0,
    "螺杆速度":    120.0,
    "螺杆电流":    45.0,
    "生产速度":    60.0,
    "实际生产速度": 58.5,
}
