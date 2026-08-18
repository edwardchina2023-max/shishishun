/* 事事顺酒 · 官网交互 V2 */
(function () {
  "use strict";

  /* ---------- 年龄门禁 ---------- */
  var ageGate = document.getElementById("ageGate");
  var ageYes = document.getElementById("ageYes");

  try {
    if (sessionStorage.getItem("sss_age_ok") === "1" || localStorage.getItem("sss_age_ok") === "1") {
      ageGate.classList.add("hidden");
    } else {
      document.body.style.overflow = "hidden";
    }
  } catch (e) { /* ignore */ }

  ageYes.addEventListener("click", function () {
    ageGate.classList.add("hidden");
    document.body.style.overflow = "";
    try {
      sessionStorage.setItem("sss_age_ok", "1");
      localStorage.setItem("sss_age_ok", "1");
    } catch (e) { /* ignore */ }
  });

  /* ---------- 导航：滚动收缩 + 下滑隐藏 ---------- */
  var nav = document.getElementById("nav");
  var lastY = 0;
  var onScroll = function () {
    var y = window.scrollY;
    if (y > 40) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
    if (y > 420 && y > lastY + 4) {
      nav.classList.add("hidden");
    } else if (y < lastY - 4 || y < 200) {
      nav.classList.remove("hidden");
    }
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 移动端菜单 ---------- */
  var navToggle = document.getElementById("navToggle");
  var navMenu = document.getElementById("navMenu");

  navToggle.addEventListener("click", function () {
    navMenu.classList.toggle("open");
    navToggle.classList.toggle("active");
  });

  navMenu.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      navMenu.classList.remove("open");
      navToggle.classList.remove("active");
    });
  });

  /* ---------- 滚动显现（支持 data-delay 延迟） ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  revealEls.forEach(function (el) {
    var d = el.getAttribute("data-delay");
    if (d) { el.style.transitionDelay = d + "ms"; }
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- 数字滚动 ---------- */
  var counters = document.querySelectorAll(".stat-num");
  var animateCount = function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var dur = 1600;
    var start = null;
    var step = function (ts) {
      if (!start) { start = ts; }
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) { requestAnimationFrame(step); }
    };
    requestAnimationFrame(step);
  };

  if ("IntersectionObserver" in window && counters.length) {
    var cio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(function (el) {
      el.textContent = el.getAttribute("data-count");
    });
  }

  /* ---------- 首屏视差 ---------- */
  var heroBg = document.querySelector(".hero-bg-img");
  var hero = document.querySelector(".hero");
  if (heroBg && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      heroBg.style.transform = "scale(1.05) translate(" + x * 16 + "px," + y * 12 + "px)";
      heroBg.style.animation = "none";
    });
    hero.addEventListener("mouseleave", function () {
      heroBg.style.transform = "";
      heroBg.style.animation = "";
    });
  }

  /* ---------- V2 四大旗舰系列切换 ---------- */
  var products = {
    "365": {
      meaning: "顺一年",
      name: "事事顺365",
      copy: "一年三百六十五天，愿日子有序、心里有光。",
      spec: "浓香型白酒 · 42%vol · 500ml"
    },
    "516": {
      meaning: "我要顺",
      name: "事事顺516",
      copy: "把一份直白的好愿望，说给重要的人听。",
      spec: "浓香型白酒 · 45%vol · 500ml"
    },
    "china-red": {
      meaning: "中国红",
      name: "事事顺·中国红",
      copy: "一抹中国红，敬相逢，也敬圆满。",
      spec: "浓香型白酒 · 42%vol · 500ml"
    },
    "family": {
      meaning: "家和万事顺",
      name: "事事顺·家顺",
      copy: "家在，心就有归处；家顺，日子便有暖意。",
      spec: "浓香型白酒 · 42%vol · 450ml"
    }
  };

  var productButtons = document.querySelectorAll(".v2-product-exhibit");
  var productMeaning = document.getElementById("productMeaning");
  var productName = document.getElementById("productName");
  var productCopy = document.getElementById("productCopy");
  var productSpec = document.getElementById("productSpec");

  if (productButtons.length && productMeaning && productName && productCopy && productSpec) {
    productButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var product = products[button.getAttribute("data-product")];
        if (!product) return;

        productButtons.forEach(function (item) {
          var active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });

        productMeaning.textContent = product.meaning;
        productName.textContent = product.name;
        productCopy.textContent = product.copy;
        productSpec.textContent = product.spec;
      });
    });
  }
})();
