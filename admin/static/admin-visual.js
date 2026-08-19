/* 事事顺酒 · 可视化编辑面板（结构树 + 预览高亮 + 编辑） */
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
    if (!h) return;
    h.textContent = msg;
    h.style.color = ok === false ? "#ffd0c2" : "#fff";
    if (msg) setTimeout(() => { if (h.textContent === msg) h.textContent = ""; }, 2600);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  const TYPE_ICON = { text: "📝", image: "🖼", video: "🎬" };

  let TREE = null;     // manifest 结构
  let BLOCKS = [];     // 当前值扁平列表
  let IMAGES = [];     // 图片库
  let current = null;  // 当前选中元素 {key,type,label,desc,selector,editable}

  function blockValue(id) {
    const b = BLOCKS.find((x) => x.id === id);
    return b ? b.value : "";
  }
  function selectorOf(el) {
    return el.selector || ('[data-sss="' + el.type + ":" + el.key + '"]');
  }

  /* ---------- 加载 ---------- */
  function loadAll() {
    Promise.all([
      api("/api/tree"),
      api("/api/blocks"),
      api("/api/images"),
    ]).then(([tree, blocks, images]) => {
      TREE = tree;
      BLOCKS = blocks || [];
      IMAGES = images || [];
      renderTree("");
    });
  }

  /* ---------- 结构树 ---------- */
  function renderTree(q) {
    q = (q || "").trim().toLowerCase();
    const box = $("#treeView");
    if (!box || !TREE) return;
    box.innerHTML = "";
    (TREE.sections || []).forEach((sec) => {
      const secEls = (sec.elements || []).filter(
        (e) => !q || e.label.toLowerCase().includes(q) || e.key.toLowerCase().includes(q)
      );
      if (q && secEls.length === 0) return;
      const wrap = document.createElement("div");
      wrap.className = "tree-section";
      const head = document.createElement("div");
      head.className = "tree-sec-head";
      head.innerHTML =
        '<span class="tw">▾</span><span class="si">' + esc(sec.icon || "•") + "</span>" +
        '<span class="sn">' + esc(sec.name) + '</span><span class="sc">' + secEls.length + "</span>";
      const list = document.createElement("div");
      list.className = "tree-sec-list";
      secEls.forEach((el) => {
        const id = el.type + ":" + el.key;
        const val = blockValue(id);
        const item = document.createElement("div");
        item.className = "tree-el" + (current && current.key === el.key && current.type === el.type ? " sel" : "");
        item.dataset.key = el.key;
        item.dataset.type = el.type;
        let preview = "";
        if (el.type === "text") {
          preview = '<span class="tv">' + esc((val || "").replace(/<[^>]+>/g, "").slice(0, 40) || "（空）") + "</span>";
        } else {
          const src = val || "";
          preview = src
            ? '<img class="tv-img" src="/site/' + esc(src) + "?t=" + Date.now() + '" alt="">'
            : '<span class="tv">（未设置）</span>';
        }
        item.innerHTML =
          '<span class="ti">' + (TYPE_ICON[el.type] || "•") + "</span>" +
          '<span class="tl">' + esc(el.label) + "</span>" + preview +
          (el.editable === false ? '<span class="lock" title="固定内容，一般不动">🔒</span>' : "");
        item.addEventListener("click", () => selectElement(el, sec));
        list.appendChild(item);
      });
      head.addEventListener("click", () => {
        const open = wrap.classList.toggle("open");
        head.querySelector(".tw").textContent = open ? "▾" : "▸";
      });
      wrap.classList.add("open");
      head.querySelector(".tw").textContent = "▾";
      wrap.appendChild(head);
      wrap.appendChild(list);
      box.appendChild(wrap);
    });
    if (box.children.length === 0) {
      box.innerHTML = '<div class="tree-empty">没有匹配的位置</div>';
    }
  }

  /* ---------- 选中并高亮 ---------- */
  function selectElement(el, sec) {
    current = el;
    $$(".tree-el").forEach((x) => x.classList.remove("sel"));
    const node = $$(".tree-el").find((x) => x.dataset.key === el.key && x.dataset.type === el.type);
    if (node) node.classList.add("sel");
    highlight(selectorOf(el));
    renderEditor(el, sec);
  }

  let pendingHighlight = null;
  function highlight(sel) {
    pendingHighlight = sel;
    applyHighlight(sel);
  }
  function applyHighlight(sel) {
    const f = $("#previewFrame");
    let doc;
    try { doc = f.contentDocument; } catch (e) { return; }
    if (!doc || !doc.body) return;
    doc.querySelectorAll(".sss-hl").forEach((e) => {
      e.style.outline = ""; e.style.outlineOffset = ""; e.style.boxShadow = ""; e.style.transition = "";
    });
    const el = doc.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.outline = "3px solid #A6192E";
    el.style.outlineOffset = "2px";
    el.style.boxShadow = "0 0 0 6px rgba(166,25,46,.18)";
    el.style.transition = "outline .2s";
    el.classList.add("sss-hl");
  }

  /* ---------- 编辑面板 ---------- */
  function renderEditor(el, sec) {
    const pane = $("#editPane");
    if (!pane) return;
    const id = el.type + ":" + el.key;
    const val = blockValue(id);
    let html = "";
    html += '<div class="edit-head"><span class="ei">' + (TYPE_ICON[el.type] || "•") + "</span>" +
      '<div><div class="eh-key">' + esc(el.label) + "</div>" +
      '<div class="eh-loc">所在区块：' + esc(sec ? sec.name : "—") + " · 标识 " + esc(id) + "</div></div></div>";
    html += '<div class="eh-desc">' + esc(el.desc || "") + "</div>";

    if (el.editable === false) {
      html += '<div class="edit-locked">🔒 此内容为固定文案（英文小标题），一般不建议修改。如需调整，请到「文件编辑」面板直接改源码。</div>';
    } else if (el.type === "text") {
      html += '<label>文字内容</label><textarea id="editVal" class="edit-textarea">' + esc(val) + "</textarea>";
      html += '<button class="btn gold big" id="saveEl">保存文字</button>';
    } else if (el.type === "image") {
      html += '<div class="edit-imgwrap"><img id="editImg" src="/site/' + esc(val || "") + "?t=" + Date.now() + '" alt=""></div>';
      html += '<div class="edit-row"><input type="file" accept="image/*" id="upFile" hidden>' +
        '<button class="btn small" id="pickImg">⬆ 上传新图</button></div>';
      let opts = '<option value="">— 或选用图片库 —</option>';
      IMAGES.forEach((p) => { opts += '<option value="' + esc(p) + '"' + (p === val ? " selected" : "") + ">" + esc(p) + "</option>"; });
      html += '<select id="selImg" class="edit-select">' + opts + "</select>";
      html += '<button class="btn gold big" id="saveEl">保存图片</button>';
      html += '<div class="edit-hint">保存后预览会自动刷新。前线同事拿到素材后，点「上传新图」即可替换。</div>';
    } else if (el.type === "video") {
      html += '<div class="edit-imgwrap"><video id="editVid" src="/site/' + esc(val || "") + "?t=" + Date.now() + '" controls style="max-width:100%"></video></div>';
      html += '<div class="edit-row"><input type="file" accept="video/*" id="upFile" hidden>' +
        '<button class="btn small" id="pickImg">⬆ 上传新视频</button></div>';
      html += '<input id="selVid" class="edit-select" value="' + esc(val || "") + '" placeholder="或直接填写视频路径">';
      html += '<button class="btn gold big" id="saveEl">保存视频</button>';
    }
    html += '<span class="save-ok" id="editOk"></span>';
    pane.innerHTML = html;

    const saveBtn = $("#saveEl");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        let newVal = "";
        if (el.type === "text") newVal = $("#editVal").value;
        else if (el.type === "image") newVal = $("#selImg").value;
        else if (el.type === "video") newVal = $("#selVid").value;
        saveBtn.textContent = "保存中…";
        api("/api/save-block", "POST", { id: id, value: newVal }).then((r) => {
          if (r.ok) {
            $("#editOk").textContent = "✓ 已保存";
            // 同步本地值并刷新预览
            const b = BLOCKS.find((x) => x.id === id);
            if (b) b.value = newVal;
            refreshPreview();
            renderTree($("#treeSearch").value);
            hint("已保存：" + el.label, true);
          } else {
            $("#editOk").textContent = "✗ " + (r.error || "失败");
          }
          saveBtn.textContent = el.type === "text" ? "保存文字" : (el.type === "image" ? "保存图片" : "保存视频");
        });
      });
    }
    const pick = $("#pickImg");
    const up = $("#upFile");
    if (pick && up) {
      pick.addEventListener("click", () => up.click());
      up.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          api("/api/upload", "POST", { filename: file.name, data: reader.result.split(",")[1] }).then((r) => {
            if (r.ok) {
              if (el.type === "image") { $("#selImg").value = r.path; $("#editImg").src = "/site/" + r.path + "?t=" + Date.now(); }
              if (el.type === "video") { $("#selVid").value = r.path; $("#editVid").src = "/site/" + r.path + "?t=" + Date.now(); }
              hint("已上传：" + r.path, true);
            } else hint("上传失败", false);
          });
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function refreshPreview() {
    const f = $("#previewFrame");
    f.src = f.src.split("?")[0] + "?t=" + Date.now();
  }

  /* ---------- 绑定 ---------- */
  function init() {
    const f = $("#previewFrame");
    if (f) f.addEventListener("load", () => { if (pendingHighlight) applyHighlight(pendingHighlight); });
    const rf = $("#refreshPreview");
    if (rf) rf.addEventListener("click", refreshPreview);
    const ts = $("#treeSearch");
    if (ts) ts.addEventListener("input", (e) => renderTree(e.target.value));
    loadAll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
