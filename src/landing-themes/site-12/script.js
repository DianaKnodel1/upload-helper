// Website-Theme 2 (Luftig): Mobiles Menü, Jahreszahl, sanfte Scroll-Animationen.
(function () {
  var burger = document.getElementById("s12-burger");
  var nav = document.getElementById("s12-nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") nav.classList.remove("open");
    });
  }
  var year = document.getElementById("s12-year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Sanfte Einblend-Animationen
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("s12-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll("[data-animate]").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll("[data-animate]").forEach(function (el) { el.classList.add("s12-in"); });
  }
})();
