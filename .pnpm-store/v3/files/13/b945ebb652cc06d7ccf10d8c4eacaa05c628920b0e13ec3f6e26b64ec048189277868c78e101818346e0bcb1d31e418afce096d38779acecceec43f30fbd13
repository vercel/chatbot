"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/vue/index.ts
var vue_exports = {};
__export(vue_exports, {
  Analytics: () => Analytics
});
module.exports = __toCommonJS(vue_exports);

// src/vue/create-component.ts
var import_vue = require("vue");
var import_vue_router = require("vue-router");

// package.json
var name = "@vercel/analytics";
var version = "1.5.0";

// src/queue.ts
var initQueue = () => {
  if (window.va) return;
  window.va = function a(...params) {
    (window.vaq = window.vaq || []).push(params);
  };
};

// src/utils.ts
function isBrowser() {
  return typeof window !== "undefined";
}
function detectEnvironment() {
  try {
    const env = process.env.NODE_ENV;
    if (env === "development" || env === "test") {
      return "development";
    }
  } catch (e) {
  }
  return "production";
}
function setMode(mode = "auto") {
  if (mode === "auto") {
    window.vam = detectEnvironment();
    return;
  }
  window.vam = mode;
}
function getMode() {
  const mode = isBrowser() ? window.vam : detectEnvironment();
  return mode || "production";
}
function isDevelopment() {
  return getMode() === "development";
}
function computeRoute(pathname, pathParams) {
  if (!pathname || !pathParams) {
    return pathname;
  }
  let result = pathname;
  try {
    const entries = Object.entries(pathParams);
    for (const [key, value] of entries) {
      if (!Array.isArray(value)) {
        const matcher = turnValueToRegExp(value);
        if (matcher.test(result)) {
          result = result.replace(matcher, `/[${key}]`);
        }
      }
    }
    for (const [key, value] of entries) {
      if (Array.isArray(value)) {
        const matcher = turnValueToRegExp(value.join("/"));
        if (matcher.test(result)) {
          result = result.replace(matcher, `/[...${key}]`);
        }
      }
    }
    return result;
  } catch (e) {
    return pathname;
  }
}
function turnValueToRegExp(value) {
  return new RegExp(`/${escapeRegExp(value)}(?=[/?#]|$)`);
}
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getScriptSrc(props) {
  if (props.scriptSrc) {
    return props.scriptSrc;
  }
  if (isDevelopment()) {
    return "https://va.vercel-scripts.com/v1/script.debug.js";
  }
  if (props.basePath) {
    return `${props.basePath}/insights/script.js`;
  }
  return "/_vercel/insights/script.js";
}

// src/generic.ts
function inject(props = {
  debug: true
}) {
  var _a;
  if (!isBrowser()) return;
  setMode(props.mode);
  initQueue();
  if (props.beforeSend) {
    (_a = window.va) == null ? void 0 : _a.call(window, "beforeSend", props.beforeSend);
  }
  const src = getScriptSrc(props);
  if (document.head.querySelector(`script[src*="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  script.dataset.sdkn = name + (props.framework ? `/${props.framework}` : "");
  script.dataset.sdkv = version;
  if (props.disableAutoTrack) {
    script.dataset.disableAutoTrack = "1";
  }
  if (props.endpoint) {
    script.dataset.endpoint = props.endpoint;
  } else if (props.basePath) {
    script.dataset.endpoint = `${props.basePath}/insights`;
  }
  if (props.dsn) {
    script.dataset.dsn = props.dsn;
  }
  script.onerror = () => {
    const errorMessage = isDevelopment() ? "Please check if any ad blockers are enabled and try again." : "Be sure to enable Web Analytics for your project and deploy again. See https://vercel.com/docs/analytics/quickstart for more information.";
    console.log(
      `[Vercel Web Analytics] Failed to load script from ${src}. ${errorMessage}`
    );
  };
  if (isDevelopment() && props.debug === false) {
    script.dataset.debug = "false";
  }
  document.head.appendChild(script);
}
function pageview({
  route,
  path
}) {
  var _a;
  (_a = window.va) == null ? void 0 : _a.call(window, "pageview", { route, path });
}

// src/vue/utils.ts
var import_meta = {};
function getBasePath() {
  try {
    return import_meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH;
  } catch {
  }
}

// src/vue/create-component.ts
function createComponent(framework = "vue") {
  return (0, import_vue.defineComponent)({
    props: ["dsn", "beforeSend", "debug", "scriptSrc", "endpoint", "mode"],
    setup(props) {
      const route = (0, import_vue_router.useRoute)();
      inject({
        ...props,
        basePath: getBasePath(),
        // keep auto-tracking unless we have route support (Nuxt or vue-router).
        disableAutoTrack: Boolean(route),
        framework
      });
      if (route && typeof window !== "undefined") {
        const changeRoute = () => {
          pageview({
            route: computeRoute(route.path, route.params),
            path: route.path
          });
        };
        changeRoute();
        (0, import_vue.watch)(route, changeRoute);
      }
    },
    // Vue component must have a render function, or a template.
    render() {
      return null;
    }
  });
}

// src/vue/index.ts
var Analytics = createComponent();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Analytics
});
//# sourceMappingURL=index.js.map