/**
 * Page Transitions — Webflow / Barba boilerplate
 * ---------------------------------------------------------------------------
 * Linked from the Webflow footer "External File" slot.
 *
 * Expected globals (loaded BEFORE this file, see webflow/footer.html):
 *   - barba        @barba/core 2.10.3   (required)
 *   - gsap         gsap 3.15            (required)
 *   - CustomEase   gsap/CustomEase 3.15 (required)
 *   - Lenis        lenis 1.3.17         (optional — feature detected)
 *   - ScrollTrigger                     (optional — feature detected)
 *
 * Public API (window.PT):
 *   PT.module({ name, selector, init })      register a page/site behaviour
 *   PT.transition({ name, once, leave, enter }) register a transition
 *   PT.config                                 tunables
 *   PT.helpers                                shared utilities
 *   PT.lenis                                  live Lenis instance (or null)
 */
(function (window, document) {
  "use strict";

  if (!window.gsap || !window.barba) {
    console.error("[PT] gsap and barba must be loaded before page-transitions.js");
    return;
  }

  var gsap = window.gsap;
  var barba = window.barba;

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  var config = {
    debug: false,
    timeout: 7000,
    duration: 0.6,
    stagger: 0.05,
    ease: "osmo",
    easeCurve: "0.625, 0.05, 0, 1",
    defaultTransition: "fade",
    webflow: true, // re-init Webflow's own runtime on every page enter
    lenis: { lerp: 0.165, wheelMultiplier: 1.25 },
    themes: {
      light: { nav: "dark", transition: "light" },
      dark: { nav: "light", transition: "dark" }
    }
  };

  // ---------------------------------------------------------------------------
  // ENVIRONMENT
  // ---------------------------------------------------------------------------

  var hasLenis = typeof window.Lenis !== "undefined";
  var hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
  var lenis = null;

  history.scrollRestoration = "manual";

  if (window.CustomEase) {
    gsap.registerPlugin(window.CustomEase);
    window.CustomEase.create(config.ease, config.easeCurve);
  }
  gsap.defaults({ ease: window.CustomEase ? config.ease : "power2.out", duration: config.duration });

  var rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reducedMotion = rmMQ.matches;
  if (rmMQ.addEventListener) rmMQ.addEventListener("change", function (e) { reducedMotion = e.matches; });
  else if (rmMQ.addListener) rmMQ.addListener(function (e) { reducedMotion = e.matches; });

  function log() {
    if (!config.debug) return;
    console.log.apply(console, ["[PT]"].concat(Array.prototype.slice.call(arguments)));
  }

  // ---------------------------------------------------------------------------
  // MODULE REGISTRY
  //
  // A "module" is any behaviour scoped to a page (sliders, marquees, hover fx).
  // Register with PT.module(); the registry handles gating, teardown and order.
  //
  //   PT.module({
  //     name: "marquee",
  //     selector: "[data-marquee]",         // skipped when nothing matches
  //     once: false,                        // true = first load only, never re-run
  //     namespace: ["home", "work"],        // optional barba namespace filter
  //     after: false,                       // true = run after the enter anim
  //     init: function (ctx) {              // ctx: { container, elements, reducedMotion, lenis }
  //       ...
  //       return function cleanup() { ... } // optional, runs on afterLeave
  //     }
  //   });
  // ---------------------------------------------------------------------------

  var modules = [];
  var teardowns = [];
  var onceDone = false;

  function registerModule(def) {
    if (!def || typeof def.init !== "function") {
      console.warn("[PT] module() requires an init function", def);
      return;
    }
    modules.push({
      name: def.name || "anonymous",
      selector: def.selector || null,
      once: !!def.once,
      after: !!def.after,
      namespace: def.namespace ? [].concat(def.namespace) : null,
      init: def.init
    });
    return def;
  }

  function shouldRun(mod, container, namespace) {
    if (mod.namespace && namespace && mod.namespace.indexOf(namespace) === -1) return false;
    if (mod.selector && !container.querySelector(mod.selector)) return false;
    return true;
  }

  function runModules(phase, container, namespace) {
    var root = container || document;
    modules.forEach(function (mod) {
      if (phase === "once" && !mod.once) return;
      if (phase !== "once" && mod.once) return;
      if (phase === "before" && mod.after) return;
      if (phase === "after" && !mod.after) return;
      if (!shouldRun(mod, root, namespace)) return;

      try {
        var cleanup = mod.init({
          container: root,
          elements: mod.selector ? root.querySelectorAll(mod.selector) : [],
          reducedMotion: reducedMotion,
          lenis: lenis
        });
        if (typeof cleanup === "function" && !mod.once) teardowns.push(cleanup);
        log("module:" + mod.name, phase);
      } catch (err) {
        console.error("[PT] module '" + mod.name + "' failed", err);
      }
    });
  }

  function destroyModules() {
    teardowns.splice(0).forEach(function (fn) {
      try { fn(); } catch (err) { console.error("[PT] cleanup failed", err); }
    });
  }

  // ---------------------------------------------------------------------------
  // TRANSITION REGISTRY
  //
  //   PT.transition({
  //     name: "column-wipe",
  //     once:  function (ctx) { return tl },              // ctx: { next, data }
  //     leave: function (ctx) { return tl | Promise },    // ctx: { current, next, trigger, data }
  //     enter: function (ctx) { return tl | Promise }
  //   });
  //
  // Pick per-link with data-transition="column-wipe" on the anchor, per-page
  // with data-transition on the barba container, or globally via
  // PT.config.defaultTransition.
  // ---------------------------------------------------------------------------

  var transitions = {};

  function registerTransition(def) {
    if (!def || !def.name) {
      console.warn("[PT] transition() requires a name", def);
      return;
    }
    transitions[def.name] = def;
    return def;
  }

  function resolveTransition(data) {
    var trigger = data && data.trigger;
    var fromLink = trigger && trigger.getAttribute && trigger.getAttribute("data-transition");
    var fromPage = data && data.next && data.next.container &&
      data.next.container.getAttribute("data-transition");
    var name = fromLink || fromPage || config.defaultTransition;
    return transitions[name] || transitions[config.defaultTransition] || transitions.fade;
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  function initLenis() {
    if (lenis || !hasLenis) return lenis;

    lenis = new window.Lenis(config.lenis);

    if (hasScrollTrigger) lenis.on("scroll", window.ScrollTrigger.update);

    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    PT.lenis = lenis;
    return lenis;
  }

  function stopScroll() { if (lenis && lenis.stop) lenis.stop(); }
  function startScroll() { if (lenis && lenis.start) lenis.start(); }

  function refreshScroll() {
    if (lenis && lenis.resize) lenis.resize();
    if (hasScrollTrigger) window.ScrollTrigger.refresh();
  }

  /** Drop the fixed positioning applied during the swap and hand scroll back. */
  function resetPage(container) {
    window.scrollTo(0, 0);
    if (container) gsap.set(container, { clearProps: "position,top,left,right" });
    if (lenis && lenis.resize) lenis.resize();
    startScroll();
  }

  function applyThemeFrom(container) {
    var pageTheme = (container && container.dataset && container.dataset.pageTheme) || "light";
    var theme = config.themes[pageTheme] || config.themes.light;

    document.body.dataset.pageTheme = pageTheme;

    var transitionEl = document.querySelector("[data-theme-transition]");
    if (transitionEl) transitionEl.dataset.themeTransition = theme.transition;

    var nav = document.querySelector("[data-theme-nav]");
    if (nav) nav.dataset.themeNav = theme.nav;
  }

  /**
   * Re-initialise Webflow's own runtime after a container swap.
   *
   * Webflow's webflow.js binds IX2 interactions, sliders, tabs, dropdowns, the
   * navbar, lightbox and form handling once, on real page load. Barba replaces
   * the container without a load event, so every page after the first arrives
   * with dead Webflow components unless we rebind them by hand.
   *
   * data-wf-page on <html> is how Webflow scopes page-specific IX2 triggers and
   * CMS behaviour. Barba never touches <html>, so without this the site keeps
   * running the FIRST page's interactions forever.
   */
  function reinitWebflow(data) {
    if (!config.webflow) return;

    var wf = window.Webflow;
    if (!wf) return;

    if (data && data.next && data.next.html) {
      try {
        var doc = new DOMParser().parseFromString(data.next.html, "text/html");
        var pageId = doc.documentElement.getAttribute("data-wf-page");
        if (pageId) document.documentElement.setAttribute("data-wf-page", pageId);
      } catch (err) {
        console.error("[PT] could not read data-wf-page from the next page", err);
      }
    }

    try {
      wf.destroy();
      wf.ready(); // rebinds sliders, tabs, dropdowns, navbar, forms

      // IX2 is not covered by ready() and must be re-initialised explicitly.
      var ix2 = wf.require && wf.require("ix2");
      if (ix2 && ix2.init) ix2.init();

      var lightbox = wf.require && wf.require("lightbox");
      if (lightbox && lightbox.ready) lightbox.ready();

      document.dispatchEvent(new Event("readystatechange"));
      log("webflow re-initialised");
    } catch (err) {
      console.error("[PT] Webflow re-init failed", err);
    }
  }

  /**
   * Sync nav state (aria-current + classes) from the incoming HTML when the nav
   * lives OUTSIDE the barba container and therefore never gets replaced.
   */
  function syncNav(data) {
    if (!data || !data.next || !data.next.html) return;

    var tpl = document.createElement("template");
    tpl.innerHTML = data.next.html.trim();

    var nextNodes = tpl.content.querySelectorAll("[data-barba-update]");
    var currentNodes = document.querySelectorAll("nav [data-barba-update]");

    currentNodes.forEach(function (curr, index) {
      var next = nextNodes[index];
      if (!next) return;

      var status = next.getAttribute("aria-current");
      if (status !== null) curr.setAttribute("aria-current", status);
      else curr.removeAttribute("aria-current");

      curr.setAttribute("class", next.getAttribute("class") || "");
    });
  }

  /** Resolve a gsap timeline once its "pageReady" label is reached. */
  function readyAt(tl, container) {
    tl.add("pageReady");
    tl.call(resetPage, [container], "pageReady");
    return new Promise(function (resolve) { tl.call(resolve, null, "pageReady"); });
  }

  function debounceOnWidthChange(fn, ms) {
    var last = window.innerWidth;
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (window.innerWidth !== last) {
          last = window.innerWidth;
          fn.apply(ctx, args);
        }
      }, ms);
    };
  }

  // ---------------------------------------------------------------------------
  // BUILT-IN TRANSITIONS
  // ---------------------------------------------------------------------------

  registerTransition({
    name: "fade",

    once: function (ctx) {
      var tl = gsap.timeline();
      tl.call(function () { resetPage(ctx.next); }, null, 0);
      return tl;
    },

    leave: function (ctx) {
      var tl = gsap.timeline();
      if (reducedMotion) return tl.set(ctx.current, { autoAlpha: 0 });
      tl.to(ctx.current, { autoAlpha: 0, duration: 0.4 });
      return tl;
    },

    enter: function (ctx) {
      var tl = gsap.timeline();

      if (reducedMotion) {
        tl.set(ctx.next, { autoAlpha: 1 });
        return readyAt(tl, ctx.next);
      }

      tl.add("startEnter", 0.6);
      tl.fromTo(ctx.next, { autoAlpha: 0 }, { autoAlpha: 1 }, "startEnter");
      return readyAt(tl, ctx.next);
    }
  });

  registerTransition({
    name: "column-wipe",

    once: function (ctx) {
      var tl = gsap.timeline();
      tl.call(function () { resetPage(ctx.next); }, null, 0);
      return tl;
    },

    leave: function (ctx) {
      var columns = document.querySelectorAll("[data-transition-wrap] [data-transition-column]");
      var tl = gsap.timeline();

      if (reducedMotion || !columns.length) return tl.set(ctx.current, { autoAlpha: 0 });

      tl.set(ctx.next, { autoAlpha: 0 }, 0);
      tl.fromTo(columns,
        { yPercent: 0 },
        { yPercent: 100, duration: 0.6, stagger: { each: 0.06, from: "end" } },
        0
      );
      return tl;
    },

    enter: function (ctx) {
      var columns = document.querySelectorAll("[data-transition-wrap] [data-transition-column]");
      var tl = gsap.timeline();

      if (reducedMotion || !columns.length) {
        tl.set(ctx.next, { autoAlpha: 1 });
        return readyAt(tl, ctx.next);
      }

      tl.add("startEnter", 1);
      tl.set(ctx.next, { autoAlpha: 1 }, "startEnter");
      tl.to(columns, { yPercent: 200, duration: 0.6, stagger: 0.06, overwrite: "auto" }, "startEnter");
      return readyAt(tl, ctx.next);
    }
  });

  // ---------------------------------------------------------------------------
  // BARBA WIRING
  // ---------------------------------------------------------------------------

  // Teardown happens in beforeLeave, not afterLeave: with `sync: true` barba
  // fires beforeEnter *before* afterLeave, so cleaning up later would destroy
  // the incoming page's modules and ScrollTriggers instead of the outgoing ones.
  barba.hooks.beforeLeave(function () {
    destroyModules();
    if (hasScrollTrigger) {
      window.ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
    }
  });

  barba.hooks.beforeEnter(function (data) {
    // Stack the incoming container on top of the outgoing one.
    gsap.set(data.next.container, { position: "fixed", top: 0, left: 0, right: 0 });

    stopScroll();
    applyThemeFrom(data.next.container);

    // Webflow must be rebound before our own modules run, so modules can rely
    // on sliders/tabs/IX2 already being live on the incoming container.
    reinitWebflow(data);

    runModules("before", data.next.container, data.next.namespace);
  });

  barba.hooks.enter(function (data) {
    syncNav(data);
  });

  barba.hooks.afterEnter(function (data) {
    runModules("after", data.next.container, data.next.namespace);
    startScroll();
    refreshScroll();
  });

  function boot() {
    barba.init({
      debug: config.debug,
      timeout: config.timeout,
      preventRunning: true,
      transitions: [
        {
          name: "registry",
          sync: true,

          once: function (data) {
            initLenis();
            if (!onceDone) {
              onceDone = true;
              runModules("once", data.next.container, data.next.namespace);
            }
            runModules("before", data.next.container, data.next.namespace);
            runModules("after", data.next.container, data.next.namespace);
            applyThemeFrom(data.next.container);

            var t = resolveTransition(data);
            return t.once ? t.once({ next: data.next.container, data: data }) : undefined;
          },

          leave: function (data) {
            var t = resolveTransition(data);
            var tl = t.leave({
              current: data.current.container,
              next: data.next.container,
              trigger: data.trigger,
              data: data
            });
            // Remove the old container once the leave animation settles.
            return Promise.resolve(tl).then(function () {
              if (data.current.container && data.current.container.parentNode) {
                data.current.container.remove();
              }
            });
          },

          enter: function (data) {
            var t = resolveTransition(data);
            return t.enter({
              current: data.current && data.current.container,
              next: data.next.container,
              trigger: data.trigger,
              data: data
            });
          }
        }
      ]
    });
    log("initialised");
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  var PT = {
    config: config,
    lenis: null,
    module: registerModule,
    transition: registerTransition,
    modules: modules,
    transitions: transitions,
    helpers: {
      initLenis: initLenis,
      stopScroll: stopScroll,
      startScroll: startScroll,
      refreshScroll: refreshScroll,
      resetPage: resetPage,
      applyThemeFrom: applyThemeFrom,
      reinitWebflow: reinitWebflow,
      syncNav: syncNav,
      readyAt: readyAt,
      debounceOnWidthChange: debounceOnWidthChange,
      isReducedMotion: function () { return reducedMotion; }
    }
  };

  window.PT = PT;

  // Let inline <script> tags in the Webflow footer register modules before init.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // ---------------------------------------------------------------------------
  // YOUR MODULES GO BELOW HERE
  //
  // PT.module({
  //   name: "example",
  //   selector: "[data-example]",
  //   init: function (ctx) {
  //     var tl = gsap.timeline();
  //     tl.from(ctx.elements, { y: 40, autoAlpha: 0, stagger: PT.config.stagger });
  //     return function () { tl.kill(); };
  //   }
  // });
  // ---------------------------------------------------------------------------

})(window, document);
