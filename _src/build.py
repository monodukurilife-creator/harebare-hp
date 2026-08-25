#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
合同会社晴々サイトの組み立て

やること:
  1. 直下の手書きページ（index.html など）を site/ へそのまま写す
  2. microCMS のトピックス記事から、一覧ページと記事ページを作り直す
  3. sitemap.xml のトピックス部分を作り直す

公開されるのは site/ の中身だけ。直下のファイルを直せば、そのまま反映される。
記事だけは microCMS 側で書く（直下に topic-*.html を置いても上書きされる）。
"""

import html
import os
import re
import shutil
import sys

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
SITE = os.path.join(ROOT, "site")
BASE_URL = "https://www.haretobare.com"

sys.path.insert(0, SRC)
from topics_source import load_topics  # noqa: E402
from validate import check_dir  # noqa: E402

# site/ へ写さないもの（開発用の道具や秘密情報）
SKIP = {"_src", "site", ".git", ".github", ".netlify", ".env", ".gitignore",
        "netlify.toml", ".DS_Store", "__pycache__", "node_modules"}


def copy_sources():
    """直下の手書きページを site/ へ写す"""
    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE)

    for name in sorted(os.listdir(ROOT)):
        if name in SKIP or name.startswith("_") or name.endswith(".md"):
            continue
        src, dst = os.path.join(ROOT, name), os.path.join(SITE, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # 記事ページは microCMS から作り直すので、写したものは捨てる
    for f in os.listdir(SITE):
        if f.startswith("topic-") and f.endswith(".html"):
            os.remove(os.path.join(SITE, f))

    print(f"手書きページを site/ に写しました")


def read_shell():
    """全ページ共通の外枠（ヘッダー・フッター）を topics.html から借りる

    ヘッダーを直したときに、記事ページにも自動でついてくるようにするため。
    """
    src = open(os.path.join(ROOT, "topics.html"), encoding="utf-8").read()

    # ヘッダーの中にも <nav> があるので、モバイルメニューの終わりまでを外枠とする。
    # 最初の </nav> で切るとヘッダーが閉じないまま記事が始まり、表示が崩れる。
    top = re.search(r'(<body>.*?<nav class="mobile-nav".*?</nav>\n)', src, re.S)
    bottom = re.search(r"(<footer>.*)", src, re.S)
    if not top or not bottom:
        sys.exit("[中断] topics.html からヘッダー・フッターを読み取れませんでした")
    return top.group(1), bottom.group(1)


def esc(s):
    return html.escape(s, quote=True)


def split_title(title):
    """「主題｜副題」を2行に分ける。区切りがなければそのまま1行"""
    if "｜" in title:
        a, b = title.split("｜", 1)
        return f"{esc(a)}<br>{esc(b)}"
    return esc(title)


def short_title(title):
    return title.split("｜", 1)[0]


def build_article(t, shell_top, shell_bottom):
    """記事ページ1本分のHTMLを組み立てる"""
    url = f"{BASE_URL}/{t['file']}"
    head = f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(t['title'])} | 合同会社晴々</title>
<meta name="description" content="{esc(t['excerpt'])}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="合同会社晴々">
<meta property="og:title" content="{esc(t['title'])}">
<meta property="og:description" content="{esc(t['excerpt'])}">
<meta property="og:image" content="{BASE_URL}/{esc(t['image'])}">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="{url}">
<link rel="canonical" href="{url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(t['title'])}">
<meta name="twitter:description" content="{esc(t['excerpt'])}">
<meta name="twitter:image" content="{BASE_URL}/{esc(t['image'])}">

<link rel="icon" href="/favicon.ico" sizes="any">\n<link rel="icon" type="image/png" href="images/logo-mark.png">\n<link rel="apple-touch-icon" href="images/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<noscript><style>.reveal,.eyebrow,h1.hero-title,.hero-sub,.hero-cta{{transform:none !important; animation:none !important;}}</style></noscript>

<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {{"@type": "ListItem", "position": 1, "name": "ホーム", "item": "{BASE_URL}/"}},
    {{"@type": "ListItem", "position": 2, "name": "トピックス", "item": "{BASE_URL}/topics.html"}},
    {{"@type": "ListItem", "position": 3, "name": "{esc(short_title(t['title']))}", "item": "{url}"}}
  ]
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "{esc(t['title'])}",
  "description": "{esc(t['excerpt'])}",
  "datePublished": "{t['date']}",
  "dateModified": "{t['date']}",
  "author": {{"@type": "Organization", "name": "合同会社晴々"}},
  "publisher": {{"@type": "Organization", "name": "合同会社晴々", "logo": {{"@type": "ImageObject", "url": "{BASE_URL}/images/logo-mark.png"}}}},
  "image": "{BASE_URL}/{esc(t['image'])}",
  "mainEntityOfPage": "{url}"
}}
</script>
</head>
"""

    main = f"""
<section class="page-head">
  <div class="wrap">
    <div class="breadcrumb"><a href="index.html">ホーム</a> ／ <a href="topics.html">トピックス</a> ／ {esc(short_title(t['title']))}</div>
    <div class="topic-meta" style="margin-bottom:16px;">
      <time datetime="{t['date']}">{t['date_dot']}</time>
      <span class="tag">{esc(t['category'])}</span>
    </div>
    <h1>{split_title(t['title'])}</h1>
    <p class="lead">{esc(t['excerpt'])}</p>
  </div>
</section>

<div class="wrap">
  <div class="article-hero-img reveal">
    <img src="{esc(t['image'])}" alt="{esc(short_title(t['title']))}" width="1000" height="420" loading="lazy">
  </div>
</div>

<section>
  <div class="wrap">
    <div class="article-body reveal">
{t['body']}
    </div>
  </div>
</section>

<section class="page-end-cta">
  <div class="wrap">
    <p style="font-size:15.5px; color:var(--hare-ink-soft); margin-bottom:20px;">気になることがあれば、まずは現状のお悩みをお聞かせください。</p>
    <button class="btn btn-primary" onclick="openHare()">HARE AIに相談する</button>
    <a href="services.html" class="btn btn-outline" style="margin-left:12px;">サービスを見る</a>
  </div>
</section>

"""
    return head + shell_top + main + shell_bottom


