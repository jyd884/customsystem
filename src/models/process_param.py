"""工艺参数向量实体。

封装 HT 工序记录中 8 个核心工艺参数，提供合法性自检方法。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


# 8 个工艺参数的标准中文名称（用于从 Excel 行中按名称匹配）
PARAM_NAMES = (
    "缆芯外径",   # mm
    "护套外径",   # mm
    "挤出内模",   # mm
    "挤出外模",   # mm
    "螺杆速度",   # rpm
    "螺杆电流",   # A
    "生产速度",   # m/min
    "实际生产速度",  # m/min
)


@dataclass
class ProcessParam:
    """存储一组 8 个工艺参数值。

    属性:
        cable_core_od:    缆芯外径 (mm)
        sheath_od:        护套外径 (mm)
        extrusion_inner:  挤出内模 (mm)
        extrusion_outer:  挤出外模 (mm)
        screw_speed:      螺杆速度 (rpm)
        screw_current:    螺杆电流 (A)
        prod_speed:       生产速度 (m/min)
        actual_prod_speed:实际生产速度 (m/min)
        source_file:      来源文件名（用于溯源）
    """
    cable_core_od: Optional[float]
    sheath_od: Optional[float]
    extrusion_inner: Optional[float]
    extrusion_outer: Optional[float]
    screw_speed: Optional[float]
    screw_current: Optional[float]
    prod_speed: Optional[float]
    actual_prod_speed: Optional[float]
    source_file: str = ""

    # 映射：中文参数名 → 字段名（供外部按名称赋值）
    _NAME_TO_FIELD = {
        "缆芯外径":   "cable_core_od",
        "护套外径":   "sheath_od",
        "挤出内模":   "extrusion_inner",
        "挤出外模":   "extrusion_outer",
        "螺杆速度":   "screw_speed",
        "螺杆电流":   "screw_current",
        "生产速度":   "prod_speed",
        "实际生产速度": "actual_prod_speed",
    }

    @classmethod
    def from_dict(cls, data: dict, source_file: str = "") -> "ProcessParam":
        """通过中文参数名字典构造实例。

        Args:
            data: {中文参数名: 数值} 的字典
            source_file: 来源文件名

        Returns:
            ProcessParam 实例
        """
        kwargs = {field: None for field in cls._NAME_TO_FIELD.values()}
        kwargs["source_file"] = source_file
        for cn_name, field_name in cls._NAME_TO_FIELD.items():
            if cn_name in data:
                kwargs[field_name] = data[cn_name]
        return cls(**kwargs)

    def is_complete(self) -> bool:
        """检查 8 个参数是否全部非空。"""
        return all(
            getattr(self, f) is not None
            for f in self._NAME_TO_FIELD.values()
        )

    def missing_fields(self) -> list:
        """返回仍为 None 的参数中文名列表。"""
        return [
            cn for cn, f in self._NAME_TO_FIELD.items()
            if getattr(self, f) is None
        ]

    def is_valid(self) -> tuple[bool, list]:
        """执行业务合法性校验。

        校验规则：
        - 所有尺寸、速度、电流 >= 0
        - 挤出外模 > 挤出内模
        - 护套外径 >= 缆芯外径

        Returns:
            (passed: bool, errors: list[str])
        """
        errors: list = []
        non_negative = {
            "缆芯外径": self.cable_core_od,
            "护套外径": self.sheath_od,
            "挤出内模": self.extrusion_inner,
            "挤出外模": self.extrusion_outer,
            "螺杆速度": self.screw_speed,
            "螺杆电流": self.screw_current,
            "生产速度": self.prod_speed,
            "实际生产速度": self.actual_prod_speed,
        }
        for name, val in non_negative.items():
            if val is not None and val < 0:
                errors.append(f"{name} 不能为负值: {val}")

        if self.extrusion_outer is not None and self.extrusion_inner is not None:
            if self.extrusion_outer <= self.extrusion_inner:
                errors.append(
                    f"挤出外模({self.extrusion_outer}) 必须大于 挤出内模({self.extrusion_inner})"
                )

        if self.sheath_od is not None and self.cable_core_od is not None:
            if self.sheath_od < self.cable_core_od:
                errors.append(
                    f"护套外径({self.sheath_od}) 必须 >= 缆芯外径({self.cable_core_od})"
                )

        return (len(errors) == 0, errors)

    def to_dict(self) -> dict:
        """将参数转为中文名→数值的字典。"""
        result = {}
        for cn_name, field_name in self._NAME_TO_FIELD.items():
            result[cn_name] = getattr(self, field_name)
        return result

    def __repr__(self) -> str:
        return (
            f"ProcessParam(缆芯外径={self.cable_core_od}, "
            f"护套外径={self.sheath_od}, "
            f"挤出内模={self.extrusion_inner}, "
            f"挤出外模={self.extrusion_outer}, "
            f"螺杆速度={self.screw_speed}, "
            f"螺杆电流={self.screw_current}, "
            f"生产速度={self.prod_speed}, "
            f"实际生产速度={self.actual_prod_speed})"
        )
