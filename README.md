# Webflow Website Base

Barba.js page-transition boilerplate for Webflow, served as a single external
file from Vercel and linked in the project's footer code slot.

## Files

| Path | Purpose |
| --- | --- |
| `page-transitions.js` | The deployable file. No build step — link it directly. |
| `webflow/head.html` | Head code: Lenis stylesheet + transition overlay CSS. |
| `webflow/footer.html` | Footer code: CDN libraries, this file, your modules. |
| `webflow/structure.html` | Required DOM structure and data attributes. |

## Dependencies

Loaded from CDN in the Webflow footer — **not** bundled here.

| Library | Version | Required |
| --- | --- | --- |
| `@barba/core` | 2.10.3 | yes |
| `gsap` | 3.15 | yes |
| `gsap/CustomEase` | 3.15 | yes |
| `lenis` | 1.3.17 | optional (feature-detected) |
| `gsap/ScrollTrigger` | 3.15 | optional (feature-detected) |

Lenis is initialised by this file on first load — do **not** initialise it
separately in the Webflow footer, or you will get two smooth-scroll loops.

## Deploy

1. Push to GitHub.
2. Import the repo in Vercel. No framework, no build command, output directory `.`.
3. Link the deployed file in the Webflow footer:

```html
<script src="https://YOUR-PROJECT.vercel.app/page-transitions.js"></script>
```

Vercel serves the file with long-lived caching headers (`vercel.json`), so bump
a query string when you ship a change: `page-transitions.js?v=2`.

## Adding a module

A *module* is any page behaviour — a slider, a marquee, a reveal. Register it
after `page-transitions.js` loads; the registry handles gating, re-running on
each page enter, and teardown.

```js
PT.module({
  name: "reveal",
  selector: "[data-reveal]",   // skipped entirely when nothing matches
  init: function (ctx) {
    var tl = gsap.timeline();
    tl.from(ctx.elements, { y: 40, autoAlpha: 0, stagger: PT.config.stagger });
    return function () { tl.kill(); };   // optional cleanup, runs on beforeLeave
  }
});
```

`ctx` is `{ container, elements, reducedMotion, lenis }`.

Options:

| Option | Default | Meaning |
| --- | --- | --- |
| `name` | `"anonymous"` | Label used in debug logs and errors. |
| `selector` | `null` | Module is skipped when the container has no match. |
| `once` | `false` | Run on first load only; never re-run, never torn down. |
| `after` | `false` | Run *after* the enter animation instead of before it. |
| — | — | Cleanups run on `beforeLeave`, before the next page's modules init. |
| `namespace` | `null` | String or array — limit to `data-barba-namespace` values. |

## Adding a transition

```js
PT.transition({
  name: "slide",
  once:  function (ctx) { return gsap.timeline().call(function () { PT.helpers.resetPage(ctx.next); }); },
  leave: function (ctx) { return gsap.timeline().to(ctx.current, { xPercent: -20, autoAlpha: 0 }); },
  enter: function (ctx) {
    var tl = gsap.timeline();
    tl.fromTo(ctx.next, { xPercent: 20, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1 });
    return PT.helpers.readyAt(tl, ctx.next);   // resolves + hands scroll back
  }
});
```

`enter` must return a promise that resolves when the page is ready —
`PT.helpers.readyAt(tl, container)` does that and calls `resetPage` for you.

Selection order, first match wins:

1. `data-transition="name"` on the clicked link
2. `data-transition="name"` on the incoming barba container
3. `PT.config.defaultTransition`

Built in: `fade` (default), `column-wipe`.

## Config

```js
PT.config.debug = true;                     // barba debug + module logs
PT.config.defaultTransition = "column-wipe";
PT.config.duration = 0.6;
PT.config.stagger = 0.05;
PT.config.lenis = { lerp: 0.165, wheelMultiplier: 1.25 };
PT.config.themes.dark = { nav: "light", transition: "dark" };
```

Set these *before* `DOMContentLoaded` — i.e. in the inline footer script right
after the external file — since `barba.init()` reads `debug` and `timeout` at boot.

## Helpers

`PT.helpers` exposes `initLenis`, `stopScroll`, `startScroll`, `refreshScroll`,
`resetPage`, `applyThemeFrom`, `syncNav`, `readyAt`, `debounceOnWidthChange`,
`isReducedMotion`. `PT.lenis` is the live instance (or `null`).

## Notes

- `prefers-reduced-motion` is respected: both built-in transitions fall back to
  an instant swap.
- `history.scrollRestoration` is set to `"manual"`; every transition resets
  scroll to top.
- Nav markup marked `[data-barba-update]` inside a `<nav>` gets its
  `aria-current` and classes synced from the incoming page — useful when the nav
  sits outside the barba container.
- ScrollTriggers are killed on `beforeLeave` and refreshed on `afterEnter`.
