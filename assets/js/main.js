/* 事事顺酒 · 官网交互 */
(function () {
  "use strict";

  /* ---------- 年龄门禁 ---------- */
  var ageGate = document.getElementById("ageGate");
  var ageYes = document.getElementById("ageYes");

  try {
    if (sessionStorage.getItem("sss_age_ok") === "1" || localStorage.getItem("sss_age_ok") === "1") {
      ageGate.classList.add("hidden");
    }
  } catch (e) { /* 隐私模式下忽略存储异常 */ }

  ageYes.addEventListener("click", function () {
    ageGate.classList.add("hidden");
    try {
      sessionStorage.setItem("sss_age_ok", "1");
      localStorage.setItem("sss_age_ok", "1");
    } catch (e) { /* ignore */ }
    document.body.style.overflow = "";
  });

  /* ---------- 导航滚动收缩 ---------- */
  var nav = document.getElementById("nav");
  var onScroll = function () {
    if (window.scrollY > 40) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
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

  /* ---------- 滚动显现动画 ---------- */
  var revealEls = document.querySelectorAll(".reveal");

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

  /* ---------- 首屏视差 ---------- */
  var heroProduct = document.querySelector(".hero-product");
  var hero = document.querySelector(".hero");
  if (heroProduct && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      heroProduct.style.transform = "translate(" + x * 14 + "px," + y * 10 + "px)";
    });
    hero.addEventListener("mouseleave", function () {
      heroProduct.style.transform = "";
    });
  }
})();
