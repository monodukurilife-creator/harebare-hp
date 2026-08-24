#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
microCMS からトピックス記事を取り込む

橋本さんたちが microCMS で書いた記事を build.py が使える形にして返す。
記事の写真はここで site/images/topics/ へ保存するので、サイトを見に来た人は
Netlify から写真を受け取る（microCMS の転送量を使わない）。

必要な環境変数:
    MICROCMS_SERVICE_ID   例: haretobare
    MICROCMS_API_KEY      読み取り(GET)専用のキー

環境変数がない・microCMS に繋がらない場合は、前回取得した内容
（topics_cache.json）でページを作る。記事が消えたサイトを公開しないための保険。
"""

import json
import os
import re
import sys
import urllib.request

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
IMG_DIR = os.path.join(ROOT, "site", "images", "topics")
CACHE = os.path.join(SRC, "topics_cache.json")

# 保存する写真の最大幅。これより大きい写真は縮めて受け取る
MAX_WIDTH = 1600


def _load_env_file():
    """手元で動かすとき用に、プロジェクト直下の .env を読む

    Netlify では管理画面で設定した環境変数が使われるので、この読み込みは働かない。
    """
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_env_file()

# microCMS は Python 既定の User-Agent を 403 で拒否するため、必ず指定する
USER_AGENT = "harebare-site-builder/1.0"

SERVICE = os.environ.get("MICROCMS_SERVICE_ID", "")
API_KEY = os.environ.get("MICROCMS_API_KEY", "")


def _fetch_from_microcms():
    """microCMS から公開済みの記事を新しい順に取得する"""
    if not SERVICE or not API_KEY:
        raise RuntimeError("MICROCMS_SERVICE_ID または MICROCMS_API_KEY が未設定です")
    url = f"https://{SERVICE}.microcms.io/api/v1/topics?limit=100&orders=-date"
    req = urllib.request.Request(url, headers={"X-MICROCMS-API-KEY": API_KEY,
                                               "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["contents"]


def _local_name(url):
    """microCMS の写真URLから、重複しないファイル名を作る

    写真を差し替えると別名になるので、ブラウザが古い写真を出し続けることがない。
    """
    parts = url.split("?")[0].rstrip("/").split("/")
    base = re.sub(r"[^A-Za-z0-9._-]", "_", parts[-1])
    uniq = parts[-2][:12] if len(parts) >= 2 else "img"
    return f"{uniq}-{base}"


def _download(url, used):
    """写真を site/images/topics/ に保存して、HTMLから参照するパスを返す

    'local:images/xxx.jpg' の形（もともとサイトにある写真）はそのまま使う。
    """
    if url.startswith("local:"):
        return url[len("local:"):]

    name = _local_name(url)
    used.add(name)
    dest = os.path.join(IMG_DIR, name)
    if not os.path.exists(dest):
        os.makedirs(IMG_DIR, exist_ok=True)
        img = urllib.request.Request(f"{url}?w={MAX_WIDTH}", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(img, timeout=60) as r, \
             open(dest, "wb") as f:
            f.write(r.read())
        print(f"  写真を取得: {name}")
    return f"images/topics/{name}"


def _rewrite_body(html, used):
    """本文中の microCMS の写真を、保存したものへ差し替える"""
    def rep(m):
        return 'src="%s"' % _download(m.group(1), used)
    return re.sub(r'src="(https://images\.microcms-assets\.io/[^"]+?)"', rep, html)


def _sweep(used):
    """使われなくなった写真を site/images/topics/ から片付ける"""
    if not os.path.isdir(IMG_DIR):
        return
    for f in os.listdir(IMG_DIR):
        if f not in used and not f.startswith("."):
            os.remove(os.path.join(IMG_DIR, f))
            print(f"  不要な写真を削除: {f}")


def _format_date(iso):
    """2026-08-06T00:00:00.000Z → ('2026-08-06', '2026.08.06')"""
    ymd = iso[:10]
    return ymd, ymd.replace("-", ".")


def load_topics():
    """記事の一覧を新しい順に返す"""
    try:
        contents = _fetch_from_microcms()
        with open(CACHE, "w", encoding="utf-8") as f:
            json.dump(contents, f, ensure_ascii=False, indent=1)
        print(f"microCMS から記事を {len(contents)} 件取得しました")
    except Exception as e:
        if not os.path.exists(CACHE):
            print(f"[中断] microCMS から取得できず、控えもありません: {e}", file=sys.stderr)
            raise
        with open(CACHE, encoding="utf-8") as f:
            contents = json.load(f)
        print(f"[注意] microCMS から取得できませんでした（{e}）。"
              f"前回の控え {len(contents)} 件でページを作ります", file=sys.stderr)

    topics, used = [], set()
    for c in contents:
        ymd, dot = _format_date(c["date"])
        # セレクトフィールドは配列で返ってくる
        category = c.get("category")
        if isinstance(category, list):
            category = category[0] if category else None
        topics.append({
            "id": c["id"],
            "file": f"topic-{c['id']}.html",
            "title": c["title"],
            "category": category or "お知らせ",
            "excerpt": c["excerpt"],
            "date": ymd,
            "date_dot": dot,
            "image": _download(c["thumbnail"]["url"], used),
            "body": _rewrite_body(c["body"], used),
        })

    _sweep(used)
    return topics
