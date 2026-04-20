#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple语言词法分析器测试套件

覆盖内容：
  - 标识符（正例、反例、边界情况）
  - 无符号数（正例、反例、边界情况）
  - 关键字识别与标识符区分
  - 运算符（单字符、多字符最长匹配）
  - 分隔符
  - 注释处理（行注释、块注释）
  - 混合输入（题目给定示例）
  - 词法错误报告
"""

import sys
import io
from lexer import Lexer, Token, LexError, KEYWORDS, OPERATORS, SEPARATORS


# ============================================================
# 辅助函数
# ============================================================

def lex(source: str):
    """对 source 字符串执行词法分析，返回 Token 列表。"""
    return Lexer(source).tokenize()


def lex_types(source: str):
    """只返回 token 类型名称列表（方便断言）。"""
    return [t.type_name for t in lex(source)]


def lex_values(source: str):
    """只返回 token 词素（值）列表。"""
    return [t.value for t in lex(source)]


def expect_error(source: str) -> None:
    """期望词法分析抛出 LexError，否则测试失败。"""
    try:
        Lexer(source).tokenize()
    except SystemExit:
        # tokenize() 内部 catch LexError 后调用 sys.exit(1)
        return  # 说明确实触发了错误，测试通过
    raise AssertionError(f'应当抛出错误，但未抛出: {source!r}')


# ============================================================
# 测试计数器
# ============================================================

passed = 0
failed = 0


def run(name: str, fn):
    global passed, failed
    try:
        fn()
        print(f'  [PASS] {name}')
        passed += 1
    except Exception as e:
        print(f'  [FAIL] {name}: {e}')
        failed += 1


# ============================================================
# 1. 标识符测试
# ============================================================

def test_identifier_basic():
    tokens = lex('abc')
    assert len(tokens) == 1
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == 'abc'


def test_identifier_with_digits():
    tokens = lex('id123')
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == 'id123'


def test_identifier_underscore_start():
    tokens = lex('_tmp')
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == '_tmp'


def test_identifier_mixed():
    tokens = lex('_a1B2_c3')
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == '_a1B2_c3'


def test_identifier_single_letter():
    tokens = lex('x')
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == 'x'


def test_identifier_not_start_with_digit():
    """数字开头不能是标识符 → 应识别为整数 + 标识符"""
    tokens = lex('123abc')
    assert tokens[0].type_name == '整数'
    assert tokens[0].value == '123'
    assert tokens[1].type_name == '标识符'
    assert tokens[1].value == 'abc'


def test_identifier_keyword_lookalike():
    """'forked' 不是关键字 for，而是标识符"""
    tokens = lex('forked')
    assert tokens[0].type_name == '标识符'
    assert tokens[0].value == 'forked'


def test_identifier_multiple():
    tokens = lex('a b c')
    assert lex_values('a b c') == ['a', 'b', 'c']
    assert all(t.type_name == '标识符' for t in tokens)


# ============================================================
# 2. 关键字测试
# ============================================================

def test_all_keywords():
    for kw, tname in KEYWORDS.items():
        tokens = lex(kw)
        assert len(tokens) == 1, f'关键字 {kw!r} 应产生1个token'
        assert tokens[0].type_name == tname, \
            f'{kw!r}: 期望 {tname}, 实际 {tokens[0].type_name}'


def test_keyword_adjacent_identifier():
    """关键字后紧接字母 → 识别为标识符，不是关键字"""
    tokens = lex('iff')
    assert tokens[0].type_name == '标识符'
    tokens2 = lex('iff else')
    assert tokens2[0].type_name == '标识符'
    assert tokens2[0].value == 'iff'
    assert tokens2[1].type_name == 'ELSE关键字'


# ============================================================
# 3. 无符号数测试
# ============================================================

def test_integer_zero():
    tokens = lex('0')
    assert tokens[0].type_name == '整数'
    assert tokens[0].value == '0'


def test_integer_multi_digit():
    tokens = lex('12345')
    assert tokens[0].type_name == '整数'
    assert tokens[0].value == '12345'


def test_float_basic():
    tokens = lex('3.14')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '3.14'


def test_float_dot_prefix():
    """.5 — 小数点开头的浮点数"""
    tokens = lex('.5')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '.5'


def test_float_exp_no_sign():
    """3e5"""
    tokens = lex('3e5')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '3e5'


def test_float_exp_plus():
    """3.14e+2"""
    tokens = lex('3.14e+2')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '3.14e+2'


def test_float_exp_minus():
    """.5e-10"""
    tokens = lex('.5e-10')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '.5e-10'


def test_float_capital_E():
    """100E3"""
    tokens = lex('100E3')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '100E3'


def test_float_exp_zero():
    """2.0e0"""
    tokens = lex('2.0e0')
    assert tokens[0].type_name == '浮点数'
    assert tokens[0].value == '2.0e0'


def test_integer_followed_by_separator():
    """整数后跟分号"""
    tokens = lex('42;')
    assert tokens[0].type_name == '整数' and tokens[0].value == '42'
    assert tokens[1].type_name == '分号分隔符'


def test_number_error_lone_dot():
    """单独的 . 不是合法 token"""
    expect_error('.')


def test_number_error_dot_no_digit():
    """a.b → a（标识符）然后 . 非法"""
    expect_error('a.b')


def test_number_error_exp_no_digit():
    """3e 后面没有数字"""
    expect_error('3e')


def test_number_error_exp_sign_no_digit():
    """3e+ 后面没有数字"""
    expect_error('3e+')


# ============================================================
# 4. 运算符测试（最长匹配）
# ============================================================

def test_op_plus():
    assert lex_types('+') == ['加运算符']


def test_op_plusplus():
    assert lex_types('++') == ['自增1运算符']


def test_op_pluseq():
    assert lex_types('+=') == ['加赋值运算符']


def test_op_minus():
    assert lex_types('-') == ['减运算符']


def test_op_minusminus():
    assert lex_types('--') == ['自减1运算符']


def test_op_minuseq():
    assert lex_types('-=') == ['减赋值运算符']


def test_op_star():
    assert lex_types('*') == ['乘运算符']


def test_op_stareq():
    assert lex_types('*=') == ['乘赋值运算符']


def test_op_slash():
    assert lex_types('/') == ['除运算符']


def test_op_slasheq():
    assert lex_types('/=') == ['除赋值运算符']


def test_op_eq():
    assert lex_types('=') == ['赋值运算符']


def test_op_eqeq():
    assert lex_types('==') == ['等于运算符']


def test_op_ne():
    assert lex_types('!=') == ['不等于运算符']


def test_op_lt():
    assert lex_types('<') == ['小于运算符']


def test_op_le():
    assert lex_types('<=') == ['小于等于运算符']


def test_op_gt():
    assert lex_types('>') == ['大于运算符']


def test_op_ge():
    assert lex_types('>=') == ['大于等于运算符']


def test_op_and():
    assert lex_types('&&') == ['逻辑与运算符']


def test_op_or():
    assert lex_types('||') == ['逻辑或运算符']


def test_op_not():
    assert lex_types('!') == ['逻辑非运算符']


def test_op_percent():
    assert lex_types('%') == ['取模运算符']


def test_op_single_amp_error():
    """单个 & 非法"""
    expect_error('&')


def test_op_single_pipe_error():
    """单个 | 非法"""
    expect_error('|')


def test_op_longest_match_i_plusplus():
    """i++ → 标识符 i + 自增1运算符"""
    tokens = lex('i++')
    assert tokens[0].type_name == '标识符' and tokens[0].value == 'i'
    assert tokens[1].type_name == '自增1运算符'


# ============================================================
# 5. 分隔符测试
# ============================================================

def test_all_separators():
    for sep, tname in SEPARATORS.items():
        tokens = lex(sep)
        assert tokens[0].type_name == tname, \
            f'分隔符 {sep!r}: 期望 {tname}, 实际 {tokens[0].type_name}'


# ============================================================
# 6. 注释测试
# ============================================================

def test_line_comment():
    """行注释不产生 token"""
    tokens = lex('// 这是注释\n')
    assert tokens == []


def test_line_comment_after_code():
    tokens = lex('x = 1; // comment')
    assert lex_values('x = 1; // comment') == ['x', '=', '1', ';']


def test_block_comment():
    tokens = lex('/* 块注释 */')
    assert tokens == []


def test_block_comment_multiline():
    tokens = lex('a /* comment\n   continues */ b')
    assert lex_values('a /* comment\n   continues */ b') == ['a', 'b']


def test_block_comment_with_star():
    """块注释内含多余的 * 不影响"""
    tokens = lex('/* ** ok */')
    assert tokens == []


# ============================================================
# 7. 混合/集成测试
# ============================================================

def test_sample_from_problem():
    """题目给定示例：for(int i=0;i<5;i++) {sum +=i;} //这是有问题的循环"""
    source = 'for(int i=0;i<5;i++) {sum +=i;} //这是有问题的循环'
    tokens = lex(source)
    expected_types = [
        'FOR关键字', '左括号', 'INT关键字', '标识符',
        '赋值运算符', '整数', '分号分隔符',
        '标识符', '小于运算符', '整数', '分号分隔符',
        '标识符', '自增1运算符', '右括号',
        '左花括号', '标识符', '加赋值运算符', '标识符',
        '分号分隔符', '右花括号',
    ]
    actual_types = [t.type_name for t in tokens]
    assert actual_types == expected_types, \
        f'\n期望: {expected_types}\n实际: {actual_types}'


