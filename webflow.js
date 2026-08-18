// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let nextPage = document;
let onceFunctionsInitialized = false;

const hasLenis = typeof window.Lenis !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";

const rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.("change", e => (reducedMotion = e.matches));
rmMQ.addListener?.(e => (reducedMotion = e.matches));

const has = (s) => !!nextPage.querySelector(s);

let staggerDefault = 0.05;
let durationDefault = 0.6;

CustomEase.create("osmo", "0.625, 0.05, 0, 1");
gsap.defaults({ ease: "osmo", duration: durationDefault });



// -----------------------------------------
// FUNCTION REGISTRY
// -----------------------------------------

function initOnceFunctions() {
  initLenis();
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;

  // Runs once on first load
  // if (has('[data-something]')) initSomething();
  if (has('[data-bottom-nav-init]')) initExpandingBottomNav();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Runs before the enter animation
  // if (has('[data-something]')) initSomething();
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // Runs after enter animation completes
  // if (has('[data-something]')) initSomething();

  initWebflowForms();

  if(hasLenis){
    lenis.resize();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}



// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const tl = gsap.timeline();

  tl.call(() => {
    resetPage(next);
  }, null, 0);

  return tl;
}

function runPageLeaveAnimation(current, next) {

  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    }
  })

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, {
    autoAlpha: 0,
    ease: "power1.in",
    duration: 0.5,
  }, 0);

  return tl;
}

function runPageEnterAnimation(next){
  const tl = gsap.timeline();

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    tl.set(next, { autoAlpha: 1 });
    tl.add("pageReady")
    tl.call(resetPage, [next], "pageReady");
    return new Promise(resolve => tl.call(resolve, null, "pageReady"));
  }

  tl.add("startEnter", 0);

  tl.fromTo(next, {
    autoAlpha: 0,
  }, {
    autoAlpha: 1,
    ease: "power1.inOut",
    duration: 0.75,
  }, "startEnter");

  tl.fromTo(next.querySelector('h1'), {
    yPercent: 25,
    autoAlpha: 0,
  }, {
    yPercent: 0,
    autoAlpha: 1,
    ease: "expo.out",
    duration: 1,
  }, "< 0.3");

  tl.add("pageReady");
  tl.call(resetPage, [next], "pageReady");

  return new Promise(resolve => {
    tl.call(resolve, null, "pageReady");
  });
}


// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

barba.hooks.beforeEnter(data => {
  // Position new container on top
  gsap.set(data.next.container, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
  });

  if (lenis && typeof lenis.stop === "function") {
    lenis.stop();
  }

  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  if(hasScrollTrigger){
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }
});

barba.hooks.enter(data => {
  initBarbaNavUpdate(data);
})

barba.hooks.afterEnter(data => {
  // Run page functions
  initAfterEnterFunctions(data.next.container);

  // Settle
  if(hasLenis){
    lenis.resize();
    lenis.start();
  }

  if(hasScrollTrigger){
    ScrollTrigger.refresh();
  }
});

barba.init({
  debug: true, // Set to 'false' in production
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: "default",
      sync: true,

      // First load
      async once(data) {
        initOnceFunctions();

        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(data.current.container, data.next.container);
      },

      // New page enters
      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      }
    }
  ],
});



// -----------------------------------------
// GENERIC + HELPERS
// -----------------------------------------

const themeConfig = {
  light: {
    nav: "dark",
    transition: "light"
  },
  dark: {
    nav: "light",
    transition: "dark"
  }
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || "light";
  const config = themeConfig[pageTheme] || themeConfig.light;

  document.body.dataset.pageTheme = pageTheme;
  const transitionEl = document.querySelector('[data-theme-transition]');
  if (transitionEl) {
    transitionEl.dataset.themeTransition = config.transition;
  }

  const nav = document.querySelector('[data-theme-nav]');
  if (nav) {
    nav.dataset.themeNav = config.nav;
  }
}

function initLenis() {
  if (lenis) return; // already created
  if (!hasLenis) return;

  lenis = new Lenis({
    lerp: 0.165,
    wheelMultiplier: 1.25,
  });

  if (hasScrollTrigger) {
    lenis.on("scroll", ScrollTrigger.update);
  }

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function resetPage(container){
  window.scrollTo(0, 0);
  gsap.set(container, { clearProps: "position,top,left,right" });

  if(hasLenis){
    lenis.resize();
    lenis.start();
  }
}

function debounceOnWidthChange(fn, ms) {
  let last = innerWidth,
    timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth !== last) {
        last = innerWidth;
        fn.apply(this, args);
      }
    }, ms);
  };
}

function initBarbaNavUpdate(data) {
  var tpl = document.createElement('template');
  tpl.innerHTML = data.next.html.trim();
  var nextNodes = tpl.content.querySelectorAll('[data-barba-update]');
  var currentNodes = document.querySelectorAll('nav [data-barba-update]');

  currentNodes.forEach(function (curr, index) {
    var next = nextNodes[index];
    if (!next) return;

    // Aria-current sync
    var newStatus = next.getAttribute('aria-current');
    if (newStatus !== null) {
      curr.setAttribute('aria-current', newStatus);
    } else {
      curr.removeAttribute('aria-current');
    }

    // Class list sync
    var newClassList = next.getAttribute('class') || '';
    curr.setAttribute('class', newClassList);
  });
}



// -----------------------------------------
// WEBFLOW SPA FORMS + TURNSTILE RESET
// -----------------------------------------

let webflowFormsFirstLoad = true;

