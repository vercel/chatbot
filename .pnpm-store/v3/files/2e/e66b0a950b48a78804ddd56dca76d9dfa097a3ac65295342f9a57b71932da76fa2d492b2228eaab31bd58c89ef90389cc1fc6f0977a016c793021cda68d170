!function (e) {
  var r = {};

  function t(n) {
    if (r[n]) return r[n].exports;
    var o = r[n] = {i: n, l: !1, exports: {}};
    return e[n].call(o.exports, o, o.exports, t), o.l = !0, o.exports
  }

  t.m = e, t.c = r, t.d = function (e, r, n) {
    t.o(e, r) || Object.defineProperty(e, r, {enumerable: !0, get: n})
  }, t.r = function (e) {
    "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {value: "Module"}), Object.defineProperty(e, "__esModule", {value: !0})
  }, t.t = function (e, r) {
    if (1 & r && (e = t(e)), 8 & r) return e;
    if (4 & r && "object" == typeof e && e && e.__esModule) return e;
    var n = Object.create(null);
    if (t.r(n), Object.defineProperty(n, "default", {
      enumerable: !0,
      value: e
    }), 2 & r && "string" != typeof e) for (var o in e) t.d(n, o, function (r) {
      return e[r]
    }.bind(null, o));
    return n
  }, t.n = function (e) {
    var r = e && e.__esModule ? function () {
      return e.default
    } : function () {
      return e
    };
    return t.d(r, "a", r), r
  }, t.o = function (e, r) {
    return Object.prototype.hasOwnProperty.call(e, r)
  }, t.p = "", t(t.s = 1)
}([function (e, r) {
  e.exports = a
}, function (e, r, t) {
  e.exports = t(2)
}, function (e, r, t) {
  "use strict";
  t.r(r), t.d(r, "RemoveScroll", (function () {
    return c
  }));
  var n = t(0), o = Object(n.createSidecarMedium)();

  function a(e, r) {
    return t = r, o = function (r) {
      return e.forEach((function (e) {
        return function (e, r) {
          return "function" == typeof e ? e(r) : e && (e.current = r), e
        }(e, r)
      }))
    }, (a = Object(n.useState)((function () {
      return {
        value: t, callback: o, facade: {
          get current() {
            return a.value
          }, set current(e) {
            var r = a.value;
            r !== e && (a.value = e, a.callback(e, r))
          }
        }
      }
    }))[0]).callback = o, a.facade;
    var t, o, a
  }

  var l = function () {
  }, c = n.forwardRef((function (e, r) {
    var t = n.useRef(null), c = n.useState({onScrollCapture: l, onWheelCapture: l, onTouchMoveCapture: l}), u = c[0],
      i = c[1], s = e.forwardProps, f = e.children, d = e.className, b = e.removeScrollBar, p = e.enabled, v = e.shards,
      m = e.sideCar, _ = e.noIsolation, h = e.inert, g = e.allowPinchZoom, j = e.as, O = void 0 === j ? "div" : j,
      y = Object(n.__rest)(e, ["forwardProps", "children", "className", "removeScrollBar", "enabled", "shards", "sideCar", "noIsolation", "inert", "allowPinchZoom", "as"]),
      S = m, P = a([t, r]), w = Object(n.__assign)(Object(n.__assign)({}, y), u);
    return n.createElement(n.Fragment, null, p && n.createElement(S, {
      sideCar: o,
      removeScrollBar: b,
      shards: v,
      noIsolation: _,
      inert: h,
      setCallbacks: i,
      allowPinchZoom: !!g,
      lockRef: t
    }), s ? n.cloneElement(n.Children.only(f), Object(n.__assign)(Object(n.__assign)({}, w), {ref: P})) : n.createElement(O, Object(n.__assign)({}, w, {
      className: d,
      ref: P
    }), f))
  }));
  c.defaultProps = {enabled: !0, removeScrollBar: !0, inert: !1}, c.classNames = {
    fullWidth: "width-before-scroll-bar",
    zeroRight: "right-scroll-bar-position"
  }
}]);