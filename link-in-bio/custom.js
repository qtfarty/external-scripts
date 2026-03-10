/* ============================================================
   SpreadSimple "Link in Bio" — Masonry Layout Helper
   CSS column-count handles the masonry natively, but this JS
   ensures proper re-flow after dynamic content loads and
   handles edge cases with SpreadSimple's SPA rendering.
   ============================================================ */

(function () {
  'use strict';

  /**
   * Force masonry re-flow by toggling display on the tiles container.
   * This fixes a browser bug where CSS column-count doesn't re-calculate
   * after dynamically injected content.
   */
  function refreshMasonry() {
    const tilesList = document.querySelector('.sv-tiles-list');
    if (!tilesList) return;

    // Force browser to recalculate columns
    tilesList.style.display = 'none';
    // eslint-disable-next-line no-unused-expressions
    tilesList.offsetHeight; // trigger reflow
    tilesList.style.display = '';
  }

  /**
   * Wait for SpreadSimple's SPA to finish rendering tiles,
   * then trigger masonry refresh.
   */
  function waitForTilesAndInit() {
    const observer = new MutationObserver(function (mutations, obs) {
      const tiles = document.querySelectorAll('.sv-tile');
      if (tiles.length > 0) {
        obs.disconnect();
        // Small delay to let images start loading
        setTimeout(refreshMasonry, 300);
        // Refresh again after images likely loaded
        setTimeout(refreshMasonry, 1500);
        // Duotone gradient map for card images
        setTimeout(initDuotone, 400);
        setTimeout(applyDuotoneOverlays, 1600);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Fallback: if tiles already exist
    const existing = document.querySelectorAll('.sv-tile');
    if (existing.length > 0) {
      setTimeout(refreshMasonry, 300);
      setTimeout(refreshMasonry, 1500);
      setTimeout(initDuotone, 400);
      setTimeout(applyDuotoneOverlays, 1600);
    }
  }

  /**
   * Refresh masonry when images finish loading inside tiles.
   * This prevents layout jumps when background images have varying heights.
   */
  function observeImageLoads() {
    const tileImages = document.querySelectorAll('.sv-tile__image');
    if (!tileImages.length) return;

    // For background images, we can't easily detect load,
    // so we use a series of timed refreshes
    const delays = [500, 1000, 2000, 4000];
    delays.forEach(function (delay) {
      setTimeout(function () {
        refreshMasonry();
        applyDuotoneOverlays();
      }, delay);
    });
  }

  /**
   * Re-flow on search/filter changes (SpreadSimple re-renders tiles)
   */
  function observeFilterChanges() {
    const searchInput = document.querySelector('.sv-viewer-form__input');
    if (!searchInput) return;

    let debounceTimer;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        refreshMasonry();
        applyDuotoneOverlays();
      }, 350);
    });
  }

  /**
   * Re-flow on window resize
   */
  function observeResize() {
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refreshMasonry, 200);
    });
  }

  /**
   * Inline social icon SVGs with selective fill tagging.
   * Replaces <img src="*.svg"> with inline <svg> elements and
   * tags child elements with data-icon-role="bg" or "logo"
   * so CSS can independently control background vs logo colours.
   *
   * Detection logic (all SpreadSimple social SVGs follow
   * the same pattern: brand-coloured bg + white logo):
   *   white-ish fill → logo
   *   everything else (solid brand colour, gradient url) → bg
   *   fill="none" / mask internals → untouched
   */
  function inlineSocialSVGs() {
    var WHITE_RE = /^(white|#fff(fff)?|#fbfbfd)$/i;

    document.querySelectorAll('.sv-social-share-btns__badge img[src$=".svg"]').forEach(function (img) {
      fetch(img.src)
        .then(function (r) { return r.text(); })
        .then(function (svgText) {
          var wrapper = document.createElement('div');
          wrapper.innerHTML = svgText.trim();
          var svg = wrapper.querySelector('svg');
          if (!svg) return;

          svg.classList.add('sv-social-inline-svg');
          svg.setAttribute('width', '22');
          svg.setAttribute('height', '22');
          svg.removeAttribute('fill');

          // Tag every filled attribute element as bg or logo
          svg.querySelectorAll('[fill]').forEach(function (el) {
            var fill = (el.getAttribute('fill') || '').trim();
            if (!fill || fill.toLowerCase() === 'none') return;
            if (el.closest('mask')) return; // Skip elements inside <mask> — their fills define clip shape, not colour
            if (WHITE_RE.test(fill)) {
              el.setAttribute('data-icon-role', 'logo');
            } else {
              el.setAttribute('data-icon-role', 'bg');
            }
          });

          // Also check inline style fills
          svg.querySelectorAll('*').forEach(function (el) {
            if (el.style && el.style.fill) {
              var fill = el.style.fill.trim();
              if (!fill || fill.toLowerCase() === 'none') return;
              if (el.closest('mask')) return; // Skip elements inside <mask>
              if (WHITE_RE.test(fill)) {
                el.setAttribute('data-icon-role', 'logo');
              } else {
                el.setAttribute('data-icon-role', 'bg');
              }
              el.style.fill = '';
            }
          });

          img.replaceWith(svg);
        })
        .catch(function () {}); // fallback: img stays as-is
    });
  }

  /**
   * Wait for social icons in footer to render, then inline them.
   */
  function waitForSocialIconsAndInline() {
    var observer = new MutationObserver(function (mutations, obs) {
      var icons = document.querySelectorAll('.sv-social-share-btns__badge img[src$=".svg"]');
      if (icons.length > 0) {
        obs.disconnect();
        setTimeout(inlineSocialSVGs, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Fallback: if icons already exist
    var existing = document.querySelectorAll('.sv-social-share-btns__badge img[src$=".svg"]');
    if (existing.length > 0) {
      setTimeout(inlineSocialSVGs, 200);
    }
  }

  /* ============================================================
     Duotone Gradient-Map for Card Images
     Default : dark tones → shadow colour, light tones → accent
     Hover   : cross-fades to original colours
     Shadow colour
       light mode → border-color #2d2d30
       dark  mode → background   #1e1e1e
     Highlight colour → accent #ccff00  (both modes)
     ============================================================ */
  var duotoneReady = false;

  function buildDuotoneFilter() {
    var svgNS = 'http://www.w3.org/2000/svg';
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Shadow channel values
    var sR = dark ? 30 / 255 : 45 / 255;
    var sG = dark ? 30 / 255 : 45 / 255;
    var sB = dark ? 30 / 255 : 48 / 255;
    // Highlight channel values (#ccff00)
    var hR = 204 / 255, hG = 1, hB = 0;

    var svg = document.getElementById('duotone-svg');
    if (!svg) {
      svg = document.createElementNS(svgNS, 'svg');
      svg.id = 'duotone-svg';
      svg.style.cssText =
        'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      document.body.appendChild(svg);
    }
    svg.innerHTML =
      '<defs><filter id="duotone-filter" color-interpolation-filters="sRGB">' +
      '<feColorMatrix type="saturate" values="0"/>' +
      '<feComponentTransfer>' +
      '<feFuncR type="table" tableValues="' + sR.toFixed(4) + ' ' + hR.toFixed(4) + '"/>' +
      '<feFuncG type="table" tableValues="' + sG.toFixed(4) + ' ' + hG.toFixed(4) + '"/>' +
      '<feFuncB type="table" tableValues="' + sB.toFixed(4) + ' ' + hB.toFixed(4) + '"/>' +
      '</feComponentTransfer></filter></defs>';
  }

  function applyDuotoneOverlays() {
    document.querySelectorAll('.sv-tile__image').forEach(function (el) {
      if (el.querySelector('.duotone-overlay')) return;
      var bg = el.style.backgroundImage;
      if (!bg || bg === 'none') return;
      // Layer 1 (bottom): grayscale — fades out with delay
      var gray = document.createElement('div');
      gray.className = 'duotone-overlay-gray';
      gray.style.backgroundImage = bg;
      el.appendChild(gray);
      // Layer 2 (top): duotone colour map — fades out first
      var duo = document.createElement('div');
      duo.className = 'duotone-overlay';
      duo.style.backgroundImage = bg;
      el.appendChild(duo);
    });
  }

  function initDuotone() {
    if (!duotoneReady) {
      buildDuotoneFilter();
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', buildDuotoneFilter);

      // Persistent observer: catches tiles added later by SPA routing,
      // lazy-load, or filter/search re-renders, AND background-image
      // being set after the element already exists in the DOM.
      var duotoneDebounce;
      new MutationObserver(function () {
        clearTimeout(duotoneDebounce);
        duotoneDebounce = setTimeout(applyDuotoneOverlays, 150);
      }).observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });

      duotoneReady = true;
    }
    applyDuotoneOverlays();
  }

  // --- Init ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      waitForTilesAndInit();
      waitForSocialIconsAndInline();
      setTimeout(observeImageLoads, 500);
      setTimeout(observeFilterChanges, 500);
      observeResize();
    });
  } else {
    waitForTilesAndInit();
    waitForSocialIconsAndInline();
    setTimeout(observeImageLoads, 500);
    setTimeout(observeFilterChanges, 500);
    observeResize();
  }
})();
