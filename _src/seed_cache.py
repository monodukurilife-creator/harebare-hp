#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""既存の手作り記事ページ（topic-*.html）から記事データを取り出して控えに入れる

microCMS を用意する前でもサイトを組み立てられるようにするための、最初の1回だけ動かす道具。
microCMS が使えるようになったら、この控えは自動的に上書きされる。
"""
import json, os, re, sys

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
CACHE = os.path.join(SRC, "topics_cache.json")

SOURCES = [
    ("ai-productivity", "topic-ai-productivity.html"),
    ("sns-not-ads", "topic-sns-not-ads.html"),
]

def pick(pattern, text, label, flags=0):
    m = re.search(pattern, text, flags)
    if not m:
        sys.exit(f"[中断] {label} が見つかりませんでした")
    return m.group(1).strip()

items = []
for cid, filename in SOURCES:
    path = os.path.join(ROOT, filename)
    if not os.path.exists(path):
        sys.exit(f"[中断] {filename} がありません")
    html = open(path, encoding="utf-8").read()

    title = pick(r"<title>(.*?)\s*\|\s*合同会社晴々</title>", html, f"{filename} のタイトル")
    date = pick(r'<time datetime="([\d-]+)"', html, f"{filename} の日付")
    excerpt = pick(r'<meta name="description" content="(.*?)">', html, f"{filename} の説明文")
    thumb = pick(r'<div class="article-hero-img[^"]*">\s*<img src="([^"]+)"', html,
                 f"{filename} の写真", re.S)
    category = pick(r'<div class="topic-meta"[^>]*>.*?<span class="tag">(.*?)</span>', html,
                    f"{filename} のカテゴリ", re.S)
    body = pick(r'<div class="article-body[^"]*">(.*?)\n    </div>', html,
                f"{filename} の本文", re.S)

    items.append({
        "id": cid,
        "title": title,
        "date": f"{date}T00:00:00.000Z",
        "category": category,
        "excerpt": excerpt,
        "thumbnail": {"url": "local:" + thumb},
        "body": body.strip(),
    })
    print(f"取り出しました: {filename} → {title[:30]}…")

items.sort(key=lambda x: x["date"], reverse=True)
with open(CACHE, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False, indent=1)
print(f"\n控えに {len(items)} 件を保存しました: {CACHE}")
