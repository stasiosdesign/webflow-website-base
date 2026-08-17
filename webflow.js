// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let nextPage = document;
let onceFunctionsInitialized = false;

const hasLenis = typeof window.Lenis !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";
const hasDraggable = typeof window.Draggable !== "undefined";
const hasInertia = typeof window.InertiaPlugin !== "undefined";

if (hasDraggable) gsap.registerPlugin(Draggable);
if (hasInertia) gsap.registerPlugin(InertiaPlugin);

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
  if (has('[data-overlap-slider-init]')) initOverlappingSlider();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Runs before the enter animation
  // if (has('[data-something]')) initSomething();
  if (has('[data-overlap-slider-init]')) initOverlappingSlider();
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
  const transitionWrap = document.querySelector("[data-transition-wrap]");
  const transitionDark = transitionWrap.querySelector("[data-transition-dark]");

  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    }
  })

  CustomEase.create("parallax", "0.7, 0.05, 0.13, 1");

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.set(transitionWrap, {
    zIndex: 2
  });

  tl.fromTo(transitionDark, {
    autoAlpha: 0
  },{
    autoAlpha: 0.8,
    duration: 1.2,
    ease: "parallax"
  }, 0);

  tl.fromTo(current,{
    y: "0vh"
  },{
    y: "-25vh",
    duration: 1.2,
    ease: "parallax",
  }, 0);

  tl.set(transitionDark, {
    autoAlpha: 0,
  });

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

  tl.set(next, {
    zIndex: 3
  });

  tl.fromTo(next, {
    y: "100vh"
  }, {
    y: "0vh",
    duration: 1.2,
    clearProps: "all",
    ease: "parallax"
  }, "startEnter");

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

barba.hooks.beforeLeave(() => {
  // Tear down page functions here, not in afterLeave: with sync transitions
  // beforeEnter fires before afterLeave, so cleaning up later would destroy
  // the incoming page's instances instead of the outgoing ones.
  destroyOverlappingSliders();
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

let overlappingSliderCleanups = [];

function initOverlappingSlider() {
  if (!hasDraggable) {
    console.warn("OverlappingSlider: Draggable is not loaded.");
    return;
  }

  const inits = nextPage.querySelectorAll('[data-overlap-slider-init]');
  if (!inits.length) return;

  inits.forEach(setupOverlappingSlider);

  function setupOverlappingSlider(init) {
    // Guard against double-init if the registry runs twice for one container
    if (init.dataset.overlapSliderReady === "true") return;
    init.dataset.overlapSliderReady = "true";

    // --- attributes with defaults
    const minScale = +(init.getAttribute('data-scale')  ?? 0.45);
    const maxRotation = +(init.getAttribute('data-rotate') ?? -8);
    const inertia = hasInertia;

    const wrap = init.querySelector('[data-overlap-slider-collection]');
    const slider = init.querySelector('[data-overlap-slider-list]');
    const slides = Array.from(init.querySelectorAll('[data-overlap-slider-item]'));

    if (!wrap || !slider || !slides.length) {
      console.warn("OverlappingSlider: missing required structure. Check Osmo Vault documentation please.");
      return;
    }

    wrap.style.touchAction = 'none';
    wrap.style.userSelect = 'none';

    let spacing = 0;
    let slideW = 0;
    let maxDrag = 0;
    let dragX = 0;
    let draggable;

    // simple clamp that always uses latest maxDrag
    function clamp(value) {
      if (maxDrag <= 0) return 0;
      return Math.min(Math.max(value, 0), maxDrag);
    }

    function update() {
      // move the whole list
      gsap.set(slider, { x: -dragX });

      // update each slide's overlap transform
      slides.forEach((slide, i) => {
        const threshold = i * spacing;
        const local = Math.max(0, dragX - threshold);
        const t = spacing > 0 ? Math.min(local / spacing, 1) : 0;

        gsap.set(slide, {
          x: local,
          scale: 1 - (1 - minScale) * t,
          rotation: maxRotation * t,
          transformOrigin: '75% center'
        });
      });
    }

    function recalc() {
      if (!slides.length) return;

      // measure one slide to get width + margin-right as "gap"
      const style = getComputedStyle(slides[0]);
      const gapRight = parseFloat(style.marginRight) || 0;

      slideW = slides[0].offsetWidth;
      spacing = slideW + gapRight;
      maxDrag = spacing * (slides.length - 1);

      // keep dragX within new bounds
      dragX = clamp(dragX);
      update();

      if (draggable) {
        draggable.applyBounds({ minX: -maxDrag, maxX: 0 });
      }
    }

    // create draggable
    draggable = Draggable.create(slider, {
      type: 'x',
      bounds: { minX: -maxDrag, maxX: 0 }, // will be updated after recalc
      inertia,
      maxDuration: 1,
      snap: true
        ? (raw) => {
            // raw is the x value
            const d = clamp(-raw);
            const idx = spacing > 0 ? Math.round(d / spacing) : 0;
            return -idx * spacing;
          }
        : false,
      onDrag() {
        dragX = clamp(-this.x);
        update();
      },
      onThrowUpdate() {
        dragX = clamp(-this.x);
        update();
      }
    })[0];

    // recalc on resize
    const ro = new ResizeObserver(() => {
      recalc();
    });
    ro.observe(init);

    // keyboard navigation (arrow left/right)
    let active = false;
    let currentIndex = 0;

    // helper function to switch slides
    function goToSlide(idx) {
      idx = Math.max(0, Math.min(idx, slides.length - 1));
      currentIndex = idx;

      const targetX = idx * spacing;

      gsap.to({ value: dragX }, {
        value: targetX,
        duration: 0.35,
        ease: "power4.out",
        onUpdate: function () {
          dragX = this.targets()[0].value;
          gsap.set(slider, { x: -dragX });
          update(); // animate overlap transforms properly
        }
      });

      wrap.setAttribute("aria-label", `Slide ${idx + 1} of ${slides.length}`);
    }

    // Observe visibility
    const io = new IntersectionObserver(entries => {
      active = entries[0].isIntersecting;
    }, {
      threshold: 0.25 // slider must be at least 25% visible
    });

    io.observe(init);

    // Aria labels for accessibility
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-roledescription", "carousel");
    wrap.setAttribute("aria-label", "Testimonial slider");

    // key listener
    function onKey(e) {
      if (!active) return; // only respond when slider in view

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToSlide(currentIndex - 1);
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToSlide(currentIndex + 1);
      }
    }
    window.addEventListener("keydown", onKey);

    // initial layout
    recalc();

    // Teardown, run from beforeLeave so nothing leaks across page transitions
    overlappingSliderCleanups.push(function () {
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      io.disconnect();
      if (draggable) draggable.kill();
      gsap.killTweensOf(slider);
      gsap.killTweensOf(slides);
      delete init.dataset.overlapSliderReady;
    });
  }
}

function destroyOverlappingSliders() {
  overlappingSliderCleanups.splice(0).forEach(function (cleanup) {
    cleanup();
  });
}
