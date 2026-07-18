import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

def set_run_font(run, font_name="Microsoft YaHei", size_pt=10, bold=False, italic=False, color_rgb=None):
    """Set font name (including East Asian mapping), size, bold, italic, and color for a text run."""
    run.font.name = font_name
    # 针对中文字体设置 eastAsia 属性
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn('w:eastAsia'), font_name)
    rFonts.set(qn('w:ascii'), font_name)
    rFonts.set(qn('w:hAnsi'), font_name)
    
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    if color_rgb:
        run.font.color.rgb = color_rgb

def add_bottom_border(paragraph, color_hex="1F4E79", size_pt="12"):
    """Add a bottom border line to a paragraph."""
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn('w:pBdr'))
    if pBdr is None:
        pBdr = OxmlElement('w:pBdr')
        pPr.append(pBdr)
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), size_pt)  # 12 -> 1.5 磅
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), color_hex)
    pBdr.append(bottom)

def create_borderless_table(doc, rows, cols, col_widths=None):
    """Create a borderless table and set column widths."""
    table = doc.add_table(rows=rows, cols=cols)
    table.alignment = docx.enum.table.WD_TABLE_ALIGNMENT.CENTER
    
    # 清除所有边框
    tblPr = table._tbl.tblPr
    tblBorders = OxmlElement('w:tblBorders')
    for border_name in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        border = OxmlElement(f'w:{border_name}')
        border.set(qn('w:val'), 'none')
        tblBorders.append(border)
    tblPr.append(tblBorders)
    
    # 设置单元格无间距
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        # 允许跨页拆行
        cant_split = OxmlElement('w:cantSplit')
        trPr.append(cant_split)
        
        # 宽度分配
        if col_widths:
            for i, width in enumerate(col_widths):
                if i < len(row.cells):
                    row.cells[i].width = width
                    
    return table

