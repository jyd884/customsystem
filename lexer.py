#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple语言词法分析器 — 基于DFA（确定有限自动机）实现

====================================================================
Simple语言定义
====================================================================
  关键字:   if  else  while  for  do  int  float  return
            void  break  continue  true  false
  运算符:   +  -  *  /  %  =  ==  !=  <  <=  >  >=
            &&  ||  !  ++  --  +=  -=  *=  /=
  分隔符:   (  )  {  }  [  ]  ;  ,
  标识符:   字母或下划线开头，后跟任意字母、数字或下划线
  无符号数: 整数（纯数字）或浮点数（含小数部分和/或指数部分）
            整数和小数部分可单独出现也可依次出现；
            指数部分（e/E 后接可选 +/- 和数字）需跟随在整数或小数后。
            示例: 3   3.14   .5   3e5   3.14e+2   .5e-10

====================================================================
DFA 状态说明
====================================================================
  START(0)        — 初始状态（每个新 token 从此出发）
  IN_ID(1)        — 正在读取标识符/关键字（已读至少一个字母或_）
  IN_INT(2)       — 正在读取整数部分
  IN_DOT(3)       — 刚读到小数点（.），等待小数数字
  IN_FRAC(4)      — 正在读取小数数字
  IN_E(5)         — 刚读到指数符号 e/E
  IN_EXP_SIGN(6)  — 读到指数符号后的 + 或 -
  IN_EXP(7)       — 正在读取指数数字（接受状态：浮点数）
  IN_PLUS(10)     — 刚读到 +（等待 + 或 = 以区分 ++ / += / +）
  IN_MINUS(11)    — 刚读到 -（等待 - 或 = 以区分 -- / -= / -）
  IN_STAR(12)     — 刚读到 *（等待 = 以区分 *= / *）
  IN_SLASH(13)    — 刚读到 /（等待 / * = 以区分注释 / /= / /）
  IN_ASSIGN(14)   — 刚读到 =（等待 = 以区分 == / =）
  IN_LT(15)       — 刚读到 <（等待 = 以区分 <= / <）
  IN_GT(16)       — 刚读到 >（等待 = 以区分 >= / >）
  IN_NOT(17)      — 刚读到 !（等待 = 以区分 != / !）
  IN_AMP(18)      — 刚读到 &（等待第二个 & 以构成 &&）
  IN_PIPE(19)     — 刚读到 |（等待第二个 | 以构成 ||）
  IN_LINE_CMT(20) — 行注释（//）中，读到换行则结束
  IN_BLK_CMT(21)  — 块注释（/* ... */）中
  IN_BLK_STAR(22) — 块注释中刚读到 *，等待 / 以结束注释
