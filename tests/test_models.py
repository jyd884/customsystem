"""ProcessParam 模型单元测试。

验证：
- from_dict 正确构造
- is_complete 检测缺失参数
- is_valid 业务规则校验
- to_dict 往返一致性
"""
import pytest
from src.models.process_param import ProcessParam, PARAM_NAMES


class TestProcessParamFromDict:
    def test_full_params_constructed_correctly(self):
        data = {
            "缆芯外径":    10.5,
            "护套外径":    14.0,
            "挤出内模":     9.0,
            "挤出外模":    13.0,
            "螺杆速度":   120.0,
            "螺杆电流":    45.0,
            "生产速度":    60.0,
            "实际生产速度": 58.5,
        }
        p = ProcessParam.from_dict(data)
        assert p.cable_core_od == 10.5
        assert p.sheath_od == 14.0
        assert p.extrusion_inner == 9.0
        assert p.extrusion_outer == 13.0
        assert p.screw_speed == 120.0
        assert p.screw_current == 45.0
        assert p.prod_speed == 60.0
        assert p.actual_prod_speed == 58.5

    def test_partial_params_leaves_missing_as_none(self):
        p = ProcessParam.from_dict({"缆芯外径": 10.5, "护套外径": 14.0})
        assert p.cable_core_od == 10.5
        assert p.sheath_od == 14.0
        assert p.extrusion_inner is None

    def test_empty_dict_all_none(self):
        p = ProcessParam.from_dict({})
        for field_name in ProcessParam._NAME_TO_FIELD.values():
            assert getattr(p, field_name) is None

    def test_source_file_propagated(self):
        p = ProcessParam.from_dict({}, source_file="2024-01.xlsx")
        assert p.source_file == "2024-01.xlsx"

    def test_param_names_constant_has_8_items(self):
        assert len(PARAM_NAMES) == 8

    def test_name_to_field_has_8_entries(self):
        assert len(ProcessParam._NAME_TO_FIELD) == 8


class TestProcessParamIsComplete:
    def _full_data(self):
        return {
            "缆芯外径": 10.5, "护套外径": 14.0,
            "挤出内模": 9.0, "挤出外模": 13.0,
            "螺杆速度": 120.0, "螺杆电流": 45.0,
            "生产速度": 60.0, "实际生产速度": 58.5,
        }

    def test_complete_when_all_8_present(self):
        p = ProcessParam.from_dict(self._full_data())
        assert p.is_complete() is True

    def test_not_complete_when_one_missing(self):
        data = self._full_data()
        del data["螺杆速度"]
        p = ProcessParam.from_dict(data)
        assert p.is_complete() is False

    def test_missing_fields_returns_correct_names(self):
        data = self._full_data()
        del data["螺杆速度"]
        del data["螺杆电流"]
        p = ProcessParam.from_dict(data)
        missing = p.missing_fields()
        assert "螺杆速度" in missing
        assert "螺杆电流" in missing
        assert len(missing) == 2

    def test_not_complete_when_all_missing(self):
        p = ProcessParam.from_dict({})
        assert p.is_complete() is False
        assert len(p.missing_fields()) == 8


class TestProcessParamIsValid:
    def _valid_data(self):
        return {
            "缆芯外径": 10.5, "护套外径": 14.0,
            "挤出内模": 9.0, "挤出外模": 13.0,
            "螺杆速度": 120.0, "螺杆电流": 45.0,
            "生产速度": 60.0, "实际生产速度": 58.5,
        }

    def test_valid_params_pass(self):
        p = ProcessParam.from_dict(self._valid_data())
        ok, errors = p.is_valid()
        assert ok is True
        assert errors == []

    def test_negative_cable_core_od_fails(self):
        data = self._valid_data()
        data["缆芯外径"] = -1.0
        p = ProcessParam.from_dict(data)
        ok, errors = p.is_valid()
        assert ok is False
        assert any("缆芯外径" in e for e in errors)

    def test_extrusion_outer_less_than_inner_fails(self):
        data = self._valid_data()
        data["挤出外模"] = 8.0   # < 挤出内模 9.0
        p = ProcessParam.from_dict(data)
        ok, errors = p.is_valid()
        assert ok is False
        assert any("挤出外模" in e for e in errors)

    def test_sheath_less_than_cable_core_fails(self):
        data = self._valid_data()
        data["护套外径"] = 9.0   # < 缆芯外径 10.5
        p = ProcessParam.from_dict(data)
        ok, errors = p.is_valid()
        assert ok is False
        assert any("护套外径" in e for e in errors)

    def test_zero_values_allowed(self):
        data = self._valid_data()
        data["螺杆速度"] = 0.0
        data["螺杆电流"] = 0.0
        p = ProcessParam.from_dict(data)
        ok, errors = p.is_valid()
        assert ok is True

    def test_multiple_violations_reported(self):
        data = self._valid_data()
        data["缆芯外径"] = -1.0
        data["挤出外模"] = 5.0  # < 挤出内模 9.0
        p = ProcessParam.from_dict(data)
        ok, errors = p.is_valid()
        assert ok is False
        assert len(errors) >= 2


class TestProcessParamToDict:
    def test_roundtrip(self):
        data = {
            "缆芯外径": 10.5, "护套外径": 14.0,
            "挤出内模": 9.0, "挤出外模": 13.0,
            "螺杆速度": 120.0, "螺杆电流": 45.0,
            "生产速度": 60.0, "实际生产速度": 58.5,
        }
        p = ProcessParam.from_dict(data)
        result = p.to_dict()
        assert result == data

    def test_to_dict_has_8_keys(self):
        p = ProcessParam.from_dict({})
        assert len(p.to_dict()) == 8
