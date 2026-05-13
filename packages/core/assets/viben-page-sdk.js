(function () {
  "use strict";

  var VP = { version: "1" };
  var listeners = [];
  var doc = document.documentElement;

  // 1. 防 FOUC：立即从 URL 读取主题
  var params = new URLSearchParams(location.search);
  var initialTheme = params.get("theme");
  if (initialTheme === "dark") {
    doc.classList.add("dark");
  } else if (initialTheme === "light") {
    doc.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      doc.classList.add("dark");
    }
  }
  VP.theme = doc.classList.contains("dark") ? "dark" : "light";

  // 2. 应用主题
  function applyTheme(theme) {
    var prev = VP.theme;
    VP.theme = theme;
    doc.classList.toggle("dark", theme === "dark");
    if (prev !== theme) {
      doc.classList.add("vp-transitioning");
      setTimeout(function () {
        doc.classList.remove("vp-transitioning");
      }, 300);
      listeners.forEach(function (fn) {
        fn(theme);
      });
    }
  }

  // 3. 监听父 App 消息（带 origin 校验）
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin) return;

    var data = e.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "viben-page-init") {
      applyTheme(data.theme);
      VP.workspacePath = data.workspace_path || null;
    } else if (data.type === "viben-page-theme") {
      applyTheme(data.theme);
    }
  });

  // 4. 系统偏好 fallback
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", function (e) {
    if (!VP.workspacePath) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  // 5. 通知父 App 已就绪（仅在 iframe 中）
  if (window.parent !== window) {
    window.parent.postMessage({ type: "viben-page-ready" }, location.origin);
  }

  // 6. 公开 API
  VP.onThemeChange = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  };
  VP.workspacePath = null;
  VP.fetch = function (path, options) {
    return fetch(location.origin + path, options);
  };

  window.VibenPage = VP;
})();