function initWebflowForms() {
  if (webflowFormsFirstLoad) {
    webflowFormsFirstLoad = false;
    return;
  }
  requestAnimationFrame(() => {
    resetWebflowForms();
    resetTurnstile();
  });
}

function resetWebflowForms() {
  const w = window.Webflow;
  if (!w) return;
  w.destroy();
  w.ready();
  if (w.require) {
    const forms = w.require("forms");
    if (forms && forms.preview) forms.preview();
  }
  document.querySelectorAll(".w-form").forEach((wrapper) => {
    wrapper.classList.remove("w-form-loading");
    wrapper.querySelectorAll('[type="submit"]').forEach((btn) => {
      btn.classList.remove("w-form-loading");
      btn.removeAttribute("disabled");
    });
  });
}

function resetTurnstile() {
  if (!window.turnstile) return;
  document.querySelectorAll(".w-form form").forEach((form) => {
    const sitekey = form.getAttribute("data-turnstile-sitekey");
    if (!sitekey) return;
    form.querySelectorAll('[id^="cf-chl-widget"]').forEach((el) => el.remove());
    form.querySelectorAll(".cf-turnstile").forEach((el) => el.remove());
    const container = document.createElement("div");
    form.appendChild(container);
    window.turnstile.render(container, { sitekey });
  });
}



// -----------------------------------------
// YOUR FUNCTIONS GO BELOW HERE
// -----------------------------------------

function initExpandingBottomNav() {
  const nav = document.querySelector("[data-bottom-nav-init]");
  if (!nav) return;

  const inner = nav.querySelector("[data-bottom-nav-inner]");
  const bar = nav.querySelector("[data-bottom-nav-bar]");
  const panel = nav.querySelector("[data-bottom-nav-panel]");
  const toggle = nav.querySelector("[data-bottom-nav-toggle]");
  if (!inner || !bar || !panel || !toggle) return;

  const reveals = panel.querySelectorAll("[data-bottom-nav-reveal]");
  const barTop = toggle.querySelector(".bottom-nav__toggle-bar.is--top");
  const barBot = toggle.querySelector(".bottom-nav__toggle-bar.is--btm");
  const divider = nav.querySelector("[data-bottom-nav-divider]")

  let isOpen = false;
  let enterEnd = 0;
  let dimensions = { closedW: 0, closedH: 0, openW: 0, openH: 0 };
  let tl;

  function measure() {
    const w = inner.style.width;
    const h = inner.style.height;
    inner.style.width = "var(--open-width)";
    inner.style.height = "auto";
    const openW = inner.offsetWidth;
    const openH = inner.offsetHeight;
    inner.style.width = "var(--closed-width)";
    const closedW = inner.offsetWidth;
    inner.style.width = w;
    inner.style.height = h;
    return { closedW, closedH: bar.offsetHeight, openW, openH };
  }

  function applyClosed() {
    gsap.set(inner, { width: dimensions.closedW, height: dimensions.closedH });
  }

  function buildTimeline() {
    tl = gsap.timeline({
      paused: true,
      defaults: { ease: "osmo", easeReverse: "power2.inOut" },
    });

    tl.to(inner, {
        width: () => dimensions.openW,
        height: () => dimensions.openH,
        duration: 0.65
      }, 0)

      .to(barTop, {
        y: "0.175em",
        rotation: 45,
        duration: 0.4,
        ease: "back.out(2)",
        easeReverse: "power3.out"
      }, 0.05)

      .to(barBot, {
        y: "-0.175em",
        rotation: -45,
        duration: 0.4,
        ease: "back.out(2)",
        easeReverse: "power3.out"
      }, 0.05)

      .set(panel, {
        autoAlpha: 1
      }, 0.1)

      .fromTo(reveals, {
        autoAlpha: 0,
        yPercent: 100
      }, {
        autoAlpha: 1,
        yPercent: 0,
        duration: 0.6,
        stagger: 0.03
      }, 0.1);

      if(divider) {
        tl.fromTo(divider, {
          scaleX: 0,
          autoAlpha: 0
        },{
          scaleX: 1,
          autoAlpha: 1,
          duration: 1.1
        }, 0)
      }


    enterEnd = tl.duration();
    tl.addPause();

    // Close half
    tl.to(reveals, { autoAlpha: 0, yPercent: 10, duration: 0.25, stagger: { each: 0.01, from: "end" } })
      .to(inner, { width: () => dimensions.closedW, height: () => dimensions.closedH, duration: 0.45, ease: "power3.inOut" }, "<")
      .to([barTop, barBot], { y: 0, rotation: 0, duration: 0.3, ease: "power3.in" }, "<")
      .set(panel, { autoAlpha: 0 });
  }

  function setState(open) {
    isOpen = open;
    nav.setAttribute("data-bottom-nav-open", String(open));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "close menu" : "open menu");
    panel.setAttribute("aria-hidden", String(!open));
  }

  function toggleNav() {
    setState(!isOpen);
    if (isOpen) {
      tl.invalidate();
      if (tl.time() >= enterEnd) tl.timeScale(1).restart();
      else tl.timeScale(1).play();
    } else if (tl.time() < enterEnd) {
      tl.timeScale(1).reverse();
    } else {
      tl.timeScale(1).play();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape" && isOpen) {
      toggleNav();
      toggle.focus();
    }
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      dimensions = measure();
      if (isOpen) gsap.set(inner, { width: dimensions.openW, height: dimensions.openH });
      else {
        tl.invalidate();
        applyClosed();
      }
    }, 150);
  }

  dimensions = measure();
  applyClosed();
  buildTimeline();

  toggle.addEventListener("click", toggleNav);
  document.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
}
