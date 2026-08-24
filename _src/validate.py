#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""組み立てたページのタグが正しく閉じているかを検査する

閉じ忘れがあると、以降の中身が別の箱の中に入り込んで表示が崩れる。
見た目でしか気づけない壊れ方なので、公開前に必ず機械で確かめる。
"""

import glob
import os
from html.parser import HTMLParser

# 閉じタグを書かない要素
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "source", "track", "wbr"}


class _Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.errors = [], []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append(f"余分な </{tag}>")
        elif self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            while self.stack and self.stack[-1] != tag:
                self.errors.append(f"<{self.stack.pop()}> が閉じていない")
            self.stack.pop()
        else:
            self.errors.append(f"対応する開始タグのない </{tag}>")


def check_dir(directory):
    """壊れているページの一覧を返す（空なら全て正常）"""
    broken = []
    for path in sorted(glob.glob(os.path.join(directory, "*.html"))):
        c = _Checker()
        c.feed(open(path, encoding="utf-8").read())
        unclosed = [t for t in c.stack if t not in ("html", "body")]
        if c.errors or unclosed:
            detail = c.errors[:3] + [f"<{t}> が閉じていない" for t in unclosed]
            broken.append((os.path.basename(path), detail))
    return broken
