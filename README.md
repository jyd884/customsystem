# HT 工序数据预处理系统 — 作业解答报告

> **使用的 AI 工具**：GitHub Copilot（编写代码框架及测试用例）、豆包（工艺参数领域知识查询）。  
> **提示指令示例**：  
> - 豆包：「帮我分析 HT 工序 Excel 数据的 8 个工艺参数，给出单位和取值范围」  
> - Copilot：「设计一个按批号聚合工艺参数、支持合并单元格格式的 ExcelReader 类，要求单一职责」

---

## 第一部分：数据理解

### 1.1 8 个工艺参数的单位

| 工艺参数     | 英文字段名          | 单位    |
|------------|-------------------|---------|
| 缆芯外径    | cable_core_od     | mm      |
| 护套外径    | sheath_od         | mm      |
| 挤出内模    | extrusion_inner   | mm      |
| 挤出外模    | extrusion_outer   | mm      |
| 螺杆速度    | screw_speed       | rpm     |
| 螺杆电流    | screw_current     | A       |
| 生产速度    | prod_speed        | m/min   |
| 实际生产速度 | actual_prod_speed | m/min   |

### 1.2 缺失值处理方案

- 关键 8 项参数任意缺失 → 整条批次标记为**无效记录**，写入 `invalid_batch_log` 表，**不**写入 `batch`/`process_param` 表。  
- 同一批号参数分散在多行 → 按批号建立聚合字典，遍历全部行后补齐，再判断完整性。

### 1.3 非连续字段信息处理

Excel 中同一批次的参数往往分散在多行（类似合并单元格展开）。  
解决方法：在 `ExcelReader._extract_batches()` 中维护 `current_batch_no`，遍历时每行若批号列为空则**继承上一行批号**，并按参数名索引，将同批号所有行的参数收集到同一字典中，遍历完成后统一构造 `ProcessParam`。

### 1.4 字段数学关系与合法性规则

| 规则 | 表达式 | 说明 |
|------|--------|------|
| 差值一 | 护套外径 − 缆芯外径 ≥ 0 | 护套必须包裹缆芯 |
| 差值二 | 挤出外模 − 挤出内模 > 0 | 外模必须大于内模 |
| 非负约束 | 全部 8 个参数 ≥ 0 | 物理量不能为负 |

这些规则在 `ProcessParam.is_valid()` 中实现，数据库层同样通过 `CHECK` 约束双重保障。

### 1.5 ER 图

```
+----------------+          +----------------+          +----------------------+
|   material     |  1     N |     batch      |  1     1 |   process_param      |
|----------------|--------->|----------------|--------->|----------------------|
| PK material_no |          | PK batch_no    |          | PK id (AUTO)         |
|    created_at  |          | FK material_no |          | UK batch_no          |
|    updated_at  |          |    created_at  |          | FK batch_no          |
+----------------+          +----------------+          |    cable_core_od     |
                                                        |    sheath_od         |
                                                        |    extrusion_inner   |
                                                        |    extrusion_outer   |
                                                        |    screw_speed       |
                                                        |    screw_current     |
                                                        |    prod_speed        |
                                                        |    actual_prod_speed |
                                                        |    source_file       |
                                                        +----------------------+

+---------------------+
|  invalid_batch_log  |  （审计表，不参与主业务关系）
|---------------------|
| PK id (AUTO)        |
|    batch_no         |
|    material_no      |
|    source_file      |
|    reason           |
|    created_at       |
+---------------------+
```

**实体数量**：4 个（material、batch、process_param、invalid_batch_log）  
**实体关系**：  
- material : batch = **1 : N**（一个品号有多个批次）  
- batch : process_param = **1 : 1**（一个批次有唯一一组工艺参数）  

**字段约束**：  
- `material.material_no`：PRIMARY KEY、NOT NULL  
- `batch.batch_no`：PRIMARY KEY、NOT NULL；`batch.material_no`：FK → material  
- `process_param.batch_no`：UNIQUE、FK → batch（级联删除）  
- 数值字段：DECIMAL(10,4) + CHECK 约束（≥0、外模>内模、护套≥缆芯）

---

## 第二部分：软件架构设计

### 2.1 需要实现的功能

| # | 功能 | 对应类 |
|---|------|--------|
| 1 | Excel 多文件读取 | `ExcelReader` |
| 2 | 按批号解析 8 项工艺参数 | `ExcelReader` |
| 3 | 缺失值 / 异常值校验 | `DataCleaner` |
| 4 | 数据清洗与合并 | `DataCleaner` |
| 5 | 写入 MySQL 存储 | `DbRepository` |
| 6 | 生成统计报表 | `StatService` |
| 7 | 可扩展统计（分布、聚类） | `StatService`（预留扩展点） |
| 8 | 流水线编排 | `DataProcessService` |
| 9 | 配置加载 | `AppConfig` |

### 2.2 功能在对象间的分配（分层架构）

