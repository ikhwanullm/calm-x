/*
 * Calm-X prototype runtime.
 *
 * A tiny stand-in for the Design canvas runtime so the exported *.dc.html
 * screens open directly in a browser (file:// or any static server).
 * It supports exactly what the prototype uses: {{holes}}, <sc-for>, <sc-if>,
 * on* event bindings, and a DCLogic base class with setState().
 *
 * PROTOTYPE ONLY. Do not copy this file or its patterns into the real app.
 */
(function () {
  'use strict';

  var hide = document.createElement('style');
  hide.textContent = 'x-dc{display:none!important}';
  document.head.appendChild(hide);

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
  var WHOLE = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/;
  var params = new URLSearchParams(location.search);
  var dark = params.get('dark') === '1';

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (update) {
    var patch = typeof update === 'function' ? update(this.state, this.props) : update;
    this.state = Object.assign({}, this.state, patch);
    if (this.__schedule) this.__schedule();
  };
  DCLogic.prototype.forceUpdate = function () {
    if (this.__schedule) this.__schedule();
  };

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    if (/^'.*'$|^".*"$/.test(expr)) return expr.slice(1, -1);
    var parts = expr.split('.');
    var value = scope;
    for (var i = 0; i < parts.length; i++) {
      if (value == null) return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  function interpolate(text, scope) {
    return text.replace(HOLE, function (_, expr) {
      var value = lookup(expr, scope);
      return value == null ? '' : String(value);
    });
  }

  function attrExpr(node, name) {
    var raw = node.getAttribute(name) || '';
    var match = WHOLE.exec(raw);
    return match ? match[1] : raw;
  }

  function eventName(attr, node) {
    var name = attr.slice(2).toLowerCase();
    if (name === 'change') {
      var type = (node.getAttribute('type') || '').toLowerCase();
      var textInput = node.localName === 'input' && type !== 'checkbox' && type !== 'radio';
      if (textInput || node.localName === 'textarea') return 'input';
    }
    return name;
  }

  // Keep ?dark=1 when moving between prototype screens.
  function fixHref(href) {
    if (!dark || !/\.dc\.html(#.*)?$/.test(href)) return href;
    var parts = href.split('#');
    return parts[0] + '?dark=1' + (parts[1] ? '#' + parts[1] : '');
  }

  function renderNodes(nodes, scope, parent) {
    for (var i = 0; i < nodes.length; i++) renderNode(nodes[i], scope, parent);
  }

  function renderNode(node, scope, parent) {
    if (node.nodeType === 3) {
      parent.appendChild(document.createTextNode(interpolate(node.nodeValue, scope)));
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = node.localName;
    if (tag === 'sc-for') {
      var list = lookup(attrExpr(node, 'list'), scope) || [];
      var as = node.getAttribute('as') || 'item';
      list.forEach(function (item, index) {
        var inner = Object.create(scope);
        inner[as] = item;
        inner.$index = index;
        renderNodes(node.childNodes, inner, parent);
      });
      return;
    }
    if (tag === 'sc-if') {
      if (lookup(attrExpr(node, 'value'), scope)) renderNodes(node.childNodes, scope, parent);
      return;
    }
    if (tag === 'dc-import' || tag === 'helmet') return;

    var el = node.namespaceURI === SVG_NS
      ? document.createElementNS(SVG_NS, tag)
      : document.createElement(tag);
    var props = [];

    for (var a = 0; a < node.attributes.length; a++) {
      var name = node.attributes[a].name;
      var value = node.attributes[a].value;
      var match = WHOLE.exec(value);
      if (!match) {
        var text = interpolate(value, scope);
        el.setAttribute(name, name === 'href' ? fixHref(text) : text);
        continue;
      }
      var raw = lookup(match[1], scope);
      if (name.slice(0, 2) === 'on') {
        if (typeof raw === 'function') el.addEventListener(eventName(name, node), raw);
      } else if (name === 'checked' || name === 'value' || name === 'disabled' || name === 'selected') {
        props.push([name, raw]);
      } else if (name.slice(0, 5) === 'aria-') {
        el.setAttribute(name, String(raw));
      } else if (raw !== false && raw != null) {
        el.setAttribute(name, raw === true ? '' : String(raw));
      }
    }

    renderNodes(node.childNodes, scope, el);
    parent.appendChild(el);

    props.forEach(function (p) {
      if (p[0] === 'value') el.value = p[1] == null ? '' : p[1];
      else el[p[0]] = !!p[1];
    });
  }

  function saveFocus(root) {
    var active = document.activeElement;
    if (!active || active === root || !root.contains(active)) return null;
    var path = [];
    for (var n = active; n !== root; n = n.parentNode) {
      path.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n));
    }
    var saved = { path: path };
    try { saved.start = active.selectionStart; saved.end = active.selectionEnd; } catch (e) { /* not a text field */ }
    return saved;
  }

  function restoreFocus(root, saved) {
    if (!saved) return;
    var el = root;
    for (var i = 0; i < saved.path.length && el; i++) el = el.childNodes[saved.path[i]];
    if (!el || typeof el.focus !== 'function') return;
    el.focus();
    try { if (saved.start != null) el.setSelectionRange(saved.start, saved.end); } catch (e) { /* not a text field */ }
  }

  function addToolbar() {
    var screens = [['Main.dc.html', 'Dashboard'], ['Project.dc.html', 'Project detail'], ['Review.dc.html', 'Weekly review']];
    var bar = document.createElement('nav');
    bar.setAttribute('aria-label', 'Prototype screens');
    bar.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:50;display:flex;gap:6px;align-items:center;padding:6px 8px;border-radius:10px;background:rgba(20,20,18,.86);color:#fff;font:12px/1.4 system-ui,sans-serif;';
    var label = document.createElement('a');
    label.href = 'index.html';
    label.textContent = 'Prototype';
    label.style.cssText = 'color:#fff;font-weight:600;text-decoration:none;padding:4px 6px;';
    bar.appendChild(label);
    screens.forEach(function (s) {
      var link = document.createElement('a');
      link.href = fixHref(s[0]);
      link.textContent = s[1];
      var current = location.pathname.slice(-s[0].length) === s[0];
      link.style.cssText = 'color:#fff;text-decoration:none;padding:4px 8px;border-radius:6px;' + (current ? 'background:rgba(255,255,255,.18);' : '');
      bar.appendChild(link);
    });
    var toggle = document.createElement('a');
    var next = new URLSearchParams(location.search);
    if (dark) next.delete('dark'); else next.set('dark', '1');
    toggle.href = location.pathname.split('/').pop() + (next.toString() ? '?' + next.toString() : '');
    toggle.textContent = dark ? 'Light mode' : 'Dark mode';
    toggle.style.cssText = 'color:#fff;text-decoration:underline;padding:4px 8px;';
    bar.appendChild(toggle);
    document.body.appendChild(bar);
  }

  function mount() {
    var host = document.querySelector('x-dc');
    var script = document.querySelector('script[data-dc-script]');
    if (!host || !script) return;

    var helmet = host.querySelector('helmet');
    if (helmet) {
      Array.prototype.slice.call(helmet.childNodes).forEach(function (n) {
        if (n.nodeType === 1) document.head.appendChild(n);
      });
    }
    var template = Array.prototype.slice.call(host.childNodes).filter(function (n) { return n !== helmet; });
    host.parentNode.removeChild(host);

    var Component = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    var root = document.createElement('div');
    root.id = 'dc-root';
    document.body.insertBefore(root, document.body.firstChild);

    var instance = new Component({ dark: dark });
    var queued = false;
    function render() {
      queued = false;
      var focus = saveFocus(root);
      var fragment = document.createDocumentFragment();
      renderNodes(template, instance.renderVals(), fragment);
      root.replaceChildren(fragment);
      restoreFocus(root, focus);
    }
    instance.__schedule = function () {
      if (queued) return;
      queued = true;
      Promise.resolve().then(render);
    };

    render();
    if (typeof instance.componentDidMount === 'function') instance.componentDidMount();
    addToolbar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