def set_cell_margins(cell, top=100, bottom=100, left=150, right=100):
    """Set inner cell margins/padding (in dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def generate_resume():
    doc = Document()
    
    # 颜色定义
    THEME_BLUE = RGBColor(31, 78, 121)     # 经典科技蓝 #1F4E79
    DARK_GRAY = RGBColor(60, 60, 60)       # 优雅深灰 #3C3C3C
    BLACK = RGBColor(0, 0, 0)
    
    # 页面边距设置 (0.6 英寸，约1.5厘米，确保能够完美排版在单页上)
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)
        section.header_distance = Inches(0.4)
        section.footer_distance = Inches(0.4)
        
    # ==================== 1. 个人信息 (Header) ====================
    # 姓名
    p_name = doc.add_paragraph()
    p_name.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_name.paragraph_format.space_before = Pt(0)
    p_name.paragraph_format.space_after = Pt(4)
    run_name = p_name.add_run("姜  言  达")
    set_run_font(run_name, size_pt=20, bold=True, color_rgb=THEME_BLUE)
    
    # 联络信息
    p_contact = doc.add_paragraph()
    p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_contact.paragraph_format.space_before = Pt(0)
    p_contact.paragraph_format.space_after = Pt(2)
    
    info_items = [
        ("电话", "18126365801"),
        ("邮箱", "1246747988@qq.com"),
        ("年龄", "21岁"),
        ("求职意向", "软件开发 / 算法工程 / 运维开发")
    ]
    
    contact_runs = []
    for i, (label, val) in enumerate(info_items):
        run_lbl = p_contact.add_run(f"{label}：")
        set_run_font(run_lbl, size_pt=9.5, bold=True, color_rgb=DARK_GRAY)
        run_val = p_contact.add_run(val)
        set_run_font(run_val, size_pt=9.5, bold=False, color_rgb=DARK_GRAY)
        if i < len(info_items) - 1:
            p_contact.add_run("   |   ")
            
    # 下划横线
    p_line = doc.add_paragraph()
    p_line.paragraph_format.space_before = Pt(0)
    p_line.paragraph_format.space_after = Pt(10)
    add_bottom_border(p_line, color_hex="1F4E79", size_pt="16")
    
    # 通用的添加小标题函数
    def add_section_header(title_text):
        p_hdr = doc.add_paragraph()
        p_hdr.paragraph_format.space_before = Pt(10)
        p_hdr.paragraph_format.space_after = Pt(4)
        p_hdr.paragraph_format.keep_with_next = True
        run_hdr = p_hdr.add_run(title_text)
        set_run_font(run_hdr, size_pt=12, bold=True, color_rgb=THEME_BLUE)
        add_bottom_border(p_hdr, color_hex="1F4E79", size_pt="8")
        return p_hdr

    # ==================== 2. 教育背景 ====================
    add_section_header("教育背景")
    
    # 教育背景表格
    # 总宽 7.3 英寸左右 (0.6" margins on 8.5" page width = 7.3" printable area)
    col_widths = [Inches(3.5), Inches(2.0), Inches(1.8)]
    edu_table = create_borderless_table(doc, rows=1, cols=3, col_widths=col_widths)
    row = edu_table.rows[0]
    
    # 学校
    p_sch = row.cells[0].paragraphs[0]
    p_sch.paragraph_format.space_after = Pt(2)
    run_sch = p_sch.add_run("深圳大学")
    set_run_font(run_sch, size_pt=10.5, bold=True, color_rgb=BLACK)
    
    # 专业与学历
    p_maj = row.cells[1].paragraphs[0]
    p_maj.paragraph_format.space_after = Pt(2)
    p_maj.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_maj = p_maj.add_run("软件工程（本科）")
    set_run_font(run_maj, size_pt=10.5, bold=True, color_rgb=BLACK)
    
    # 时间
    p_time = row.cells[2].paragraphs[0]
    p_time.paragraph_format.space_after = Pt(2)
    p_time.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_time = p_time.add_run("2024.09 - 2028.06")
    set_run_font(run_time, size_pt=10.5, bold=True, color_rgb=BLACK)
    
    # 成绩与课程
    p_edu_info1 = doc.add_paragraph()
    p_edu_info1.paragraph_format.space_before = Pt(2)
    p_edu_info1.paragraph_format.space_after = Pt(2)
    p_edu_info1.paragraph_format.left_indent = Inches(0.15)
    run_tag1 = p_edu_info1.add_run("■ ")
    set_run_font(run_tag1, size_pt=8, color_rgb=THEME_BLUE)
    run_lbl = p_edu_info1.add_run("学业成绩：")
    set_run_font(run_lbl, size_pt=9.5, bold=True, color_rgb=BLACK)
    run_val = p_edu_info1.add_run("GPA 3.2-3.5，全专业排名前30%（班级排名25/75，年级排名134/530），学业基础扎实，专业核心课程掌握优异。")
    set_run_font(run_val, size_pt=9.5, color_rgb=DARK_GRAY)
    
    p_edu_info2 = doc.add_paragraph()
    p_edu_info2.paragraph_format.space_before = Pt(2)
    p_edu_info2.paragraph_format.space_after = Pt(2)
    p_edu_info2.paragraph_format.left_indent = Inches(0.15)
    run_tag2 = p_edu_info2.add_run("■ ")
    set_run_font(run_tag2, size_pt=8, color_rgb=THEME_BLUE)
    run_lbl = p_edu_info2.add_run("主修课程：")
    set_run_font(run_lbl, size_pt=9.5, bold=True, color_rgb=BLACK)
    run_val = p_edu_info2.add_run("数据结构、数据库系统、算法分析、计算机网络、软件工程、软件测试、计算机系统1/2/3、编译原理、Web前端开发、Python程序设计等。覆盖软件开发、系统运维、数据处理全流程，具备完整的软件工程专业知识体系。")
    set_run_font(run_val, size_pt=9.5, color_rgb=DARK_GRAY)


    # ==================== 3. 科创竞赛与项目经历 ====================
    add_section_header("科创竞赛与项目经历")
    
    def add_project_item(title, role, date, bullets):
        # 标题行
        col_w = [Inches(4.5), Inches(1.3), Inches(1.5)]
        tbl = create_borderless_table(doc, rows=1, cols=3, col_widths=col_w)
        r = tbl.rows[0]
        
        # 竞赛/项目名称
        p_t = r.cells[0].paragraphs[0]
        p_t.paragraph_format.space_after = Pt(2)
        r_t = p_t.add_run(title)
        set_run_font(r_t, size_pt=10.5, bold=True, color_rgb=BLACK)
        
        # 角色/职责
        p_r = r.cells[1].paragraphs[0]
        p_r.paragraph_format.space_after = Pt(2)
        p_r.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_r = p_r.add_run(role)
        set_run_font(r_r, size_pt=10, bold=True, color_rgb=THEME_BLUE)
        
        # 时间
        p_d = r.cells[2].paragraphs[0]
        p_d.paragraph_format.space_after = Pt(2)
        p_d.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_d = p_d.add_run(date)
        set_run_font(r_d, size_pt=9.5, bold=True, color_rgb=BLACK)
        
        # 描述点 (使用紧凑的缩进格式，而不是大圆点，以保持美观和紧凑)
        for bullet in bullets:
            p_b = doc.add_paragraph()
            p_b.paragraph_format.space_before = Pt(0)
            p_b.paragraph_format.space_after = Pt(2)
            p_b.paragraph_format.left_indent = Inches(0.2)
            
            run_dot = p_b.add_run("•  ")
            set_run_font(run_dot, size_pt=9.5, bold=True, color_rgb=THEME_BLUE)
            
            # 部分关键词加粗显示
            parts = bullet.split("**")
            for idx, part in enumerate(parts):
                is_bold = (idx % 2 == 1)
                r_part = p_b.add_run(part)
                set_run_font(r_part, size_pt=9.5, bold=is_bold, color_rgb=DARK_GRAY if not is_bold else BLACK)

    # 1. 蓝桥杯
    add_project_item(
        "蓝桥杯全国软件和信息技术专业人才大赛 (C++程序设计大学A组)",
        "团队核心成员",
        "2024.04 - 2024.06",
        [
            "**算法编程与调试**：主攻C++算法编程、程序调试与代码优化，系统攻克数据结构、核心算法及程序逻辑，完成多套真题训练与模拟测试，荣获**广东省赛区优秀奖**。",
            "**招新与团队建设**：独立撰写6篇科创竞赛推文，累计阅读量**2000+**；负责线下宣讲与面试筛选工作，成功吸纳2名新生加入，有效充实竞赛团队力量。"
        ]
    )
    
    # 间距调整
    doc.add_paragraph().paragraph_format.space_before = Pt(2)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(0)
    
    # 2. 创新创业
    add_project_item(
        "校级大学生创新创业训练计划项目 (校园服务小程序)",
        "核心开发成员",
        "2024.10 - 2025.05",
        [
            "**数据库搭建与设计**：基于 MySQL 搭建项目数据库，独立完成用户信息、数据存储、信息查询等核心模块的物理和逻辑表结构设计。",
            "**功能开发与调试**：运用 **Python** 与 **JavaScript** 完成项目后端基础功能代码实现与程序调试，协同团队进行需求分析与迭代优化。",
            "**项目结题汇报**：参与中期答辩及结题材料撰写，梳理技术难点及解决方案，项目顺利通过校级结题审核，积累完整开发落地经验。"
        ]
    )
    
    doc.add_paragraph().paragraph_format.space_before = Pt(2)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(0)
    
    # 3. ACM
    add_project_item(
        "校级 ACM 程序设计校内选拔赛",
        "算法竞赛选手",
        "2025.03",
        [
            "**高强度临场解题**：专注算法解题、代码调试与逻辑优化，熟练运用 C++ 进行数据结构、字符串处理、数组运算等多题型解题并通关。",
            "**算法竞赛实战**：通过赛前系统刷题与团队集训，大幅提升了算法思维与代码编写效率，积累算法竞赛实战经验，荣获**校级优秀奖**。"
        ]
    )


    # ==================== 4. 社会实践经历 ====================
    add_section_header("社会实践经历")
    
    # 1. 学而思
    add_project_item(
        "东莞学而思",
        "实习教学助理",
        "2025.06 - 2025.09",
        [
            "**班级统筹与日常管理**：统筹管理 150 余名学员的课堂秩序与学情，规范上课流程。优化课堂督导制度，使班级整体**出勤率提升 15%**，课堂纪律与学习氛围显著优化。",
            "**教学体系高效保障**：组织部门工作例会并梳理重点，高效落地学情反馈、家校沟通、活动筹备等 **12 项重点工作**，保障教学服务体系高效运转。",
            "**数据化教学辅助**：收集并整理学员学习台账与成绩数据，汇总生成直观学情报告，辅助授课老师精准调整教学节奏，获主管及同事高度认可。"
        ]
    )
    
    doc.add_paragraph().paragraph_format.space_before = Pt(2)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(0)
    
    # 2. 三下乡
    add_project_item(
        "暑期 \"三下乡\" 社会实践服务队",
        "技术组组员",
        "2025.07 - 2025.08",
        [
            "**数字化乡村调研**：赴粤东乡镇开展信息化帮扶。运用 **Excel** 录入并统计分析农户及产业数据，处理 200 余份调研问卷并产出**可视化数据图表**，为调研报告提供扎实数据支撑。",
            "**宣传物料全周期设计**：负责团队拍摄与后期剪辑工作，产出宣传推文及活动记录视频等 **8 份多媒体物料**，团队获评校级**\"优秀社会实践团队\"**称号。"
        ]
    )
    
    doc.add_paragraph().paragraph_format.space_before = Pt(2)
    doc.paragraphs[-1].paragraph_format.space_after = Pt(0)
    
    # 3. 社区志愿
    add_project_item(
        "街道社区政务服务实践",
        "志愿服务岗",
        "2025.02 - 2025.03",
        [
            "**智能设备敬老帮扶**：于街道办事处便民中心负责信息登记与业务引导。协助 30 余位老年居民完成社保认证、医保查询及线上政务操作，切实提升服务便利度。",
            "**便民台账分类优化**：整理归档社区便民服务材料，**优化文件分类与检索方式**，显著提升了窗口办事效率，获得服务中心工作人员一致好评。"
        ]
    )


    # ==================== 5. 专业技能 ====================
    add_section_header("专业技能")
    
    skills_data = [
        ("编程技术", "熟练掌握 **C++**、**Python**、**JavaScript** 编程语言，熟悉 CSS 前端开发，具备独立编写核心逻辑代码与算法程序的能力。"),
        ("数据库与后端", "熟练使用 **MySQL** 数据库，掌握数据表设计、高频增删改查操作与基础数据库性能优化，具备简单项目后端数据库搭建与运维能力。"),
        ("办公与效率工具", "熟练掌握 **Word**、**Excel**（高级数据分析、可视化图表）、**PPT** 制作，可高质量独立撰写技术文档、学情分析与汇报方案。"),
        ("语言水平", "持有大学英语四级（**CET-4**）、六级（**CET-6**）证书，具备良好的英文读写能力，可无障碍查阅专业英文技术文档。")
    ]
    
    for label, desc in skills_data:
        p_sk = doc.add_paragraph()
        p_sk.paragraph_format.space_before = Pt(0)
        p_sk.paragraph_format.space_after = Pt(2)
        p_sk.paragraph_format.left_indent = Inches(0.15)
        
        run_dot = p_sk.add_run("■ ")
        set_run_font(run_dot, size_pt=8, color_rgb=THEME_BLUE)
        
        run_lbl = p_sk.add_run(f"{label}：")
        set_run_font(run_lbl, size_pt=9.5, bold=True, color_rgb=BLACK)
        
        # 处理加粗
        parts = desc.split("**")
        for idx, part in enumerate(parts):
            is_bold = (idx % 2 == 1)
            r_part = p_sk.add_run(part)
            set_run_font(r_part, size_pt=9.5, bold=is_bold, color_rgb=DARK_GRAY if not is_bold else BLACK)


    # ==================== 6. 自我评价 ====================
    add_section_header("自我评价")
    
    eval_bullets = [
        "**踏实专注，技术扎实**：性格沉稳谦逊，拥有强烈的求知欲与自主钻研意识；熟练掌握 C++、Python、MySQL 等开发技术，在算法及项目开发方面具备扎实的实操底子与逻辑思维。",
        "**综合卓越，执行力强**：长期担任学生干部，具备优秀的团队协作、沟通协调与多任务落地能力，执行力极强，能快速融入并适应新环境，始终保质保量完成各项工作与项目任务。"
    ]
    
    for bullet in eval_bullets:
        p_ev = doc.add_paragraph()
        p_ev.paragraph_format.space_before = Pt(0)
        p_ev.paragraph_format.space_after = Pt(2)
        p_ev.paragraph_format.left_indent = Inches(0.15)
        
        run_dot = p_ev.add_run("■ ")
        set_run_font(run_dot, size_pt=8, color_rgb=THEME_BLUE)
        
        parts = bullet.split("**")
        for idx, part in enumerate(parts):
            is_bold = (idx % 2 == 1)
            r_part = p_ev.add_run(part)
            set_run_font(r_part, size_pt=9.5, bold=is_bold, color_rgb=DARK_GRAY if not is_bold else BLACK)

    # 保存文档
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(current_dir, "姜言达-深圳大学-软件工程-个人简历.docx")
    doc.save(output_path)
    print(f"简历已成功生成并保存至: {output_path}")

if __name__ == "__main__":
    generate_resume()
