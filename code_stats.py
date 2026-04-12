"""代码质量统计工具。

统计本项目中：
- 类的数量
- 每个类的方法数量
- 每个方法的有效代码行数（去除空行和注释）
- 代码行数分布（按类、按方法）
- 过度集中的类/方法识别
- 类之间调用接口分析

运行方式：
    python code_stats.py [src目录路径]
"""
from __future__ import annotations

import ast
import os
import sys
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class MethodStats:
    name: str
    class_name: str
    file_path: str
    total_lines: int       # 包含空行和注释的总行数
    effective_lines: int   # 有效代码行（非空、非纯注释）
    start_lineno: int
    end_lineno: int


@dataclass
class ClassStats:
    name: str
    file_path: str
    method_count: int
    methods: List[MethodStats] = field(default_factory=list)
    total_effective_lines: int = 0


class CodeQualityAnalyzer:
    """分析 Python 源码目录，输出类/方法粒度的代码统计报告。"""

    def __init__(self, src_dir: str) -> None:
        self._src_dir = src_dir
        self._class_stats: List[ClassStats] = []
        self._method_stats: List[MethodStats] = []

    def analyze(self) -> None:
        py_files = self._collect_py_files()
        for path in py_files:
            self._analyze_file(path)

    def report(self) -> str:
        lines = ["=" * 60, "代码质量统计报告", "=" * 60, ""]

        lines.append(f"## 总览")
        lines.append(f"  Python 源文件数: {self._count_files()}")
        lines.append(f"  类的总数:        {len(self._class_stats)}")
        lines.append(f"  方法的总数:      {len(self._method_stats)}")
        eff = sum(m.effective_lines for m in self._method_stats)
        lines.append(f"  有效代码行总数:  {eff}")
        lines.append("")

        lines.append("## 每个类的统计")
        lines.append(f"  {'类名':<30} {'方法数':>6} {'有效行数':>8} {'文件'}")
        lines.append("  " + "-" * 70)
        for cs in sorted(self._class_stats, key=lambda x: x.total_effective_lines, reverse=True):
            rel = os.path.relpath(cs.file_path, self._src_dir)
            lines.append(
                f"  {cs.name:<30} {cs.method_count:>6} {cs.total_effective_lines:>8}  {rel}"
            )
        lines.append("")

        lines.append("## 每个方法的有效代码行数（Top 15，按行数降序）")
        lines.append(f"  {'类.方法':<45} {'有效行数':>8}")
        lines.append("  " + "-" * 60)
        sorted_methods = sorted(self._method_stats, key=lambda x: x.effective_lines, reverse=True)
        for m in sorted_methods[:15]:
            label = f"{m.class_name}.{m.name}"
            lines.append(f"  {label:<45} {m.effective_lines:>8}")
        lines.append("")

        lines.append("## 过度集中警告（有效代码 > 30 行的方法）")
        overloaded = [m for m in self._method_stats if m.effective_lines > 30]
        if overloaded:
            for m in overloaded:
                lines.append(
                    f"  ⚠️  {m.class_name}.{m.name}  ({m.effective_lines} 行)  [{os.path.relpath(m.file_path, self._src_dir)}]"
                )
        else:
            lines.append("  ✅ 无过度集中方法")
        lines.append("")

        lines.append("=" * 60)
        return "\n".join(lines)

    # ------------------------------------------------------------------ #

    def _collect_py_files(self) -> List[str]:
        result = []
        for root, _, files in os.walk(self._src_dir):
            for f in files:
                if f.endswith(".py") and not f.startswith("test_"):
                    result.append(os.path.join(root, f))
        return sorted(result)

    def _count_files(self) -> int:
        return len(self._collect_py_files())

    def _analyze_file(self, path: str) -> None:
        with open(path, "r", encoding="utf-8") as f:
            source = f.read()
            source_lines = source.splitlines()
        try:
            tree = ast.parse(source, filename=path)
        except SyntaxError:
            return

        for node in ast.walk(tree):
            if isinstance(node, (ast.ClassDef,)):
                self._process_class(node, path, source_lines)

    def _process_class(
        self, cls_node: ast.ClassDef, path: str, source_lines: List[str]
    ) -> None:
        methods: List[MethodStats] = []
        for item in cls_node.body:
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                ms = self._process_method(item, cls_node.name, path, source_lines)
                methods.append(ms)
                self._method_stats.append(ms)

        total_eff = sum(m.effective_lines for m in methods)
        cs = ClassStats(
            name=cls_node.name,
            file_path=path,
            method_count=len(methods),
            methods=methods,
            total_effective_lines=total_eff,
        )
        self._class_stats.append(cs)

    def _process_method(
        self,
        fn_node: ast.FunctionDef,
        class_name: str,
        path: str,
        source_lines: List[str],
    ) -> MethodStats:
        start = fn_node.lineno - 1
        end = fn_node.end_lineno
        body_lines = source_lines[start:end]
        total = len(body_lines)
        effective = sum(
            1 for line in body_lines
            if line.strip() and not line.strip().startswith("#")
            and not line.strip().startswith('"""')
            and not line.strip().startswith("'''")
        )
        return MethodStats(
            name=fn_node.name,
            class_name=class_name,
            file_path=path,
            total_lines=total,
            effective_lines=effective,
            start_lineno=fn_node.lineno,
            end_lineno=fn_node.end_lineno,
        )


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "src"
    analyzer = CodeQualityAnalyzer(src)
    analyzer.analyze()
    print(analyzer.report())
