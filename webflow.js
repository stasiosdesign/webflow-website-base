// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let nextPage = document;
let onceFunctionsInitialized = false;

const hasLenis = typeof window.Lenis !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";

if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

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
  if (has('[data-stacking-cards-init]')) initStackingStickyCardsBounce();

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

function initStackingStickyCardsBounce() {
  if (!hasScrollTrigger) return;

  const cardsSections = document.querySelectorAll('[data-stacking-cards-init]');

  const currentTier = getCurrentViewportTier();
  window.viewportTier = currentTier;

  ScrollTrigger.getAll().forEach((trigger) => {
    cardsSections.forEach((section) => {
      if (section.contains(trigger.trigger)) trigger.kill();
    });
  });

  cardsSections.forEach((section) => {
    section.querySelectorAll('[data-stacking-card-target]').forEach((el) => {
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: 'all' });
    });
  });

  cardsSections.forEach((section) => {
    const tier = currentTier;

    const isEnabled = (tier === 'desktop' && section.dataset.stackingCardsDesktop === 'true') ||
      (tier === 'tablet' && section.dataset.stackingCardsTablet === 'true') ||
      ((tier === 'mobile-portrait' || tier === 'mobile-landscape') &&
        section.dataset.stackingCardsMobile === 'true'
      );

    if (!isEnabled) return;

    const cards = Array.from(section.querySelectorAll('[data-stacking-card]'));
    if (!cards.length) return;

    const stickyTop = parseFloat(getComputedStyle(cards[0]).top) || 0;

    const rotateValues = (() => {
      if (tier === 'desktop') return parseRotateValues(section, 'data-stacking-cards-desktop-rotate');
      if (tier === 'tablet') return parseRotateValues(section, 'data-stacking-cards-tablet-rotate');
      return parseRotateValues(section, 'data-stacking-cards-mobile-rotate');
    })();

    const xValues = (() => {
      if (tier === 'desktop') return parseAxisValues(section, 'data-stacking-cards-desktop-x');
      if (tier === 'tablet') return parseAxisValues(section, 'data-stacking-cards-tablet-x');
      return parseAxisValues(section, 'data-stacking-cards-mobile-x');
    })();

    const yValues = (() => {
      if (tier === 'desktop') return parseAxisValues(section, 'data-stacking-cards-desktop-y');
      if (tier === 'tablet') return parseAxisValues(section, 'data-stacking-cards-tablet-y');
      return parseAxisValues(section, 'data-stacking-cards-mobile-y');
    })();

    cards.forEach((card, index) => {
      const targetEl = card.querySelector('[data-stacking-card-target]');
      if (!targetEl) return;

      const rotate = rotateValues[index % rotateValues.length];
      const x = xValues[index % xValues.length];
      const y = yValues[index % yValues.length];

      gsap.set(targetEl, {
        rotate: 0,
        x: 0,
        y: 0,
        scale: 1,
        zIndex: cards.length - index
      });

      gsap.to(targetEl, {
        rotate,
        x,
        y,
        ease: 'power1.in',
        overwrite: 'auto',
        scrollTrigger: {
          id: `stacking-rotate-${index}`,
          trigger: card,
          start: 'top 75%',
          end: `top-=${stickyTop} top`,
          scrub: true
        }
      });

      ScrollTrigger.create({
        id: `stacking-bounce-${index}`,
        trigger: card,
        start: `top-=${stickyTop} top`,
        onEnter: () => pulseElement(targetEl)
      });
    });
  });

  ScrollTrigger.refresh();

  function parseRotateValues(section, attr) {
    const fallback = [0, 4, -4];
    const values = (section.getAttribute(attr) || '').split(',').map((val) => parseFloat(val.trim()));
    return values.length >= 1 && values.every((v) => !isNaN(v)) ? values : fallback;
  }

  function parseAxisValues(section, attr) {
    const raw = section.getAttribute(attr);
    if (!raw) return ['0em', '0em', '0em'];
    const values = raw.split(',').map((val) => val.trim()).filter((val) => val !== '');
    return values.length ? values : ['0em', '0em', '0em'];
  }

  if (!window._hasStackingResizeListener) {
    let last = getCurrentViewportTier();

    window.addEventListener('resize', debounceOnWidthChange(() => {
      const next = getCurrentViewportTier();

      if (last !== next) {
        ScrollTrigger.getAll().forEach((t) => {
          if (t.vars?.id?.startsWith('stacking')) t.kill();
        });

        cardsSections.forEach((section) => {
          section.querySelectorAll('[data-stacking-card-target]').forEach((el) => {
            gsap.killTweensOf(el);
            gsap.set(el, { clearProps: 'all' });
          });
        });

        initStackingStickyCardsBounce();
      }

      last = next;
      window.viewportTier = next;
    }, 250));

    window._hasStackingResizeListener = true;
  }

  // Helper: Get Current Viewport Tier
  function getCurrentViewportTier() {
    const width = window.innerWidth;

    if (width <= 479) return 'mobile-portrait';
    if (width <= 767) return 'mobile-landscape';
    if (width <= 991) return 'tablet';
    return 'desktop';
  }

  // Helper: Pulse pulse (Bounce Animation)
  function pulseElement(targetEl) {
    const width = targetEl.offsetWidth;
    const height = targetEl.offsetHeight;
    const fontSize = parseFloat(getComputedStyle(targetEl).fontSize);
    const stretchPx = 1.5 * fontSize;
    const targetScaleX = (width + stretchPx) / width;
    const targetScaleY = (height - stretchPx * 0.33) / height;

    const tl = gsap.timeline();
    tl.to(targetEl, {
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: 0.1,
      ease: 'power1.out'
    }).to(targetEl, {
      scaleX: 1,
      scaleY: 1,
      duration: 1,
      ease: 'elastic.out(1, 0.3)'
    });
  }
}
