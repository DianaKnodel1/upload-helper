(function(){
  // Sanftes Scrollen fuer Anker-Links (ausser Bewerbungs-Modal).
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a) return;
    var id = a.getAttribute('href');
    if(!id || id === '#' || id.indexOf('bewerbung-form') > -1) return;
    var el = document.querySelector(id);
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
  });
  // Mobile-Menue
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav-links');
  if(burger && nav){
    burger.addEventListener('click', function(){ nav.classList.toggle('open'); });
    nav.addEventListener('click', function(e){
      if(e.target.closest('a')) nav.classList.remove('open');
    });
  }
  // Dezente Reveal-Animationen
  if('IntersectionObserver' in window){
    var obs = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('in'); obs.unobserve(en.target); }
      });
    }, {threshold:.12});
    document.querySelectorAll('[data-animate]').forEach(function(el){ obs.observe(el); });
  } else {
    document.querySelectorAll('[data-animate]').forEach(function(el){ el.classList.add('in'); });
  }
})();
