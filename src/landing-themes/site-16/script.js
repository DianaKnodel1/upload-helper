// Website-Theme 16: nur mobiles Menü. Bewerbungs-Modal und Formular kommen
// automatisch aus der Theme-Registry (kein eigener Formular-Code im Theme).
(function () {
  var burger = document.getElementById("t16-burger");
  var nav = document.getElementById("t16-nav");
  if (!burger || !nav) return;
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  nav.addEventListener("click", function (e) {
    if (e.target && e.target.tagName === "A") {
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }
  });
})();
