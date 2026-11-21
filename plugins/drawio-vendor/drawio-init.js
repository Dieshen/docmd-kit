// Draws every diagram the drawio plugin put on the page, once each.
// The docs site is a single-page app, so this runs again after every page change.
(function () {
  function draw() {
    if (!window.GraphViewer) return false;
    var pending = document.querySelectorAll(
      ".drawio-diagram:not([data-drawio-drawn])",
    );
    for (var i = 0; i < pending.length; i++) {
      pending[i].setAttribute("data-drawio-drawn", "true");
      try {
        window.GraphViewer.createViewerForElement(pending[i]);
      } catch (error) {
        pending[i].removeAttribute("data-drawio-drawn");
        pending[i].textContent =
          "This diagram could not be drawn: " + error.message;
      }
    }
    return true;
  }

  // The viewer script is large and may still be loading when this runs.
  function drawWhenReady(attempt) {
    if (draw() || attempt > 100) return;
    setTimeout(function () {
      drawWhenReady(attempt + 1);
    }, 100);
  }

  document.addEventListener("docmd:page-mounted", function () {
    drawWhenReady(0);
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      drawWhenReady(0);
    });
  } else {
    drawWhenReady(0);
  }
})();
