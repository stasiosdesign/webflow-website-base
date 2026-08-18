// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let lenis = null;
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

  // First load only. Barba reaches this through its once flow, so an in-site
  // navigation never replays it — only a real page load or a refresh does.
  //
  // Queried against document rather than has(): beforeEnter fires before once,
  // so nextPage is already the incoming container, and the loading overlay
  // lives outside it.
  if (document.querySelector("[data-loading-container]")) {
    tl.add(initDroppingCardsLoadingAnimation(), 0);
  }

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
// YOUR FUNCTIONS GO BELOW HERE
// -----------------------------------------

function initDroppingCardsLoadingAnimation() {
  const container = document.querySelector("[data-loading-container]");
  const cardsList = gsap.utils.toArray(container.querySelectorAll("[data-loading-cards-list]"));
  const cards = gsap.utils.toArray(container.querySelectorAll("[data-loading-card]"));
  const background = container.querySelectorAll("[data-loading-background]");
  const logo = container.querySelectorAll("[data-loading-logo]");
  const header = document.querySelectorAll("[data-loading-header]");

  const scaleDecrease = 0.1;
  const yOffset = -7.5;
  const totalFallStagger = 0.75;
  const deckMoveDuration = 1;
  const rotationPattern = [-10, 10, -15, 10, 20];
  const xPattern = [-5, 7.5, 10, 5, -10];

  const has = (items) => items.length;
  const patternValue = (pattern, index) => pattern[index % pattern.length];

  function getStack(index, total) {
    const reverseIndex = total - 1 - index;
    return {
      scale: 1 - (reverseIndex * scaleDecrease),
      yPercent: reverseIndex * yOffset
    };
  }

  function stackProp(prop, total) {
    return (index) => getStack(index, total)[prop];
  }

  function getFallY(card) {
    const containerRect = container.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return (containerRect.bottom - cardRect.top) + cardRect.height;
  }

  const tl = gsap.timeline();

  if (has(cardsList)) {
    tl.fromTo(cardsList, {
      opacity: 0
    }, {
      opacity: 1,
      duration: 0.3,
    }, 0.5);
  }

  if (has(cards)) {
    tl.fromTo(cards, {
      rotate: 0.001,
      scale: 0.5,
      yPercent: 0,
    }, {
      rotate: 0.001,
      scale: stackProp("scale", cards.length),
      yPercent: stackProp("yPercent", cards.length),
      stagger: -0.05,
      duration: 1.5,
      ease: "elastic.out(1,0.7)",
    }, "<");

    const fallCards = cards.slice().reverse();
    const fallStagger = totalFallStagger / Math.max(cards.length - 1, 1);
    const fallStart = tl.duration();

    fallCards.forEach((card, fallIndex) => {
      const remainingCards = cards.slice(0, cards.indexOf(card));
      const fallTime = fallStart + (fallIndex * fallStagger);

      if (has(remainingCards)) {
        tl.to(remainingCards, {
          scale: stackProp("scale", remainingCards.length),
          yPercent: stackProp("yPercent", remainingCards.length),
          duration: deckMoveDuration,
          ease: "sine.inOut",
        }, fallTime);
      }

      tl.to(card, {
        y: () => getFallY(card),
        xPercent: patternValue(xPattern, fallIndex),
        rotate: patternValue(rotationPattern, fallIndex),
        duration: 0.8,
        ease: "power4.in"
      }, fallTime);
    });
  }

  if (has(background)) {
    tl.to(background, {
      rotate: 0.001,
      yPercent: 100,
      duration: 1.5,
      ease: "osmo",
    }, "-=0.6");
  }

  if (has(header)) {
    tl.from(header, {
      rotate: 0.001,
      yPercent: -25,
      scale: 1.1,
      duration: 1.5,
      ease: "osmo",
    }, "<");
  }

  if (has(logo)) {
    tl.to(logo, {
      rotate: 0.001,
      yPercent: 100,
      opacity: 0,
      duration: 0.8,
      ease: "power4.in"
    }, "<-=1.5");
  }

  return tl;
}

