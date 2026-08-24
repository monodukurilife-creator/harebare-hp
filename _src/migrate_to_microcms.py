#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""既存の記事（topics_cache.json）を microCMS へ流し込む一度きりの道具

記事本文の写真もすべて microCMS のメディアへ登録し、本文中の参照先を書き換える。
移行後は microCMS 側が記事の正本になる。
"""
import json, mimetypes, os, re, sys, urllib.request, uuid

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
sys.path.insert(0, SRC)
from topics_source import SERVICE, API_KEY, USER_AGENT  # .env を読み込んだ状態で入ってくる

CACHE = os.path.join(SRC, "topics_cache.json")
MEDIA_URL = f"https://{SERVICE}.microcms-management.io/api/v1/media"
CONTENT_URL = f"https://{SERVICE}.microcms.io/api/v1/topics"

uploaded = {}   # ローカルのパス → microCMS のURL（同じ写真を二度上げない）


def _send(url, data, headers, method="POST"):
    headers = {**headers, "User-Agent": USER_AGENT}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r) if r.status != 204 else {}


def upload(local_path):
    """サイト内の写真を microCMS のメディアへ登録して、そのURLを返す"""
    if local_path in uploaded:
        return uploaded[local_path]

    full = os.path.join(ROOT, local_path)
    if not os.path.exists(full):
        sys.exit(f"[中断] 写真が見つかりません: {local_path}")

    name = os.path.basename(full)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{name}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + open(full, "rb").read() + f"\r\n--{boundary}--\r\n".encode()

    res = _send(MEDIA_URL, body, {
        "X-MICROCMS-API-KEY": API_KEY,
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    })
    uploaded[local_path] = res["url"]
    print(f"    写真を登録: {name}")
    return res["url"]


def rewrite_body(html):
    """本文中の写真を microCMS のものに差し替える"""
    return re.sub(r'src="(images/[^"]+)"', lambda m: 'src="%s"' % upload(m.group(1)), html)


def main():
    if not API_KEY:
        sys.exit("[中断] .env に MICROCMS_API_KEY がありません")

    items = json.load(open(CACHE, encoding="utf-8"))
    print(f"移行する記事: {len(items)} 本\n")

    for c in items:
        print(f"  {c['title'][:34]}…")
        thumb_local = c["thumbnail"]["url"].replace("local:", "")
        payload = {
            "title": c["title"],
            "date": c["date"],
            "category": [c["category"]],   # セレクトフィールドは配列で渡す
            "excerpt": c["excerpt"],
            "thumbnail": upload(thumb_local),
            "body": rewrite_body(c["body"]),
        }
        # 記事IDを指定して作る。URLが topic-<記事ID>.html になるので、
        # 意味の分かる英数字にしておく（検索にも人にも優しい）
        _send(f"{CONTENT_URL}/{c['id']}?status=published",
              json.dumps(payload, ensure_ascii=False).encode(),
              {"X-MICROCMS-API-KEY": API_KEY, "Content-Type": "application/json"},
              method="PUT")
        print(f"    登録しました（記事ID: {c['id']}）\n")

    print("移行が完了しました")


if __name__ == "__main__":
    main()
