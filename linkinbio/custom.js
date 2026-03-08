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

  // --- Init ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      waitForTilesAndInit();
      setTimeout(observeImageLoads, 500);
      setTimeout(observeFilterChanges, 500);
      observeResize();
    });
  } else {
    waitForTilesAndInit();
    setTimeout(observeImageLoads, 500);
    setTimeout(observeFilterChanges, 500);
    observeResize();
  }
})();
