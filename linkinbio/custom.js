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
      setTimeout(refreshMasonry, delay);
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
      debounceTimer = setTimeout(refreshMasonry, 350);
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