def build_list(topics):
    """トピックス一覧ページの記事リスト部分を作り直す"""
    path = os.path.join(SITE, "topics.html")
    src = open(path, encoding="utf-8").read()

    cards = []
    for t in topics:
        cards.append(f"""      <a class="topic-card" href="{t['file']}">
        <div class="topic-thumb"><img src="{esc(t['image'])}" alt="{esc(short_title(t['title']))}" loading="lazy" width="220" height="140"></div>
        <div class="topic-card-body">
          <div class="topic-meta">
            <time datetime="{t['date']}">{t['date_dot']}</time>
            <span class="tag">{esc(t['category'])}</span>
          </div>
          <h3>{esc(t['title'])}</h3>
          <p>{esc(t['excerpt'])}</p>
        </div>
      </a>""")

    body = "\n".join(cards) if cards else \
        '      <p class="section-lead">記事を準備しています。もうしばらくお待ちください。</p>'

    new, n = re.subn(r'(<div class="topic-list reveal">\n).*?(\n    </div>)',
                     lambda m: m.group(1) + body + m.group(2), src, flags=re.S)
    if n != 1:
        sys.exit("[中断] topics.html の記事リスト部分が見つかりませんでした")

    open(path, "w", encoding="utf-8").write(new)


def build_sitemap(topics):
    """sitemap.xml のトピックス記事の行を作り直す"""
    path = os.path.join(SITE, "sitemap.xml")
    if not os.path.exists(path):
        return
    src = open(path, encoding="utf-8").read()

    # 既存のトピックス記事の <url> をいったん全部消す
    src = re.sub(r"  <url>\s*<loc>[^<]*?/topic-[^<]*</loc>.*?</url>\n", "", src, flags=re.S)

    entries = "".join(
        f"""  <url>
    <loc>{BASE_URL}/{t['file']}</loc>
    <lastmod>{t['date']}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n""" for t in topics)

    src = src.replace("</urlset>", entries + "</urlset>")
    open(path, "w", encoding="utf-8").write(src)


def main():
    copy_sources()
    topics = load_topics()
    shell_top, shell_bottom = read_shell()

    for t in topics:
        with open(os.path.join(SITE, t["file"]), "w", encoding="utf-8") as f:
            f.write(build_article(t, shell_top, shell_bottom))
        print(f"  記事ページ: {t['file']}")

    build_list(topics)
    build_sitemap(topics)

    # 壊れたページを公開しないための最終検査
    broken = check_dir(SITE)
    if broken:
        print("\n[中断] タグが正しく閉じていないページがあります", file=sys.stderr)
        for name, detail in broken:
            print(f"  {name}: {' / '.join(detail)}", file=sys.stderr)
        sys.exit(1)

    print(f"\n完成しました。記事 {len(topics)} 本を含む site/ ができています（全ページのタグ検査に合格）")


if __name__ == "__main__":
    main()
