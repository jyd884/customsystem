"""程序主入口。

使用方式：
    python main.py [--config config.yaml]
"""
from __future__ import annotations

import argparse
import logging
import sys

from src.config.config import AppConfig
from src.services.data_process_service import DataProcessService
from src.services.stat_service import StatService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def main(config_path: str = "config.yaml") -> None:
    config = AppConfig.from_yaml(config_path)

    # 步骤 1-3：读取 + 清洗 + 持久化
    service = DataProcessService(config)
    valid_batches, invalid_batches = service.run()

    print(f"\n✅ 合法批次入库: {len(valid_batches)}")
    print(f"❌ 异常批次记录: {len(invalid_batches)}")

    if invalid_batches:
        print("\n--- 异常批次详情 ---")
        for b in invalid_batches[:10]:
            print(f"  批号={b.batch_no}, 品号={b.material_no}, 原因={b.invalid_reasons}")

    # 步骤 4：统计报表
    stat_service = StatService(service.repository)
    summary = stat_service.all_materials_summary()
    print(f"\n--- 物料品号统计汇总（共 {len(summary)} 个品号）---")
    for item in summary:
        print(f"  品号={item['material_no']}, "
              f"批次数={item.get('batch_count', 0)}, "
              f"参数向量种类={item.get('param_vector_types', 'N/A')}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HT 工序数据预处理系统")
    parser.add_argument("--config", default="config.yaml", help="配置文件路径")
    args = parser.parse_args()
    main(args.config)