```
配置层     AppConfig          ← 读 YAML，提供强类型配置对象
数据读取层  ExcelReader        ← 只负责文件 I/O 和原始行解析
数据模型层  Material / Batch / ProcessParam  ← 承载数据，内置自校验
数据清洗层  DataCleaner        ← 完整性 + 合法性校验，不做 I/O
数据存储层  DbRepository       ← 只负责 MySQL 读写
业务编排层  DataProcessService ← 串联上述各层，不含业务逻辑
统计分析层  StatService        ← 只读查询 + 纯计算
```

### 2.3 对象协作方式（去中心化）

```
AppConfig
    │
    ▼
DataProcessService.run()
    │
    ├── ExcelReader.read_all()  →  List[Batch（原始）]
    │
    ├── DataCleaner.clean()     →  (valid_batches, invalid_batches)
    │
    └── DbRepository.save_batches() / save_invalid_batches()
              │
              ▼
          MySQL DB

StatService.all_materials_summary()
    └── DbRepository.fetch_batches_by_material()
```

每个对象只通过明确定义的方法接口通信，无全局状态，无单向依赖链以外的耦合。

### 2.4 避免单点膨胀的设计原则

1. **单一职责**：读取、校验、存储、统计各自独立，不在同一类中混合  
2. **接口隔离**：各层只暴露调用方需要的方法（如 `DataCleaner` 只暴露 `clean()`）  
3. **依赖注入**：`DataProcessService` 通过构造函数接收配置，不直接 `import` 具体数据库驱动  

### 2.5 可支撑的需求变数 vs 瓶颈

**可轻松应对**（只需扩展/替换单个类）：
- 新增统计指标（聚类分析）→ 只改 `StatService`
- 支持 CSV/JSON 输入 → 只加新 Reader，不改其他层
- 切换 PostgreSQL → 只改 `DbRepository`
- 新增校验规则 → 只改 `DataCleaner` 或 `ProcessParam.is_valid()`

**将导致较大改动的需求**：
- 8 个参数变成动态（不固定）→ `ProcessParam` 数据类假设固定字段，需改为动态字典结构
- 多线程并发写入 → `DbRepository` 需要连接池和事务并发控制改造

---

## 第三部分：代码质量统计

运行 `python code_stats.py src/` 得到以下结果：

### 3.1 类数量与方法分布

| 类名 | 方法数 | 有效代码行 | 所在文件 |
|------|--------|-----------|---------|
| DbRepository | 9 | 155 | repositories/db_repository.py |
| ExcelReader | 11 | 143 | readers/excel_reader.py |
| ProcessParam | 6 | 70 | models/process_param.py |
| StatService | 5 | 54 | services/stat_service.py |
| DataCleaner | 3 | 35 | cleaners/data_cleaner.py |
| DataProcessService | 3 | 22 | services/data_process_service.py |
| AppConfig | 2 | 10 | config/config.py |
| Batch | 2 | 9 | models/batch.py |
| DatabaseConfig | 1 | 5 | config/config.py |
| Material | 2 | 4 | models/material.py |
| ExcelConfig | 0 | 0 | config/config.py |
| **合计** | **44** | **507** | |

### 3.2 有效行数 Top 方法

| 类.方法 | 有效行数 |
|---------|---------|
| DbRepository._create_tables | 53 |
| ExcelReader._extract_batches | 36 |
| DbRepository._insert_batch | 33 |
| ProcessParam.is_valid | 32 |
| StatService.material_param_report | 23 |

### 3.3 过度集中警告分析

`_create_tables` 行数较多是 DDL SQL 字符串内容所致，属合理情况（SQL 本身即文档）。  
`_extract_batches` 是 Excel 解析核心逻辑，有一定复杂度，可未来拆分为「行聚合」和「批次构建」两步。  
其余方法均在 25 行以内，符合单一职责要求。

### 3.4 功能分布分析

- **跨类实现**：`read_all → clean → save` 跨 3 个类完成，职责清晰  
- **无中心化处理**：`DataProcessService` 仅做编排，不含业务判断  
- **类间接口**：均通过 `List[Batch]` 类型传递数据，松耦合

---

## 第四部分：面向对象设计原则

### 4.1 采用的 OOP 设计原则

| 原则 | 在本项目的体现 |
|------|--------------|
| **单一职责 (SRP)** | `ExcelReader` 只读文件，`DataCleaner` 只校验，`DbRepository` 只存取 |
| **开放/封闭 (OCP)** | 新增参数校验规则只需在 `DataCleaner._validate_batch` 增加方法，不修改调用层 |
| **里氏替换 (LSP)** | 集成测试中 `SqliteDbRepository` 替换 MySQL 版 `DbRepository` 行为一致 |
| **依赖倒置 (DIP)** | `DataProcessService` 依赖抽象的 `DbRepository` 接口，不直接 import PyMySQL |
| **迪米特法则** | `DataProcessService` 只知道 `ExcelReader`、`DataCleaner`、`DbRepository`，不知道其内部实现 |