def test_line_col_tracking():
    """验证行列号跟踪"""
    tokens = lex('a\nb\nc')
    assert tokens[0].line == 1 and tokens[0].col == 1
    assert tokens[1].line == 2 and tokens[1].col == 1
    assert tokens[2].line == 3 and tokens[2].col == 1


def test_float_in_expression():
    """浮点数出现在表达式中"""
    tokens = lex('x = 3.14 + .5e2;')
    assert tokens[2].type_name == '浮点数' and tokens[2].value == '3.14'
    assert tokens[4].type_name == '浮点数' and tokens[4].value == '.5e2'


def test_empty_source():
    tokens = lex('')
    assert tokens == []


def test_whitespace_only():
    tokens = lex('   \t\n  ')
    assert tokens == []


def test_complex_program():
    source = """
    int factorial(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }
    """
    tokens = lex(source)
    # 基本正确性：不报错，且 token 数量大于 0
    assert len(tokens) > 0
    # 第一个 token 是 INT关键字
    assert tokens[0].type_name == 'INT关键字'


# ============================================================
# 主运行器
# ============================================================

TESTS = [
    # 标识符
    ('标识符-基本', test_identifier_basic),
    ('标识符-含数字', test_identifier_with_digits),
    ('标识符-下划线开头', test_identifier_underscore_start),
    ('标识符-混合字符', test_identifier_mixed),
    ('标识符-单字母', test_identifier_single_letter),
    ('标识符-数字开头(反例)', test_identifier_not_start_with_digit),
    ('标识符-关键字相似(反例)', test_identifier_keyword_lookalike),
    ('标识符-多个', test_identifier_multiple),
    # 关键字
    ('关键字-全部关键字', test_all_keywords),
    ('关键字-相似标识符不混淆', test_keyword_adjacent_identifier),
    # 无符号数
    ('整数-零', test_integer_zero),
    ('整数-多位', test_integer_multi_digit),
    ('浮点数-基本', test_float_basic),
    ('浮点数-小数点开头', test_float_dot_prefix),
    ('浮点数-指数无符号', test_float_exp_no_sign),
    ('浮点数-指数正号', test_float_exp_plus),
    ('浮点数-指数负号', test_float_exp_minus),
    ('浮点数-大写E', test_float_capital_E),
    ('浮点数-指数为零', test_float_exp_zero),
    ('整数-后跟分号', test_integer_followed_by_separator),
    ('数字-单点错误(反例)', test_number_error_lone_dot),
    ('数字-点后无数字(反例)', test_number_error_dot_no_digit),
    ('数字-指数无数字(反例)', test_number_error_exp_no_digit),
    ('数字-指数符号后无数字(反例)', test_number_error_exp_sign_no_digit),
    # 运算符
    ('运算符-+', test_op_plus),
    ('运算符-++', test_op_plusplus),
    ('运算符-+=', test_op_pluseq),
    ('运算符--', test_op_minus),
    ('运算符---（自减）', test_op_minusminus),
    ('运算符--=', test_op_minuseq),
    ('运算符-*', test_op_star),
    ('运算符-*=', test_op_stareq),
    ('运算符-/', test_op_slash),
    ('运算符-/=', test_op_slasheq),
    ('运算符-=', test_op_eq),
    ('运算符-==', test_op_eqeq),
    ('运算符-!=', test_op_ne),
    ('运算符-<', test_op_lt),
    ('运算符-<=', test_op_le),
    ('运算符->', test_op_gt),
    ('运算符->=', test_op_ge),
    ('运算符-&&', test_op_and),
    ('运算符-||', test_op_or),
    ('运算符-!', test_op_not),
    ('运算符-%', test_op_percent),
    ('运算符-单&(反例)', test_op_single_amp_error),
    ('运算符-单|(反例)', test_op_single_pipe_error),
    ('运算符-最长匹配i++', test_op_longest_match_i_plusplus),
    # 分隔符
    ('分隔符-全部', test_all_separators),
    # 注释
    ('注释-行注释', test_line_comment),
    ('注释-行注释在代码后', test_line_comment_after_code),
    ('注释-块注释', test_block_comment),
    ('注释-多行块注释', test_block_comment_multiline),
    ('注释-块注释含星号', test_block_comment_with_star),
    # 集成
    ('集成-题目示例', test_sample_from_problem),
    ('集成-行列号跟踪', test_line_col_tracking),
    ('集成-浮点数在表达式中', test_float_in_expression),
    ('集成-空源文件', test_empty_source),
    ('集成-纯空白', test_whitespace_only),
    ('集成-复杂程序', test_complex_program),
]


def main():
    global passed, failed
    print('=' * 60)
    print('Simple语言词法分析器 — 测试套件')
    print('=' * 60)

    # 重定向 stderr 以防止错误消息污染测试输出
    _stderr = sys.stderr
    sys.stderr = io.StringIO()

    for name, fn in TESTS:
        run(name, fn)

    sys.stderr = _stderr

    print('=' * 60)
    total = passed + failed
    print(f'测试结果: {passed}/{total} 通过', end='')
    if failed:
        print(f'，{failed} 失败')
        sys.exit(1)
    else:
        print(' ✓')


if __name__ == '__main__':
    main()
