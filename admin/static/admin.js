/* 事事顺酒 · 网站 DIY 后台 交互 */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function api(path, method, body) {
    const opt = { method: method || "GET", headers: { "Content-Type": "application/json" } };
    if (body) opt.body = JSON.stringify(body);
    return fetch(path, opt).then((r) => r.json());
  }
  function hint(msg, ok) {
    const h = $("#saveHint");
    h.textContent = msg;
    h.style.color = ok === false ? "#ffd0c2" : "#fff";
    if (msg) setTimeout(() => { if (h.textContent === msg) h.textContent = ""; }, 2600);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- 侧边切换 ---------- */
  $$(".nav-item").forEach((b) => {
    b.addEventListener("click", () => {
      $$(".nav-item").forEach((x) => x.classList.remove("active"));
      $$(".panel").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      $("#panel-" + b.dataset.panel).classList.add("active");
      if (b.dataset.panel === "deploy") loadStatus();
      if (b.dataset.panel === "library") loadLibrary();
      if (b.dataset.panel === "files") loadFile();
    });
  });

  $("#previewBtn").addEventListener("click", () => window.open("/site/index.html", "_blank"));

  /* ---------- 文字区块 ---------- */
  let blocks = [];
  function loadBlocks() {
    api("/api/blocks").then((list) => {
      blocks = list;
      renderBlocks("");
    });
  }
  function renderBlocks(q) {
    q = q.trim().toLowerCase();
    const box = $("#blocksList");
    box.innerHTML = "";
    blocks.filter((b) => !q || b.label.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
      .forEach((b) => {
        const d = document.createElement("div");
        d.className = "card";
        d.innerHTML =
          '<h3>' + esc(b.label) + ' <span class="tag">' + esc(b.id) + "</span></h3>" +
          '<textarea data-id="' + esc(b.id) + '">' + esc(b.value) + "</textarea>" +
          '<div style="margin-top:8px"><button class="btn small" data-save="' + esc(b.id) + '">保存</button><span class="save-ok" id="ok-' + esc(b.id) + '"></span></div>';
        box.appendChild(d);
      });
    $$('#blocksList [data-save]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.save;
        const val = box.querySelector('textarea[data-id="' + cssEsc(id) + '"]').value;
        api("/api/save-block", "POST", { id: id, value: val }).then((r) => {
          $("#ok-" + cssEsc(id)).textContent = r.ok ? "✓ 已保存" : "✗ " + (r.error || "失败");
        });
      });
    });
  }
  function cssEsc(s) { return s.replace(/"/g, '\\"'); }
  $("#blockSearch").addEventListener("input", (e) => renderBlocks(e.target.value));
  loadBlocks();

  /* ---------- 图片替换 ---------- */
  let images = [];
  function loadImages() {
    api("/api/blocks").then((list) => {
      images = list.filter((b) => b.type === "image");
      renderImages();
    });
    api("/api/images").then((list) => { window.__allImgs = list; });
  }
  function renderImages() {
    const box = $("#imagesList");
    box.innerHTML = "";
    images.forEach((b) => {
      const d = document.createElement("div");
      d.className = "card";
      let opts = '<option value="">— 选择已有图片 —</option>';
      (window.__allImgs || []).forEach((p) => {
        opts += '<option value="' + esc(p) + '"' + (p === b.value ? " selected" : "") + ">" + esc(p) + "</option>";
      });
      d.innerHTML =
        '<h3>' + esc(b.label) + ' <span class="tag">' + esc(b.id) + "</span></h3>" +
        '<div class="img-row">' +
        '<img class="img-thumb" src="/site/' + esc(b.value) + '?t=' + Date.now() + '" alt="">' +
        '<div class="img-controls">' +
        '<input type="file" accept="image/*" data-up="' + esc(b.id) + '" hidden>' +
        '<button class="btn small" data-pick="' + esc(b.id) + '">⬆ 上传新图</button>' +
        '<select data-sel="' + esc(b.id) + '">' + opts + "</select>" +
        '<button class="btn small gold" data-use="' + esc(b.id) + '">使用所选图</button>' +
        "</div></div>" +
        '<div style="margin-top:8px"><button class="btn small" data-saveimg="' + esc(b.id) + '">保存此图</button><span class="save-ok" id="oki-' + esc(b.id) + '"></span></div>';
      box.appendChild(d);
    });
    $$('#imagesList [data-pick]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = box.querySelector('input[data-up="' + cssEsc(btn.dataset.pick) + '"]');
        f.click();
      });
    });
    $$('#imagesList input[type=file]').forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result.split(",")[1];
          api("/api/upload", "POST", { filename: file.name, data: b64 }).then((r) => {
            if (r.ok) {
              const sel = box.querySelector('select[data-sel="' + cssEsc(inp.dataset.up) + '"]');
              sel.value = r.path;
              hint("图片已上传：" + r.path);
            } else hint("上传失败", false);
          });
        };
        reader.readAsDataURL(file);
      });
    });
    $$('#imagesList [data-use]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const sel = box.querySelector('select[data-sel="' + cssEsc(btn.dataset.use) + '"]');
        if (!sel.value) { hint("请先选择一张图", false); return; }
        updateImage(btn.dataset.use, sel.value);
      });
    });
    $$('#imagesList [data-saveimg]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const sel = box.querySelector('select[data-sel="' + cssEsc(btn.dataset.saveimg) + '"]');
        if (!sel.value) { hint("请先选择或上传图片", false); return; }
        updateImage(btn.dataset.saveimg, sel.value);
      });
    });
  }
  function updateImage(id, src) {
    api("/api/save-block", "POST", { id: id, value: src }).then((r) => {
      $("#oki-" + cssEsc(id)).textContent = r.ok ? "✓ 已保存" : "✗ " + (r.error || "失败");
      if (r.ok) loadImages();
    });
  }
  loadImages();

  /* ---------- 导航菜单 ---------- */
  let menu = [];
  function loadMenu() {
    api("/api/menu").then((list) => { menu = list; renderMenu(); });
  }
  function renderMenu() {
    const box = $("#menuList");
    box.innerHTML = "";
    menu.forEach((it, i) => {
      const d = document.createElement("div");
      d.className = "menu-item";
      d.innerHTML =
        '<span class="mi-label">第' + (i + 1) + '项</span>' +
        '<input data-i="' + i + '" data-f="label" value="' + esc(it.label) + '">' +
        '<input data-i="' + i + '" data-f="href" value="' + esc(it.href) + '">' +
        '<button class="btn small" data-up="' + i + '">↑</button>' +
        '<button class="btn small" data-down="' + i + '">↓</button>' +
        '<button class="btn small ghost" data-del="' + i + '" style="background:#a33;color:#fff">✕</button>';
      box.appendChild(d);
    });
    $$('#menuList [data-f]').forEach((inp) => {
      inp.addEventListener("input", () => { menu[+inp.dataset.i][inp.dataset.f] = inp.value; });
    });
    $$('#menuList [data-up]').forEach((b) => b.addEventListener("click", () => move(+b.dataset.up, -1)));
    $$('#menuList [data-down]').forEach((b) => b.addEventListener("click", () => move(+b.dataset.down, 1)));
    $$('#menuList [data-del]').forEach((b) => b.addEventListener("click", () => { menu.splice(+b.dataset.del, 1); renderMenu(); }));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= menu.length) return;
    const t = menu[i]; menu[i] = menu[j]; menu[j] = t;
    renderMenu();
  }
  $("#addMenuBtn").addEventListener("click", () => {
    const label = $("#menuLabel").value.trim();
    const href = $("#menuHref").value.trim();
    if (!label) { hint("请填写菜单文字", false); return; }
    menu.push({ label: label, href: href || "#", cta: $("#menuCta").checked });
    $("#menuLabel").value = ""; $("#menuHref").value = ""; $("#menuCta").checked = false;
    renderMenu();
  });
  $("#saveMenuBtn").addEventListener("click", () => {
    api("/api/menu", "POST", { items: menu }).then((r) => hint(r.ok ? "导航菜单已保存 ✓" : "保存失败：" + (r.error || ""), r.ok));
  });
  $("#addSectionBtn").addEventListener("click", () => {
    const id = $("#secId").value.trim();
    const title = $("#secTitle").value.trim() || "新栏目";
    if (!id) { hint("请填写栏目ID（英文）", false); return; }
    api("/api/add-section", "POST", { id: id, title: title }).then((r) => {
      if (r.ok) {
        hint("栏目已创建，已加入导航 ✓");
        loadMenu();
        loadBlocks();
      } else hint("创建失败：" + (r.error || ""), false);
    });
  });
  loadMenu();

  /* ---------- 产品文案 ---------- */
  let products = [];
  function loadProducts() {
    api("/api/products").then((list) => { products = list; renderProducts(); });
  }
  function renderProducts() {
    const box = $("#productsList");
    box.innerHTML = "";
    products.forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML =
        '<h3>' + esc(p.name || p.key) + ' <span class="tag">' + esc(p.key) + "</span></h3>" +
        '<label>寓意</label><input data-i="' + i + '" data-f="meaning" value="' + esc(p.meaning) + '">' +
        '<label>名称</label><input data-i="' + i + '" data-f="name" value="' + esc(p.name) + '">' +
        '<label>文案</label><textarea data-i="' + i + '" data-f="copy">' + esc(p.copy) + "</textarea>" +
        '<label>规格</label><input data-i="' + i + '" data-f="spec" value="' + esc(p.spec) + '">';
      box.appendChild(d);
    });
    $$('#productsList [data-f]').forEach((inp) => {
      inp.addEventListener("input", () => { products[+inp.dataset.i][inp.dataset.f] = inp.value; });
    });
  }
  $("#saveProductsBtn").addEventListener("click", () => {
    api("/api/products", "POST", { products: products }).then((r) => hint(r.ok ? "产品文案已保存 ✓" : "保存失败：" + (r.error || ""), r.ok));
  });
  loadProducts();

  /* ---------- 文件编辑 ---------- */
  let currentFile = "index.html";
  function loadFile() {
    api("/api/file?file=" + encodeURIComponent(currentFile)).then((r) => {
      if (r.error) { hint(r.error, false); return; }
      $("#fileEditor").value = r.content;
    });
  }
  $("#fileSelect").addEventListener("change", (e) => { currentFile = e.target.value; loadFile(); });
  $("#saveFileBtn").addEventListener("click", () => {
    api("/api/file", "POST", { path: currentFile, content: $("#fileEditor").value }).then((r) =>
      hint(r.ok ? "文件已保存 ✓" : "保存失败", r.ok));
  });

  /* ---------- 图片库 ---------- */
  function loadLibrary() {
    api("/api/images").then((list) => {
      const grid = $("#libraryGrid");
      grid.innerHTML = "";
      list.forEach((p) => {
        const cell = document.createElement("div");
        cell.className = "lib-cell";
        cell.innerHTML =
          '<img src="/site/' + esc(p) + '?t=' + Date.now() + '" alt="">' +
          '<div class="lp">' + esc(p) + "</div>" +
          '<div class="row"><button class="btn small" data-copy="' + esc(p) + '">复制路径</button></div>';
        grid.appendChild(cell);
      });
      $$('#libraryGrid [data-copy]').forEach((b) =>
        b.addEventListener("click", () => {
          navigator.clipboard.writeText(b.dataset.copy).then(() => hint("已复制：" + b.dataset.copy));
        })
      );
    });
  }
  $("#uploadBtn").addEventListener("click", () => $("#uploadFile").click());
  $("#uploadFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(",")[1];
      api("/api/upload", "POST", { filename: file.name, data: b64 }).then((r) => {
        if (r.ok) { hint("已上传：" + r.path); loadLibrary(); }
        else hint("上传失败", false);
      });
    };
    reader.readAsDataURL(file);
  });

  /* ---------- 部署 ---------- */
  function loadStatus() {
    api("/api/status").then((s) => {
      $("#stPython").textContent = s.python;
      $("#stLast").textContent = s.last;
      $("#stStatus").textContent = s.status || "工作区干净";
    });
  }
  $("#deployBtn").addEventListener("click", () => {
    const msg = $("#deployMsg").value.trim() || "chore: 后台更新网站内容";
    $("#deployOut").textContent = "正在提交并推送…";
    api("/api/deploy", "POST", { message: msg }).then((r) => {
      $("#deployOut").textContent = r.ok ? "✓ 部署成功！\n" + r.output : "✗ 部署失败：\n" + r.output;
      if (r.ok) loadStatus();
    });
  });
})();