### 4.2 如何实现松耦合 + 高内聚

- **松耦合**：各层之间通过 `List[Batch]` 传递，修改一个层不影响其他层  
- **高内聚**：`ProcessParam` 同时持有数据和自校验逻辑（`is_complete`/`is_valid`），数据和行为不分离  
- **应对未来变化**：增加新统计需求只改 `StatService`；换数据库只改 `DbRepository`；增加新 Excel 格式只加新 `Reader` 子类

---

## 第五部分：对附件代码的"挑刺"

> 由于附件代码尚未提供，以下基于常见初版数据处理脚本的典型问题，并映射到本项目的改进点。

### 5.1 命名不合规（违反《阿里巴巴 Java 开发手册》命名规约）

**典型问题代码**：
```python
def proc(d):          # 函数名无意义
    res = {}
    for i in d:       # 变量名 i、d、res 无语义
        ...
    return res
```
**违反规约**：方法名应使用动词+名词，如 `process_batch_data()`；变量名应表达含义，如 `batch_param_dict`。  
**本项目改进**：所有方法均采用「动词_名词」格式，如 `read_all`、`clean`、`save_batches`、`fetch_batches_by_material`。

### 5.2 不是面向对象（违反 SRP + OCP）

**典型问题代码**：
```python
# 一个函数完成读取+解析+校验+写库全部逻辑
def run(file_path, db_conn):
    wb = openpyxl.load_workbook(file_path)
    rows = ...
    # 解析
    # 校验
    # 写库
```
**违反 SRP**：一个函数承担 4 个职责，任何一个变化都需要修改整个函数。  
**违反 OCP**：增加新校验规则需修改现有代码，无法扩展而不修改。  
**本项目改进**：拆分为 `ExcelReader`、`DataCleaner`、`DbRepository` 三个独立类，编排由 `DataProcessService` 负责。

### 5.3 无数据正确性验证（违反数据质量首要原则）

**典型问题代码**：
```python
for row in ws.iter_rows():
    batch_data[row[0]] = row[3]   # 直接赋值，不检查缺失或非法值
```
**问题**：未检查 8 个参数是否齐全，未检查数值合法性，入库数据可能静默错误。  
**本项目改进**：`DataCleaner` 强制完整性+合法性双重校验，不合格批次不入库且留存日志。

### 5.4 无可扩展性（违反 OCP + DIP）

**典型问题代码**：
```python
import pymysql
conn = pymysql.connect(host='localhost', user='root', password='123456')  # 硬编码
```
**违反 DIP**：直接依赖具体数据库实现；配置硬编码，无法通过配置文件切换环境。  
**本项目改进**：使用 `AppConfig` + YAML 配置；`DbRepository` 使用 SQLAlchemy，连接字符串由 `DatabaseConfig.get_url()` 生成，可无缝切换数据库。

### 5.5 无测试，无法证明「不遗漏、不错误」

**典型问题**：只有一个 `main` 函数，无法自动验证数据正确性。  
**本项目改进**：共编写 **58 个测试用例**，覆盖：
- 模型层：`ProcessParam` 的构造、完整性检查、业务校验（21 个）  
- 读取层：单批次、多批次、边界场景（21 个）  
- 清洗层：合法/缺失/非法/重复批号（16 个）  
- 集成层：端到端不遗漏、不错误、不串批（7 个）

所有测试均通过 `pytest` 自动化运行，CI 可集成。

---

## 附：项目文件结构

```
customsystem/
├── src/
│   ├── config/
│   │   └── config.py          # AppConfig / DatabaseConfig / ExcelConfig
│   ├── models/
│   │   ├── material.py        # Material 实体
│   │   ├── batch.py           # Batch 实体
│   │   └── process_param.py   # ProcessParam（含 8 参数 + 自校验）
│   ├── readers/
│   │   └── excel_reader.py    # ExcelReader（支持合并单元格、多文件）
│   ├── cleaners/
│   │   └── data_cleaner.py    # DataCleaner（完整性 + 合法性 + 重复检测）
│   ├── repositories/
│   │   └── db_repository.py   # DbRepository（MySQL + SQLAlchemy）
│   └── services/
│       ├── data_process_service.py  # DataProcessService（编排）
│       └── stat_service.py          # StatService（统计分析）
├── tests/
│   ├── test_models.py         # ProcessParam 单元测试（21 个）
│   ├── test_excel_reader.py   # ExcelReader 单元测试（21 个）
│   ├── test_data_cleaner.py   # DataCleaner 单元测试（16 个）
│   └── test_integration.py    # 端到端集成测试（7 个）
├── sql/
│   └── schema.sql             # 建表 DDL + 视图（含 ER 设计说明）
├── code_stats.py              # 代码质量统计工具
├── main.py                    # 程序入口
├── config.yaml                # 配置文件
└── requirements.txt           # 依赖列表
```