"""

import sys
from enum import IntEnum
from typing import List, Optional


# ============================================================
# DFA 状态枚举
# ============================================================

class State(IntEnum):
    START        = 0
    IN_ID        = 1
    IN_INT       = 2
    IN_DOT       = 3
    IN_FRAC      = 4
    IN_E         = 5
    IN_EXP_SIGN  = 6
    IN_EXP       = 7
    IN_PLUS      = 10
    IN_MINUS     = 11
    IN_STAR      = 12
    IN_SLASH     = 13
    IN_ASSIGN    = 14
    IN_LT        = 15
    IN_GT        = 16
    IN_NOT       = 17
    IN_AMP       = 18
    IN_PIPE      = 19
    IN_LINE_CMT  = 20
    IN_BLK_CMT   = 21
    IN_BLK_STAR  = 22


# ============================================================
# 语言符号表
# ============================================================

KEYWORDS = {
    'if':       'IF关键字',
    'else':     'ELSE关键字',
    'while':    'WHILE关键字',
    'for':      'FOR关键字',
    'do':       'DO关键字',
    'int':      'INT关键字',
    'float':    'FLOAT关键字',
    'return':   'RETURN关键字',
    'void':     'VOID关键字',
    'break':    'BREAK关键字',
    'continue': 'CONTINUE关键字',
    'true':     'TRUE关键字',
    'false':    'FALSE关键字',
}

OPERATORS = {
    '+':  '加运算符',
    '-':  '减运算符',
    '*':  '乘运算符',
    '/':  '除运算符',
    '%':  '取模运算符',
    '=':  '赋值运算符',
    '==': '等于运算符',
    '!=': '不等于运算符',
    '<':  '小于运算符',
    '<=': '小于等于运算符',
    '>':  '大于运算符',
    '>=': '大于等于运算符',
    '&&': '逻辑与运算符',
    '||': '逻辑或运算符',
    '!':  '逻辑非运算符',
    '++': '自增1运算符',
    '--': '自减1运算符',
    '+=': '加赋值运算符',
    '-=': '减赋值运算符',
    '*=': '乘赋值运算符',
    '/=': '除赋值运算符',
}

SEPARATORS = {
    '(': '左括号',
    ')': '右括号',
    '{': '左花括号',
    '}': '右花括号',
    '[': '左方括号',
    ']': '右方括号',
    ';': '分号分隔符',
    ',': '逗号分隔符',
}


# ============================================================
# Token 类
# ============================================================

class Token:
    """词法单元（单词）"""

    def __init__(self, type_name: str, value: str, line: int = 0, col: int = 0):
        self.type_name = type_name
        self.value = value
        self.line = line
        self.col = col

    def __str__(self) -> str:
        return f'({self.type_name}，{self.value})'

    def __repr__(self) -> str:
        return f'Token({self.type_name!r}, {self.value!r}, line={self.line}, col={self.col})'


# ============================================================
# 词法异常类
# ============================================================

class LexError(Exception):
    """词法分析错误，携带行列信息"""

    def __init__(self, message: str, line: int, col: int):
        self.message = message
        self.line = line
        self.col = col
        super().__init__(f'词法错误 [行{line}, 列{col}]: {message}')


# ============================================================
# 词法分析器（DFA 实现）
# ============================================================

class Lexer:
    """
    基于 DFA 的 Simple 语言词法分析器。

    工作原理：
      维护当前 DFA 状态（state），逐字符扫描源文件。
      在每个状态下，根据当前字符执行以下操作之一：
        1. 保持当前状态（继续积累词素 lexeme）
        2. 转换到新状态
        3. 产生一个 Token（进入接受状态），可选择性地回退当前字符
      遇到无法识别的字符时，抛出 LexError。
    """

    def __init__(self, source: str):
        self.source = source
        self.pos = 0     # 当前扫描位置
        self.line = 1    # 当前行号（从 1 开始）
        self.col = 1     # 当前列号（从 1 开始）

    # ----------------------------------------------------------
    # 内部辅助方法
    # ----------------------------------------------------------

    def _peek(self) -> Optional[str]:
        """查看当前位置字符，不消耗；文件末尾返回 None。"""
        if self.pos < len(self.source):
            return self.source[self.pos]
        return None

    def _advance(self) -> str:
        """消耗当前字符，更新行列号并返回该字符。"""
        ch = self.source[self.pos]
        self.pos += 1
        if ch == '\n':
            self.line += 1
            self.col = 1
        else:
            self.col += 1
        return ch

    # ----------------------------------------------------------
    # DFA 主驱动方法
    # ----------------------------------------------------------

    def next_token(self) -> Optional[Token]:
        """
        基于 DFA 获取下一个 Token。

        DFA 状态转换驱动循环：每次迭代根据 (state, ch) 决定
        下一步动作，直到产生一个 Token 或到达文件末尾。

        返回
        ----
        Token — 下一个识别到的词法单元
        None  — 文件末尾（EOF）
        抛出 LexError — 遇到非法字符
        """
        state = State.START
        lexeme = ''
        token_line = self.line
        token_col = self.col

        while True:
            ch = self._peek()

            # ========== START：初始状态 ==========
            if state == State.START:
                if ch is None:
                    # EOF — 无更多 token
                    return None

                if ch in ' \t\r\n':
                    # 空白字符 → 跳过，更新 token 起始位置
                    self._advance()
                    token_line = self.line
                    token_col = self.col

                elif ch.isalpha() or ch == '_':
                    # 字母或下划线 → 开始读取标识符/关键字
                    state = State.IN_ID
                    lexeme += self._advance()

                elif ch.isdigit():
                    # 数字 → 开始读取整数
                    state = State.IN_INT
                    lexeme += self._advance()

                elif ch == '.':
                    # 小数点开头（如 .5）→ 需要预看下一字符
                    if (self.pos + 1 < len(self.source)
                            and self.source[self.pos + 1].isdigit()):
                        state = State.IN_DOT
                        lexeme += self._advance()
                    else:
                        self._advance()
                        raise LexError(f'非法字符: {ch!r}', token_line, token_col)

                elif ch == '+':
                    state = State.IN_PLUS
                    lexeme += self._advance()
                elif ch == '-':
                    state = State.IN_MINUS
                    lexeme += self._advance()
                elif ch == '*':
                    state = State.IN_STAR
                    lexeme += self._advance()
                elif ch == '/':
                    state = State.IN_SLASH
                    lexeme += self._advance()
                elif ch == '%':
                    self._advance()
                    return Token(OPERATORS['%'], '%', token_line, token_col)
                elif ch == '=':
                    state = State.IN_ASSIGN
                    lexeme += self._advance()
                elif ch == '!':
                    state = State.IN_NOT
                    lexeme += self._advance()
                elif ch == '<':
                    state = State.IN_LT
                    lexeme += self._advance()
                elif ch == '>':
                    state = State.IN_GT
                    lexeme += self._advance()
                elif ch == '&':
                    state = State.IN_AMP
                    lexeme += self._advance()
                elif ch == '|':
                    state = State.IN_PIPE
                    lexeme += self._advance()
                elif ch in SEPARATORS:
                    self._advance()
                    return Token(SEPARATORS[ch], ch, token_line, token_col)
                else:
                    self._advance()
                    raise LexError(f'非法字符: {ch!r}', token_line, token_col)

            # ========== IN_ID：标识符/关键字 ==========
            elif state == State.IN_ID:
                if ch is not None and (ch.isalpha() or ch.isdigit() or ch == '_'):
                    lexeme += self._advance()
                else:
                    # 接受：查关键字表，否则为标识符
                    if lexeme in KEYWORDS:
                        return Token(KEYWORDS[lexeme], lexeme, token_line, token_col)
                    return Token('标识符', lexeme, token_line, token_col)

            # ========== IN_INT：整数部分 ==========
            elif state == State.IN_INT:
                if ch is not None and ch.isdigit():
                    lexeme += self._advance()
                elif ch == '.':
                    # 整数后跟小数点 → 进入小数点状态
                    state = State.IN_DOT
                    lexeme += self._advance()
                elif ch is not None and ch in 'eE':
                    # 整数后跟指数符号 → 进入指数状态
                    state = State.IN_E
                    lexeme += self._advance()
                else:
                    # 接受：整数
                    return Token('整数', lexeme, token_line, token_col)

            # ========== IN_DOT：读到小数点 ==========
            elif state == State.IN_DOT:
                if ch is not None and ch.isdigit():
                    # 小数点后有数字 → 进入小数部分
                    state = State.IN_FRAC
                    lexeme += self._advance()
                else:
                    raise LexError(
                        f'小数点后需要数字（当前词素: {lexeme!r}）',
                        token_line, token_col)

            # ========== IN_FRAC：小数部分 ==========
            elif state == State.IN_FRAC:
                if ch is not None and ch.isdigit():
                    lexeme += self._advance()
                elif ch is not None and ch in 'eE':
                    state = State.IN_E
                    lexeme += self._advance()
                else:
                    # 接受：浮点数（含小数）
                    return Token('浮点数', lexeme, token_line, token_col)

            # ========== IN_E：指数符号 e/E ==========
            elif state == State.IN_E:
                if ch is not None and ch in '+-':
                    state = State.IN_EXP_SIGN
                    lexeme += self._advance()
                elif ch is not None and ch.isdigit():
                    state = State.IN_EXP
                    lexeme += self._advance()
                else:
                    raise LexError(
                        f'指数符号后需要数字或 +/-（当前词素: {lexeme!r}）',
                        token_line, token_col)

            # ========== IN_EXP_SIGN：指数正/负号 ==========
            elif state == State.IN_EXP_SIGN:
                if ch is not None and ch.isdigit():
                    state = State.IN_EXP
                    lexeme += self._advance()
                else:
                    raise LexError(
                        f'指数符号后缺少数字（当前词素: {lexeme!r}）',
                        token_line, token_col)

            # ========== IN_EXP：指数数字（接受状态） ==========
            elif state == State.IN_EXP:
                if ch is not None and ch.isdigit():
                    lexeme += self._advance()
                else:
                    # 接受：浮点数（含指数）
                    return Token('浮点数', lexeme, token_line, token_col)

            # ========== IN_PLUS：读到 + ==========
            elif state == State.IN_PLUS:
                if ch == '+':
                    self._advance()
                    return Token(OPERATORS['++'], '++', token_line, token_col)
                elif ch == '=':
                    self._advance()
                    return Token(OPERATORS['+='], '+=', token_line, token_col)
                else:
                    return Token(OPERATORS['+'], '+', token_line, token_col)

            # ========== IN_MINUS：读到 - ==========
            elif state == State.IN_MINUS:
                if ch == '-':
                    self._advance()
                    return Token(OPERATORS['--'], '--', token_line, token_col)
                elif ch == '=':
                    self._advance()
                    return Token(OPERATORS['-='], '-=', token_line, token_col)
                else:
                    return Token(OPERATORS['-'], '-', token_line, token_col)

            # ========== IN_STAR：读到 * ==========
            elif state == State.IN_STAR:
                if ch == '=':
                    self._advance()
                    return Token(OPERATORS['*='], '*=', token_line, token_col)
                else:
                    return Token(OPERATORS['*'], '*', token_line, token_col)

            # ========== IN_SLASH：读到 / ==========
            elif state == State.IN_SLASH:
                if ch == '/':
                    # 行注释：// 后直到换行
                    state = State.IN_LINE_CMT
                    lexeme = ''
                    self._advance()
                elif ch == '*':
                    # 块注释：/* ... */
                    state = State.IN_BLK_CMT
                    lexeme = ''
                    self._advance()
                elif ch == '=':
                    self._advance()
                    return Token(OPERATORS['/='], '/=', token_line, token_col)
                else:
                    return Token(OPERATORS['/'], '/', token_line, token_col)

            # ========== IN_LINE_CMT：行注释 // ==========
            elif state == State.IN_LINE_CMT:
                if ch is None or ch == '\n':
                    # 注释结束（行尾或 EOF）→ 回到 START
                    if ch == '\n':
                        self._advance()
                    state = State.START
                    lexeme = ''
                    token_line = self.line
                    token_col = self.col
                else:
                    self._advance()

            # ========== IN_BLK_CMT：块注释 /* ... */ ==========
            elif state == State.IN_BLK_CMT:
                if ch is None:
                    # EOF 出现在未闭合的块注释中，发出警告后静默结束
                    print('[警告] 块注释未正常关闭（文件已到达末尾）',
                          file=sys.stderr)
                    return None
                elif ch == '*':
                    state = State.IN_BLK_STAR
                    self._advance()
                else:
                    self._advance()

            # ========== IN_BLK_STAR：块注释中遇到 * ==========
            elif state == State.IN_BLK_STAR:
                if ch == '/':
                    # */ → 注释结束，回到 START
                    self._advance()
                    state = State.START
                    lexeme = ''
                    token_line = self.line
                    token_col = self.col
                elif ch == '*':
                    # 连续 * → 保持 IN_BLK_STAR，继续等待 /
                    self._advance()
                else:
                    # 非 / → 回到注释正文状态
                    state = State.IN_BLK_CMT
                    if ch is not None:
                        self._advance()

            # ========== IN_ASSIGN：读到 = ==========
            elif state == State.IN_ASSIGN:
                if ch == '=':
                    self._advance()
                    return Token(OPERATORS['=='], '==', token_line, token_col)
                else:
                    return Token(OPERATORS['='], '=', token_line, token_col)

            # ========== IN_NOT：读到 ! ==========
            elif state == State.IN_NOT:
                if ch == '=':
                    self._advance()
                    return Token(OPERATORS['!='], '!=', token_line, token_col)
                else:
                    return Token(OPERATORS['!'], '!', token_line, token_col)

            # ========== IN_LT：读到 < ==========
            elif state == State.IN_LT:
                if ch == '=':
                    self._advance()
                    return Token(OPERATORS['<='], '<=', token_line, token_col)
                else:
                    return Token(OPERATORS['<'], '<', token_line, token_col)

            # ========== IN_GT：读到 > ==========
            elif state == State.IN_GT:
                if ch == '=':
                    self._advance()
                    return Token(OPERATORS['>='], '>=', token_line, token_col)
                else:
                    return Token(OPERATORS['>'], '>', token_line, token_col)

            # ========== IN_AMP：读到 & ==========
            elif state == State.IN_AMP:
                if ch == '&':
                    self._advance()
                    return Token(OPERATORS['&&'], '&&', token_line, token_col)
                else:
                    raise LexError(
                        f'非法字符: &（期望 &&）',
                        token_line, token_col)

            # ========== IN_PIPE：读到 | ==========
            elif state == State.IN_PIPE:
                if ch == '|':
                    self._advance()
                    return Token(OPERATORS['||'], '||', token_line, token_col)
                else:
                    raise LexError(
                        f'非法字符: |（期望 ||）',
                        token_line, token_col)

    # ----------------------------------------------------------
    # 公开接口：对整个源文件进行词法分析
    # ----------------------------------------------------------

    def tokenize(self) -> List[Token]:
        """
        对整个源文件进行词法分析，返回 Token 列表。

        遇到词法错误时，先输出已识别的所有 Token，再打印错误位置，
        然后以退出码 1 结束（符合题目"最长匹配"输出要求）。
        """
        tokens: List[Token] = []
        try:
            while True:
                token = self.next_token()
                if token is None:
                    break
                tokens.append(token)
        except LexError as e:
            # 先输出已识别部分
            for t in tokens:
                print(t)
            # 再输出错误信息（含行列号）
            print(f'\n[词法错误] 行{e.line}, 列{e.col}: {e.message}',
                  file=sys.stderr)
            sys.exit(1)
        return tokens


# ============================================================
# 主程序入口
# ============================================================

def main() -> None:
    if len(sys.argv) < 2:
        print('用法: python3 lexer.py <源文件路径>')
        print('示例: python3 lexer.py test.simple')
        sys.exit(1)

    filename = sys.argv[1]
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            source = f.read()
    except FileNotFoundError:
        print(f'错误: 找不到文件 {filename!r}', file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f'错误: 读取文件失败 — {e}', file=sys.stderr)
        sys.exit(1)

    lexer = Lexer(source)
    tokens = lexer.tokenize()
    for token in tokens:
        print(token)


if __name__ == '__main__':
    main()
