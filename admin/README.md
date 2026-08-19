# 事事顺酒 · 网站 DIY 后台

一个**完全本地运行**的网站管理后台，用来编辑 `shishishun` 网站的文字、图片、导航菜单与产品文案，并一键部署到 GitHub Pages。

## 它能做什么

- ✎ **文字区块**：可视化修改首页任意一段文案（标题、导语、产品名等）
- 🖼 **图片替换**：上传或选用图片，替换网站任意一张图
- 🧭 **导航菜单**：调整顶部菜单，或新增「子菜单 + 对应栏目」
- 🍶 **产品文案**：修改四大旗舰系列的寓意 / 名称 / 文案 / 规格
- 📄 **文件编辑**：直接编辑 `index.html` / `style.css` / `main.js`（可改**任意**内容）
- 🗂 **图片库**：浏览、上传、复制图片路径
- 🚀 **部署上线**：一键提交并推送到 GitHub Pages

> 后台仅在你自己的电脑上运行（地址 `http://127.0.0.1:8080`），不会对外暴露。

## 如何启动（每台电脑都只需一次）

本后台**只依赖 Python 自带的标准库，无需安装任何第三方包**。只要电脑上有 Python 3（macOS / Linux 一般自带；Windows 安装 Python 时勾选“Add to PATH”即可）。

### macOS / Linux
双击 `start.command`，或在终端运行：
```bash
cd admin
bash start.sh
```
### Windows
双击 `start.bat` 即可。

启动后，浏览器打开：
- 后台管理：`http://127.0.0.1:8080`
- 网站预览：`http://127.0.0.1:8080/site/index.html`

关闭：在终端按 `Ctrl + C`。

## 如何迁移到同事的电脑（一键搬运）

整个网站 + 后台都在 **`shishishun-site` 这一个文件夹**里。迁移步骤：

1. 把 `shishishun-site` 整个文件夹拷贝到同事电脑（U 盘 / 网盘 / Git 均可）。
2. 同事打开 `shishishun-site/admin/` 目录，双击对应系统的启动脚本。
3. 浏览器访问 `http://127.0.0.1:8080` 即可继续编辑。

无需重新安装环境、无需配置服务器。只要目标电脑装了 Python 3 就能跑。

## 部署说明

后台「部署上线」按钮会执行 `git add -A && git commit && git push origin main`，
推送后 GitHub Pages 会在 1–2 分钟内自动重新构建并上线。

> 首次在同事电脑上使用部署功能前，请确保该电脑已配置好 GitHub 的 git 身份与推送权限
> （`git clone` 过本仓库、或已登录 GitHub 凭证）。

## 目录结构

```
shishishun-site/                ← 整站根目录（可整体迁移）
├── index.html                  ← 网站首页（已被后台标记可编辑单元）
├── assets/                    ← 图片 / 样式 / 脚本
│   └── images/uploads/        ← 后台上传的图片存放处
└── admin/                     ← DIY 后台（自包含）
    ├── server.py              ← 本地服务（纯标准库，无需 pip）
    ├── start.sh / start.command / start.bat  ← 一键启动
    ├── README.md
    └── static/                ← 后台界面（admin.html / css / js）
```

## 小提示

- 改完内容后，记得点对应面板的「保存」，最后到「部署上线」推送到线上。
- 「文件编辑」是最强模式，可改任何内容，但请谨慎，重要修改前可先备份 `index.html`。
- 后台不会自动备份；如担心误操作，可用 Git 管理版本（每次部署即一次提交）。
