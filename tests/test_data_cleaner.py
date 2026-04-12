"""DataCleaner 单元测试。

验证：
- 完整参数的合法批次通过清洗
- 缺失参数被标记为无效
- 非法数值被标记为无效
- 重复批号被检测
- 合法和不合法批次分类正确
"""
import pytest

from src.models.batch import Batch
from src.models.process_param import ProcessParam
from src.cleaners.data_cleaner import DataCleaner


def _make_batch(batch_no="B001", material_no="M001", **param_overrides):
    """创建一个带完整参数的合法 Batch，支持按参数名覆盖。"""
    data = {
        "缆芯外径": 10.5, "护套外径": 14.0,
        "挤出内模": 9.0,  "挤出外模": 13.0,
        "螺杆速度": 120.0, "螺杆电流": 45.0,
        "生产速度": 60.0, "实际生产速度": 58.5,
    }
    data.update(param_overrides)
    p = ProcessParam.from_dict(data)
    return Batch(batch_no=batch_no, material_no=material_no, process_param=p)


class TestDataCleanerValidBatch:
    def test_valid_batch_passes(self):
        cleaner = DataCleaner()
        batch = _make_batch()
        valid, invalid = cleaner.clean([batch])
        assert len(valid) == 1
        assert len(invalid) == 0

    def test_multiple_valid_batches_all_pass(self):
        cleaner = DataCleaner()
        batches = [_make_batch(f"B{i:03d}") for i in range(5)]
        valid, invalid = cleaner.clean(batches)
        assert len(valid) == 5
        assert len(invalid) == 0


class TestDataCleanerMissingParams:
    def test_missing_one_param_invalid(self):
        cleaner = DataCleaner()
        data = {
            "缆芯外径": 10.5, "护套外径": 14.0,
            "挤出内模": 9.0,  "挤出外模": 13.0,
            "螺杆速度": 120.0,
            # 螺杆电流、生产速度、实际生产速度 缺失
        }
        p = ProcessParam.from_dict(data)
        batch = Batch("B001", "M001", process_param=p)
        valid, invalid = cleaner.clean([batch])
        assert len(valid) == 0
        assert len(invalid) == 1
        assert not batch.is_valid

    def test_all_params_missing_invalid(self):
        cleaner = DataCleaner()
        p = ProcessParam.from_dict({})
        batch = Batch("B001", "M001", process_param=p)
        valid, invalid = cleaner.clean([batch])
        assert len(invalid) == 1

    def test_invalid_reason_mentions_missing_param(self):
        data = {"缆芯外径": 10.5}
        p = ProcessParam.from_dict(data)
        batch = Batch("B001", "M001", process_param=p)
        DataCleaner().clean([batch])
        assert len(batch.invalid_reasons) > 0
        reason_text = " ".join(batch.invalid_reasons)
        assert "缺失" in reason_text or "参数" in reason_text

    def test_no_process_param_invalid(self):
        batch = Batch("B001", "M001", process_param=None)
        DataCleaner().clean([batch])
        assert not batch.is_valid


class TestDataCleanerInvalidValues:
    def test_negative_value_invalid(self):
        cleaner = DataCleaner()
        batch = _make_batch(**{"缆芯外径": -1.0})
        valid, invalid = cleaner.clean([batch])
        assert len(invalid) == 1

    def test_extrusion_outer_less_than_inner_invalid(self):
        cleaner = DataCleaner()
        batch = _make_batch(**{"挤出外模": 8.0})  # < 挤出内模 9.0
        valid, invalid = cleaner.clean([batch])
        assert len(invalid) == 1

    def test_sheath_less_than_core_invalid(self):
        cleaner = DataCleaner()
        batch = _make_batch(**{"护套外径": 9.0})  # < 缆芯外径 10.5
        valid, invalid = cleaner.clean([batch])
        assert len(invalid) == 1


class TestDataCleanerDuplicateDetection:
    def test_duplicate_batch_no_second_marked_invalid(self):
        cleaner = DataCleaner()
        b1 = _make_batch("B001")
        b2 = _make_batch("B001")  # 重复批号
        valid, invalid = cleaner.clean([b1, b2])
        assert len(valid) == 1
        assert len(invalid) == 1

    def test_first_occurrence_remains_valid(self):
        cleaner = DataCleaner()
        b1 = _make_batch("B001")
        b2 = _make_batch("B001")
        cleaner.clean([b1, b2])
        assert b1.is_valid
        assert not b2.is_valid

    def test_duplicate_reason_recorded(self):
        cleaner = DataCleaner()
        b1 = _make_batch("B001")
        b2 = _make_batch("B001")
        cleaner.clean([b1, b2])
        assert any("重复" in r for r in b2.invalid_reasons)

    def test_three_duplicates_only_first_valid(self):
        cleaner = DataCleaner()
        batches = [_make_batch("B001") for _ in range(3)]
        valid, invalid = cleaner.clean(batches)
        assert len(valid) == 1
        assert len(invalid) == 2

    def test_no_duplicate_all_valid(self):
        cleaner = DataCleaner()
        batches = [_make_batch(f"B{i:03d}") for i in range(3)]
        valid, invalid = cleaner.clean(batches)
        assert len(valid) == 3
        assert len(invalid) == 0


class TestDataCleanerMixedInput:
    def test_mixed_valid_and_invalid(self):
        cleaner = DataCleaner()
        good = _make_batch("B001")
        bad_missing = Batch("B002", "M001", process_param=ProcessParam.from_dict({}))
        bad_value = _make_batch("B003", **{"缆芯外径": -5.0})
        valid, invalid = cleaner.clean([good, bad_missing, bad_value])
        assert len(valid) == 1
        assert len(invalid) == 2
        assert valid[0].batch_no == "B001"
