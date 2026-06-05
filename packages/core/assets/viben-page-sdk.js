(function () {
  "use strict";

  var VP = { version: "1" };
  var listeners = [];
  var doc = document.documentElement;
  var embedded = window.parent !== window;
  var initialized = false;
  var actionRegistry = {};
  var pendingApprovals = {};
  var readyResolve = null;

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
  VP.workspacePath = null;

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "req_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  }

  function postToParent(message) {
    if (!embedded) return false;
    window.parent.postMessage(message, location.origin);
    return true;
  }

  function isParentMessage(e) {
    if (e.origin !== location.origin) return false;
    if (embedded && e.source !== window.parent) return false;
    return true;
  }

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

  function actionMetadata(namespace) {
    var actions = actionRegistry[namespace] || {};
    var metadata = {};
    Object.keys(actions).forEach(function (name) {
      var def = actions[name];
      metadata[name] = {
        description: def.description,
      };
      if (def.input_schema !== undefined) metadata[name].input_schema = def.input_schema;
      if (def.output_schema !== undefined) metadata[name].output_schema = def.output_schema;
    });
    return metadata;
  }

  function sendRegister(namespace) {
    if (!initialized) return;
    postToParent({
      type: "viben-page-actions-register",
      request_id: createRequestId(),
      namespace: namespace,
      actions: actionMetadata(namespace),
    });
  }

  function sendUnregister(namespace) {
    if (!initialized) return;
    var message = {
      type: "viben-page-actions-unregister",
      request_id: createRequestId(),
    };
    if (namespace) message.namespace = namespace;
    postToParent(message);
  }

  function syncAllActions() {
    Object.keys(actionRegistry).forEach(function (namespace) {
      sendRegister(namespace);
    });
  }

  function listActions() {
    var result = [];
    Object.keys(actionRegistry).forEach(function (namespace) {
      var actions = actionRegistry[namespace];
      Object.keys(actions).forEach(function (name) {
        var def = actions[name];
        var item = {
          namespace: namespace,
          action: name,
          description: def.description,
        };
        if (def.input_schema !== undefined) item.input_schema = def.input_schema;
        if (def.output_schema !== undefined) item.output_schema = def.output_schema;
        result.push(item);
      });
    });
    return result;
  }

  function normalizeResult(value) {
    if (
      value &&
      typeof value === "object" &&
      Array.isArray(value.content)
    ) {
      var normalized = { content: value.content };
      if (
        value.structuredContent &&
        typeof value.structuredContent === "object" &&
        !Array.isArray(value.structuredContent)
      ) {
        normalized.structuredContent = value.structuredContent;
      }
      if (value.isError === true) normalized.isError = true;
      return normalized;
    }

    if (typeof value === "string") {
      return { content: [{ type: "text", text: value }] };
    }

    if (value === undefined || value === null) {
      return {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { ok: true },
      };
    }

    if (typeof value === "object") {
      var text;
      try {
        text = JSON.stringify(value);
      } catch (_err) {
        text = String(value);
      }
      return {
        content: [{ type: "text", text: text }],
        structuredContent: value,
      };
    }

    return { content: [{ type: "text", text: String(value) }] };
  }

  function errorResult(code, err) {
    var message = err && err.message ? err.message : String(err || code);
    return {
      content: [{ type: "text", text: code + ": " + message }],
      isError: true,
    };
  }

  function rejectApprovalsForExecute(executeRequestId, error) {
    Object.keys(pendingApprovals).forEach(function (requestId) {
      var pending = pendingApprovals[requestId];
      if (pending.executeRequestId !== executeRequestId) return;
      delete pendingApprovals[requestId];
      pending.reject(error);
    });
  }

  function requireApprovalForExecute(executeRequestId, message, options) {
    if (!embedded || !initialized) {
      return Promise.reject(new Error("page_action_bridge_unavailable"));
    }

    return new Promise(function (resolve, reject) {
      var requestId = createRequestId();
      pendingApprovals[requestId] = {
        executeRequestId: executeRequestId,
        resolve: resolve,
        reject: reject,
      };
      postToParent({
        type: "viben-page-action-approval-request",
        request_id: requestId,
        execute_request_id: executeRequestId,
        message: message,
        options: options,
      });
    });
  }

  async function handleExecute(data) {
    var namespace = data.namespace;
    var action = data.action;
    var requestId = data.request_id;
    var def = actionRegistry[namespace] && actionRegistry[namespace][action];
    var result;

    if (!def || typeof def.execute !== "function") {
      result = errorResult("action_not_available", namespace + "." + action);
      postToParent({
        type: "viben-page-action-result",
        request_id: requestId,
        result: result,
      });
      return;
    }

    try {
      var rawContext = data.context || {};
      var context = {
        sessionId: rawContext.session_id || "",
        toolUseId: rawContext.tool_use_id || "",
        action: rawContext.full_action || "",
        namespace: namespace,
        pageSlug: rawContext.page_slug || "",
        workspacePath: rawContext.workspace_path || VP.workspacePath || null,
        requireApproval: function (message, options) {
          return requireApprovalForExecute(requestId, message, options);
        },
      };
      result = normalizeResult(await def.execute(data.payload, context));
    } catch (err) {
      result = errorResult("execution_error", err);
    } finally {
      rejectApprovalsForExecute(requestId, new Error("page_action_cancelled"));
    }

    postToParent({
      type: "viben-page-action-result",
      request_id: requestId,
      result: result,
    });
  }

  function handleApprovalResult(data) {
    var pending = pendingApprovals[data.request_id];
    if (!pending || pending.executeRequestId !== data.execute_request_id) return;
    delete pendingApprovals[data.request_id];
    if (data.error) {
      pending.reject(new Error(data.error));
      return;
    }
    if (data.approved === true) {
      pending.resolve(true);
      return;
    }
    pending.reject(new Error("user_cancelled"));
  }

  function handleRegisterResult(data) {
    if (!data || !Array.isArray(data.rejected)) return;
    data.rejected.forEach(function (item) {
      console.warn("[VibenPage.actions] register rejected", item);
    });
  }

  // 2. 监听父 App 消息（带 origin/source 校验）
  window.addEventListener("message", function (e) {
    if (!isParentMessage(e)) return;

    var data = e.data;
    if (!data || typeof data.type !== "string") return;
    if (data.type === "viben-page-init") {
      applyTheme(data.theme);
      VP.workspacePath = data.workspace_path || null;
      initialized = true;
      if (readyResolve) {
        readyResolve(true);
        readyResolve = null;
      }
      syncAllActions();
    } else if (data.type === "viben-page-theme") {
      applyTheme(data.theme);
    } else if (data.type === "viben-page-action-execute") {
      handleExecute(data);
    } else if (data.type === "viben-page-action-approval-result") {
      handleApprovalResult(data);
    } else if (data.type === "viben-page-actions-register-result") {
      handleRegisterResult(data);
    }
  });

  // 3. 系统偏好 fallback
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", function (e) {
    if (!VP.workspacePath) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  // 4. 公开 API
  VP.onThemeChange = function (fn) {
    listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  };
  VP.fetch = function (path, options) {
    return fetch(location.origin + path, options);
  };
  VP.actions = {
    ready: new Promise(function (resolve) {
      readyResolve = resolve;
      if (!embedded) {
        setTimeout(function () {
          if (readyResolve) {
            readyResolve(false);
            readyResolve = null;
          }
        }, 0);
      }
    }),
    register: function (namespace, actions) {
      if (!namespace || typeof namespace !== "string") {
        throw new Error("namespace must be a non-empty string");
      }
      if (!actions || typeof actions !== "object") {
        throw new Error("actions must be an object");
      }
      actionRegistry[namespace] = {};
      Object.keys(actions).forEach(function (name) {
        var def = actions[name];
        if (!def || typeof def !== "object") return;
        if (typeof def.description !== "string") return;
        if (typeof def.execute !== "function") return;
        actionRegistry[namespace][name] = def;
      });
      sendRegister(namespace);
      return function () {
        VP.actions.unregister(namespace);
      };
    },
    unregister: function (namespace) {
      if (namespace) {
        delete actionRegistry[namespace];
        sendUnregister(namespace);
        return;
      }
      actionRegistry = {};
      sendUnregister();
    },
    list: listActions,
  };

  window.addEventListener("beforeunload", function () {
    sendUnregister();
  });

  window.VibenPage = VP;

  // 5. 通知父 App 已就绪（仅在 iframe 中）
  if (embedded) {
    postToParent({ type: "viben-page-ready" });
  }
})();
