#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
事事顺酒 · 网站 DIY 后台（本地服务）
=======================================

纯 Python 标准库实现，无需 pip 安装任何依赖。
作用：在本机启动一个可视化管理后台，用于编辑网站的文字、图片、导航菜单、
产品文案与任意源文件，并支持一键部署（git 提交+推送）。

启动方式（任选其一）：
  - 双击 start.command（macOS）
  - 终端运行：python3 server.py
  - Windows：双击 start.bat

后台地址： http://127.0.0.1:8080
 preview ： http://127.0.0.1:8080/site/index.html

注意：本服务仅在本机（127.0.0.1）监听，不会对外暴露，请放心使用。
"""

import os
import re
import sys
import json
import shutil
import subprocess
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

# ---------- 路径定义 ----------
# server.py 位于 <站点根目录>/admin/ 下
ADMIN_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ADMIN_DIR)            # 站点根目录（含 index.html）
STATIC_DIR = os.path.join(ADMIN_DIR, "static")
UPLOAD_DIR = os.path.join(ROOT, "assets", "images", "uploads")

try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    pass

DEFAULT_PORT = 8080

# 允许在网页里直接编辑的文件（白名单，防止越权写文件）
EDITABLE_FILES = {
    "index.html": os.path.join(ROOT, "index.html"),
    "assets/css/style.css": os.path.join(ROOT, "assets", "css", "style.css"),
    "assets/js/main.js": os.path.join(ROOT, "assets", "js", "main.js"),
}

LABELS = {
    "hero-eyebrow": "首屏·出品方署名",
    "hero-title-1": "首屏·主标题第一行",
    "hero-title-2": "首屏·主标题第二行",
    "hero-desc": "首屏·引导文案",
    "intro-eyebrow": "引言·小标题",
    "intro-title-1": "引言·主标题",
    "story-title": "品牌故事·标题",
    "story-lead": "品牌故事·导语",
    "honors-title": "品牌荣誉·标题",
    "honors-desc": "品牌荣誉·描述",
    "culture-title": "吉祥文化·标题",
    "culture-desc": "吉祥文化·描述",
    "editorial-h": "顺文化·主标题",
    "editorial-p1": "顺文化·正文一",
    "editorial-p2": "顺文化·正文二",
    "flagships-title": "四大旗舰·标题",
    "craft-title": "匠心酿造·标题",
    "craft-sub": "匠心酿造·副标题",
    "moments-title": "顺意时刻·标题",
    "news-title": "品牌动态·标题",
    "partner-title": "招商合作·标题",
    "partner-sub": "招商合作·副标题",
    "footer-brand": "页脚·品牌语",
    "footer-bottom": "页脚·版权声明",
    "hero-bg": "首屏·背景大图",
    "honor-medal": "品牌荣誉·奖章图",
    "culture-img": "吉祥文化·图腾图",
    "editorial-river": "顺文化·老子临水图",
    "product-365": "产品·事事顺365瓶身",
    "product-516": "产品·事事顺516瓶身",
    "product-china-red": "产品·中国红瓶身",
    "product-family": "产品·家顺瓶身",
    "moments-photo": "顺意时刻·场景图",
    "craft-grains": "匠心·五粮图",
    "craft-cellar": "匠心·老窖池图",
    "craft-well": "匠心·无极之水图",
    "craft-master": "匠心·老师傅图",
    "news-1": "动态·图一",
    "news-2": "动态·图二",
    "news-3": "动态·图三",
    "nav-logo": "导航·Logo",
    "footer-logo": "页脚·Logo",
}


def friendly_label(key):
    return LABELS.get(key, key)


# ---------- HTML 解析辅助 ----------
def read_index():
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as f:
        return f.read()


def write_index(html):
    with open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)


# 标签边界匹配（用于按标签配对，支持嵌套）
# group(1)=斜杠(空或'/')，group(2)=标签名
TAG_RE = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>')


def _opening_tag(html, attr):
    """返回包含 attr 的起始标签的 (start, end) 索引。"""
    pos = html.find(attr)
    if pos == -1:
        return None
    ts = html.rfind('<', 0, pos)
    te = html.find('>', ts)
    return ts, te


def _closing_bounds(html, ts, te):
    """给定起始标签，返回其内部内容 (content_start, content_end)（按标签配对）。"""
    m = re.match(r'</?([a-zA-Z][a-zA-Z0-9]*)', html[ts:te + 1])
    if not m:
        return None
    tagname = m.group(1).lower()
    content_start = te + 1
    depth = 1
    for tm in TAG_RE.finditer(html, content_start):
        if tm.group(2).lower() != tagname:
            continue
        if tm.group(1) == '/':
            depth -= 1
            if depth == 0:
                return content_start, tm.start()
        else:
            depth += 1
    return None


def extract_blocks(html):
    """提取所有 data-sss 标记的编辑单元（支持嵌套标签）。"""
    blocks = []
    for m in re.finditer(r'data-sss="(text|image):([^"]+)"', html):
        kind, key = m.group(1), m.group(2)
        ob = _opening_tag(html, m.group(0))
        if not ob:
            continue
        ts, te = ob
        if kind == "text":
            cb = _closing_bounds(html, ts, te)
            value = html[cb[0]:cb[1]] if cb else ""
        else:
            sm = re.search(r'src="([^"]*)"', html[ts:te + 1])
            value = sm.group(1) if sm else ""
        blocks.append(
            {"id": kind + ":" + key, "type": kind, "label": friendly_label(key), "value": value}
        )
    return blocks


def save_block(html, block_id, value):
    if ":" not in block_id:
        return html, 0
    kind, key = block_id.split(":", 1)
    attr = 'data-sss="%s:%s"' % (kind, key)
    ob = _opening_tag(html, attr)
    if not ob:
        return html, 0
    ts, te = ob
    if kind == "text":
        cb = _closing_bounds(html, ts, te)
        if not cb:
            return html, 0
        new_html = html[:cb[0]] + value + html[cb[1]:]
        return new_html, 1
    elif kind == "image":
        seg = html[ts:te + 1]
        new_seg = re.sub(r'src="[^"]*"', 'src="%s"' % value.replace('"', '\\"'), seg, count=1)
        new_html = html[:ts] + new_seg + html[te + 1:]
        return new_html, 1
    return html, 0


# ---------- 菜单 ----------
def extract_menu(html):
    m = re.search(r'<nav class="nav-menu" id="navMenu">(.*?)</nav>', html, re.DOTALL)
    if not m:
        return []
    inner = m.group(1)
    items = []
    for link in re.finditer(r'<a\s+([^>]*)>(.*?)</a>', inner, re.DOTALL):
        attrs = link.group(1)
        label = re.sub(r"<[^>]+>", "", link.group(2)).strip()
        href = ""
        hm = re.search(r'href="([^"]*)"', attrs)
        if hm:
            href = hm.group(1)
        cta = 'nav-cta' in attrs
        items.append({"label": label, "href": href, "cta": cta})
    return items


def save_menu(html, items):
    m = re.search(r'<nav class="nav-menu" id="navMenu">(.*?)</nav>', html, re.DOTALL)
    if not m:
        return html, 0
    parts = []
    for it in items:
        label = it.get("label", "").strip()
        href = it.get("href", "").strip()
        cls = ' class="nav-cta"' if it.get("cta") else ""
        parts.append('      <a href="%s"%s>%s</a>' % (href, cls, label))
    inner = "\n".join(parts)
    new_html = html[: m.start(1)] + inner + html[m.end(1):]
    return new_html, 1


def add_section(html, sec_id, title):
    section = (
        '\n\n<!-- 自定义栏目（后台添加） -->\n'
        '<section class="section" id="%s">\n'
        '  <div class="container">\n'
        '    <div class="section-head reveal">\n'
        '      <p class="section-eyebrow">CUSTOM</p>\n'
        '      <h2 class="section-title" data-sss="text:%s-title">%s</h2>\n'
        '      <div class="gold-divider"><i></i><span>❖</span><i></i></div>\n'
        '    </div>\n'
        '    <p class="reveal" data-sss="text:%s-body">在这里填写栏目内容，可在「文字区块」中继续编辑。</p>\n'
        '  </div>\n'
        '</section>\n'
    ) % (sec_id, sec_id, title, sec_id)
    if "</body>" in html:
        new_html = html.replace("</body>", section + "</body>", 1)
    else:
        new_html = html + section
    return new_html


# ---------- 产品文案（main.js）----------
def extract_products():
    path = os.path.join(ROOT, "assets", "js", "main.js")
    if not os.path.exists(path):
        return []
    js = open(path, encoding="utf-8").read()
    m = re.search(r"var products\s*=\s*\{(.*?)\n  \};", js, re.DOTALL)
    if not m:
        return []
    block = m.group(1)
    products = []
    for entry in re.finditer(r'"([\w-]+)":\s*\{(.*?)\n    \}', block, re.DOTALL):
        key = entry.group(1)
        fields = dict(re.findall(r'(\w+):\s*"([^"]*)"', entry.group(2)))
        products.append(
            {
                "key": key,
                "meaning": fields.get("meaning", ""),
                "name": fields.get("name", ""),
                "copy": fields.get("copy", ""),
                "spec": fields.get("spec", ""),
            }
        )
    return products


def save_products(products):
    path = os.path.join(ROOT, "assets", "js", "main.js")
    js = open(path, encoding="utf-8").read()
    pat = re.compile(r"var products\s*=\s*\{.*?\n  \};", re.DOTALL)
    if not pat.search(js):
        return js, 0
    lines = ["  var products = {"]
    for i, p in enumerate(products):
        comma = "," if i < len(products) - 1 else ""
        lines.append('    "%s": {' % p.get("key", ""))
        lines.append('      meaning: "%s",' % p.get("meaning", "").replace('"', '\\"'))
        lines.append('      name: "%s",' % p.get("name", "").replace('"', '\\"'))
        lines.append('      copy: "%s",' % p.get("copy", "").replace('"', '\\"'))
        lines.append('      spec: "%s"' % p.get("spec", "").replace('"', '\\"'))
        lines.append("    }" + comma)
    lines.append("  };")
    new_block = "\n".join(lines)
    new_js = pat.sub(new_block, js, count=1)
    return new_js, 1


# ---------- 图片库 ----------
def list_images():
    result = []
    base = os.path.join(ROOT, "assets", "images")
    for dirpath, _, filenames in os.walk(base):
        for fn in sorted(filenames):
            if fn.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg")):
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
                result.append(rel)
    return result


def safe_filename(name):
    name = os.path.basename(name)
    name = re.sub(r"[^\w\u4e00-\u9fa5\.\-]", "_", name)
    if not name:
        name = "image.png"
    return name


# ---------- git 部署 ----------
def git_status():
    try:
        out = subprocess.run(
            ["git", "-C", ROOT, "status", "--short"],
            capture_output=True, text=True, timeout=20,
        )
        return out.stdout.strip()
    except Exception as e:
        return "git 不可用：%s" % e


def git_last_commit():
    try:
        out = subprocess.run(
            ["git", "-C", ROOT, "log", "-1", "--pretty=%h %s"],
            capture_output=True, text=True, timeout=20,
        )
        return out.stdout.strip() or "无提交记录"
    except Exception as e:
        return "git 不可用：%s" % e


def git_deploy(message):
    try:
        subprocess.run(["git", "-C", ROOT, "add", "-A"], capture_output=True, text=True, timeout=60, check=True)
        subprocess.run(
            ["git", "-C", ROOT, "commit", "-m", message],
            capture_output=True, text=True, timeout=60, check=True,
        )
        push = subprocess.run(["git", "-C", ROOT, "push", "origin", "main"], capture_output=True, text=True, timeout=120)
        return {"ok": push.returncode == 0, "output": push.stdout + push.stderr}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "output": e.stderr or str(e)}
    except Exception as e:
        return {"ok": False, "output": str(e)}


# ---------- HTTP 处理 ----------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 静默日志，保持控制台干净

    def _send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def _send_text(self, text, code=200, ctype="text/plain; charset=utf-8"):
        data = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ("/", "/index.html"):
            return self.serve_static("admin.html", "text/html; charset=utf-8")
        if path.startswith("/static/"):
            return self.serve_static(path[len("/static/"):], None)
        if path.startswith("/site/"):
            return self.serve_site(path[len("/site/"):])
        if path == "/api/blocks":
            return self._send_json(extract_blocks(read_index()))
        if path == "/api/menu":
            return self._send_json(extract_menu(read_index()))
        if path == "/api/products":
            return self._send_json(extract_products())
        if path == "/api/images":
            return self._send_json(list_images())
        if path == "/api/status":
            return self._send_json({
                "status": git_status() or "工作区干净",
                "last": git_last_commit(),
                "python": sys.version.split()[0],
                "root": ROOT,
            })
        if path == "/api/file" and "file" in parsed.query:
            q = dict(p.split("=", 1) for p in parsed.query.split("&") if "=" in p)
            fp = unquote(q.get("file", ""))
            real = EDITABLE_FILES.get(fp)
            if not real or not os.path.exists(real):
                return self._send_json({"error": "文件不可编辑或不存在"}, 400)
            with open(real, encoding="utf-8") as f:
                return self._send_json({"path": fp, "content": f.read()})
        return self._send_text("Not Found", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            return self._send_json({"error": "JSON 解析失败"}, 400)

        if path == "/api/save-block":
            html = read_index()
            new_html, n = save_block(html, payload.get("id", ""), payload.get("value", ""))
            if n == 0:
                return self._send_json({"ok": False, "error": "未找到该编辑单元"}, 400)
            write_index(new_html)
            return self._send_json({"ok": True})

        if path == "/api/menu":
            html = read_index()
            new_html, n = save_menu(html, payload.get("items", []))
            if n == 0:
                return self._send_json({"ok": False, "error": "未找到导航菜单"}, 400)
            write_index(new_html)
            return self._send_json({"ok": True})

        if path == "/api/add-section":
            sec_id = re.sub(r"[^a-zA-Z0-9_\-]", "", payload.get("id", ""))
            title = payload.get("title", "新栏目")
            if not sec_id:
                return self._send_json({"ok": False, "error": "栏目ID无效"}, 400)
            html = read_index()
            if 'id="%s"' % sec_id in html:
                return self._send_json({"ok": False, "error": "该栏目ID已存在"}, 400)
            new_html = add_section(html, sec_id, title)
            write_index(new_html)
            return self._send_json({"ok": True, "id": sec_id})

        if path == "/api/products":
            new_js, n = save_products(payload.get("products", []))
            if n == 0:
                return self._send_json({"ok": False, "error": "未找到 products 定义"}, 400)
            with open(os.path.join(ROOT, "assets", "js", "main.js"), "w", encoding="utf-8") as f:
                f.write(new_js)
            return self._send_json({"ok": True})

        if path == "/api/upload":
            import base64
            filename = safe_filename(payload.get("filename", "image.png"))
            sub = payload.get("subdir", "").strip("/")
            dest_dir = UPLOAD_DIR
            if sub:
                dest_dir = os.path.join(UPLOAD_DIR, sub)
                os.makedirs(dest_dir, exist_ok=True)
            dest = os.path.join(dest_dir, filename)
            # 同名则加序号
            base, ext = os.path.splitext(dest)
            i = 1
            while os.path.exists(dest):
                dest = "%s_%d%s" % (base, i, ext)
                i += 1
            with open(dest, "wb") as f:
                f.write(base64.b64decode(payload.get("data", "")))
            rel = os.path.relpath(dest, ROOT).replace(os.sep, "/")
            return self._send_json({"ok": True, "path": rel})

        if path == "/api/file":
            fp = payload.get("path", "")
            content = payload.get("content", "")
            real = EDITABLE_FILES.get(fp)
            if not real:
                return self._send_json({"error": "文件不可编辑"}, 400)
            with open(real, "w", encoding="utf-8") as f:
                f.write(content)
            return self._send_json({"ok": True})

        if path == "/api/deploy":
            res = git_deploy(payload.get("message", "chore: 后台更新网站内容"))
            return self._send_json(res)

        return self._send_json({"error": "未知接口"}, 404)

    def serve_static(self, name, ctype):
        fpath = os.path.normpath(os.path.join(STATIC_DIR, name))
        if not fpath.startswith(STATIC_DIR) or not os.path.isfile(fpath):
            return self._send_text("Not Found", 404)
        if ctype is None:
            ctype, _ = mimetypes.guess_type(fpath)
            ctype = ctype or "application/octet-stream"
        with open(fpath, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def serve_site(self, rel):
        # 防目录穿越
        rel = rel.lstrip("/")
        target = os.path.normpath(os.path.join(ROOT, rel))
        if not target.startswith(ROOT) or not os.path.isfile(target):
            # 默认首页
            target = os.path.join(ROOT, "index.html")
        ctype, _ = mimetypes.guess_type(target)
        ctype = ctype or "application/octet-stream"
        with open(target, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    # 端口被占用则自动+1
    srv = None
    for try_port in range(port, port + 20):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", try_port), Handler)
            port = try_port
            break
        except OSError:
            continue
    if not srv:
        print("无法绑定端口，请关闭占用 8080 的程序后重试。")
        sys.exit(1)
    print("=" * 50)
    print(" 事事顺酒 · 网站 DIY 后台已启动")
    print(" 后台地址 : http://127.0.0.1:%d" % port)
    print(" 网站预览 : http://127.0.0.1:%d/site/index.html" % port)
    print(" 站点目录 : %s" % ROOT)
    print(" 关闭方式 : 在终端按 Ctrl+C")
    print("=" * 50)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n后台已关闭。")


if __name__ == "__main__":
    main()
