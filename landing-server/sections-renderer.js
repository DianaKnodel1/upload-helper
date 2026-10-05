/* AUTOGENERIERT aus src/lib/landing-sections.ts — nicht direkt bearbeiten!
   Neu erzeugen mit: bun scripts/build-sections-renderer-js.mjs */

// raw:/dev-server/src/landing-themes/_shared/form-section.html
var form_section_default = '<section id="bewerbung-form" class="lv-form-section">\n  <div class="lv-form-wrap">\n    <div class="lv-form-intro">\n      <span class="lv-form-eyebrow">Jetzt bewerben</span>\n      <h2 class="lv-form-title">Bereit f\xFCr den n\xE4chsten Schritt?</h2>\n      <p class="lv-form-sub">In 2 Minuten ausf\xFCllen \u2014 danach w\xE4hlen Sie direkt hier Ihren Wunschtermin f\xFCr Ihr Online-Interview.</p>\n      <p class="lv-form-meta">\u{1F4DE} {{telefon}} &nbsp;\xB7&nbsp; \u2709 {{email}}</p>\n    </div>\n    <form id="application-form" class="lv-form">\n      <h3 class="lv-form-h3">Bewerbungsformular</h3>\n      <div class="lv-form-row">\n        <label>Vorname<input name="first_name" required placeholder="Max" /></label>\n        <label>Nachname<input name="last_name" required placeholder="Mustermann" /></label>\n      </div>\n      <label>Stra\xDFe &amp; Hausnummer<input name="street" placeholder="Musterstra\xDFe 12" /></label>\n      <div class="lv-form-row">\n        <label>PLZ<input name="postal_code" placeholder="10115" /></label>\n        <label>Stadt<input name="city" placeholder="Berlin" /></label>\n      </div>\n      <label>Telefonnummer<input name="phone" required placeholder="+49 \u2026" /></label>\n      <label>E-Mail-Adresse<input type="email" name="email" required placeholder="name@beispiel.de" /></label>\n      <button type="submit" class="lv-form-submit">Bewerbung absenden \u2192</button>\n      <p id="form-status" class="lv-form-status"></p>\n    </form>\n  </div>\n</section>\n';

// raw:/dev-server/src/landing-themes/_shared/form-section.css
var form_section_default2 = '/* Shared inline application form \u2014 light, tinted per theme via {{primary_color}}. */\n.lv-form-section{\n  position:relative;\n  padding:88px 20px;\n  background:\n    radial-gradient(1200px 500px at 10% -10%, color-mix(in oklab, {{primary_color}} 14%, transparent) 0%, transparent 60%),\n    radial-gradient(900px 420px at 100% 110%, color-mix(in oklab, {{primary_color}} 10%, transparent) 0%, transparent 60%),\n    linear-gradient(180deg, color-mix(in oklab, {{primary_color}} 6%, #ffffff) 0%, color-mix(in oklab, {{primary_color}} 3%, #f8fafc) 100%);\n  color:#0f172a;\n}\n.lv-form-wrap{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;}\n@media (max-width:860px){.lv-form-wrap{grid-template-columns:1fr;gap:32px;}}\n.lv-form-eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:{{primary_color}};margin-bottom:14px;padding:6px 12px;border-radius:999px;background:color-mix(in oklab, {{primary_color}} 12%, transparent);}\n.lv-form-title{font-size:clamp(28px,4vw,42px);font-weight:800;line-height:1.15;margin:0 0 16px;color:#0f172a;letter-spacing:-.01em;}\n.lv-form-sub{font-size:16px;line-height:1.65;color:#475569;margin:0 0 18px;}\n.lv-form-meta{font-size:14px;color:#64748b;margin:0;}\n.lv-form{\n  position:relative;\n  background:#ffffff;\n  color:#0f172a;\n  border:1px solid color-mix(in oklab, {{primary_color}} 18%, #e2e8f0);\n  border-radius:18px;\n  padding:30px;\n  box-shadow:0 24px 60px -18px color-mix(in oklab, {{primary_color}} 40%, rgba(15,23,42,.28));\n}\n.lv-form::before{\n  content:"";position:absolute;left:0;right:0;top:0;height:4px;border-radius:18px 18px 0 0;\n  background:linear-gradient(90deg, {{primary_color}}, color-mix(in oklab, {{primary_color}} 55%, #ffffff));\n}\n.lv-form-h3{margin:0 0 18px;font-size:20px;font-weight:700;}\n.lv-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}\n.lv-form label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:12px;}\n.lv-form input{display:block;width:100%;margin-top:6px;padding:11px 13px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;color:#0f172a;background:#fff;box-sizing:border-box;transition:border-color .15s, box-shadow .15s;}\n.lv-form input:focus{outline:none;border-color:{{primary_color}};box-shadow:0 0 0 3px color-mix(in oklab, {{primary_color}} 25%, transparent);}\n.lv-form-submit{display:block;width:100%;margin-top:8px;padding:14px 18px;border:0;border-radius:999px;background:{{primary_color}};color:#fff;font-size:16px;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s;}\n.lv-form-submit:hover{transform:translateY(-1px);background:color-mix(in oklab, {{primary_color}} 88%, #000);box-shadow:0 10px 28px -8px color-mix(in oklab, {{primary_color}} 60%, transparent);}\n.lv-form-status{margin:12px 0 0;font-size:14px;min-height:1em;}\n.lv-form-status.success{color:#16a34a;}\n.lv-form-status.error{color:#dc2626;}\n\n/* Per-theme dark overrides are injected by landing-themes.ts. */\n\n';

// raw:/dev-server/src/landing-themes/_shared/form-section.js
var form_section_default3 = `/* Shared inline application form handler + success modal + Inline-Terminwahl. */
(function(){
  function fmtWa(num){var d=String(num||'').replace(/[^0-9]/g,'');if(!d)return '';return d.length>4?'+'+d.slice(0,2)+' '+d.slice(2,5)+' '+d.slice(5):'+'+d;}
  function spamHintBox(emailStatus){
    var s=document.createElement('div');
    var failed=emailStatus&&emailStatus.status==='failed';
    var skipped=emailStatus&&emailStatus.status==='skipped';
    var calendly=emailStatus&&emailStatus.reason==='calendly_handles_mail';
    var mailless=emailStatus&&emailStatus.reason==='mailless_mode';
    if(calendly){
      s.style.cssText='margin:14px 0 4px;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;color:#065f46;font-size:13.5px;line-height:1.55;text-align:left;';
      s.innerHTML='Nach der Terminwahl erhalten Sie Ihre Best\xE4tigung, den Kalendereintrag und Erinnerungen automatisch per E-Mail und SMS.';
      return s;
    }
    if(mailless){
      s.style.cssText='margin:14px 0 4px;padding:14px 16px;background:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;color:#065f46;font-size:13.5px;line-height:1.55;text-align:left;';
      s.innerHTML='Ihre Bewerbung ist eingegangen. Sie k\xF6nnen direkt hier weitermachen \u2013 alle weiteren Schritte finden Sie jederzeit \xFCber diese Seite.';
      return s;
    }
    s.style.cssText='margin:14px 0 4px;padding:14px 16px;background:'+(failed?'#fee2e2':skipped?'#f1f5f9':'#fef3c7')+';border-left:4px solid '+(failed?'#ef4444':skipped?'#94a3b8':'#f59e0b')+';border-radius:8px;color:'+(failed?'#7f1d1d':skipped?'#334155':'#78350f')+';font-size:13.5px;line-height:1.55;text-align:left;';
    s.innerHTML=failed
      ? 'Ihre Bewerbung ist eingegangen. Die Best\xE4tigungs-E-Mail konnte gerade nicht automatisch versendet werden \u2013 wir melden uns direkt bei Ihnen.'
      : skipped
        ? 'Ihre Bewerbung ist eingegangen. Falls Sie sich bereits beworben haben, verwenden wir Ihre bestehende Anfrage weiter.'
        : '\u{1F4A1} <strong>Wichtig:</strong> Falls Sie eine E-Mail erwarten, pr\xFCfen Sie bitte auch Ihren <strong>Spam-Ordner</strong> und markieren Sie uns als \u201EKein Spam".';
    return s;
  }

  // \u2500\u2500 API-Base aus PORTAL_API ableiten \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function apiBase(){
    var p=String(window.PORTAL_API||'');
    // PORTAL_API zeigt auf .../api/public/applications \u2192 wir wollen die Origin.
    var m=p.match(/^(https?:\\/\\/[^/]+)/);
    return m ? m[1] : '';
  }
  function bookingUrl(action, params){
    var qs='action='+encodeURIComponent(action);
    if(params){for(var k in params){if(params[k]!=null)qs+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}}
    return apiBase()+'/api/public/booking?'+qs;
  }

  // \u2500\u2500 Datum-/Zeit-Formatter (IMMER deutsche Zeit) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Feste Zeitzone: Bewerber im Ausland sehen sonst andere Uhrzeiten als in
  // der Best\xE4tigungsmail steht.
  var TZ = 'Europe/Berlin';
  function dtf(opts){
    try { return new Intl.DateTimeFormat('de-DE', Object.assign({timeZone:TZ}, opts)); }
    catch(_){ return new Intl.DateTimeFormat('de-DE', opts); }
  }
  var fmtDay = dtf({weekday:'short',day:'2-digit',month:'2-digit'});
  var fmtDayLong = dtf({weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  var fmtTime = dtf({hour:'2-digit',minute:'2-digit',hour12:false});
  var fmtYMD = (function(){
    try { return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}); }
    catch(_){ return null; }
  })();
  function toYMD(d){
    if(fmtYMD){ try { return fmtYMD.format(d); } catch(_){} }
    var y=d.getFullYear();var m=String(d.getMonth()+1).padStart(2,'0');var dd=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+dd;
  }
  function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function startOfDay(d){var x=new Date(d);x.setHours(0,0,0,0);return x;}

  // \u2500\u2500 Inline-Booking-Renderer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderBookingInline(container, token, opts){
    opts=opts||{};
    container.innerHTML='';
    container.style.cssText='margin-top:18px;padding:22px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 8px 30px -12px rgba(15,23,42,.15);color:#0f172a;font-family:inherit;';

    var RANGE_DAYS = 28;
    var state={schedule:null, rangeStart:startOfDay(new Date()), selectedDay:null, slotsByDay:{}, loadingSlots:false};

    var header=document.createElement('div');
    var h=document.createElement('h3');h.style.cssText='margin:0 0 6px;font-size:20px;font-weight:700;';h.textContent='Schritt 2 von 4: Wunschtermin w\xE4hlen';
    var sub=document.createElement('p');sub.style.cssText='margin:0 0 4px;color:#475569;font-size:14px;line-height:1.5;';
    sub.textContent='Wir laden Ihren Kalender \u2026';
    var hint=document.createElement('p');hint.style.cssText='margin:0 0 6px;color:#64748b;font-size:12.5px;';
    hint.textContent='Das Interview findet online statt \u2013 Best\xE4tigung, Kalendereintrag und Erinnerungen kommen automatisch von Calendly. Alle Zeiten in deutscher Zeit (Europe/Berlin).';
    var priv=document.createElement('p');priv.style.cssText='margin:0 0 14px;color:#94a3b8;font-size:11.5px;line-height:1.5;';
    var dsUrl=window.LANDING_DATENSCHUTZ_URL||'datenschutz.html';
    priv.innerHTML='Ihre Daten werden ausschlie\xDFlich zur Terminvereinbarung verwendet. Details in unserer <a href="'+dsUrl+'" target="_blank" rel="noopener" style="color:#64748b;text-decoration:underline;">Datenschutzerkl\xE4rung</a>.';
    header.appendChild(h);header.appendChild(sub);header.appendChild(hint);header.appendChild(priv);
    container.appendChild(header);

    var body=document.createElement('div');container.appendChild(body);
    var errBox=document.createElement('div');errBox.style.cssText='display:none;margin-top:10px;padding:10px 12px;background:#fee2e2;border-left:4px solid #ef4444;color:#7f1d1d;border-radius:6px;font-size:13px;';
    container.appendChild(errBox);
    function showError(msg){errBox.style.display='block';errBox.textContent=msg;}
    function clearError(){errBox.style.display='none';errBox.textContent='';}

    function renderRange(){
      clearError();
      body.innerHTML='';
      var today=startOfDay(new Date());

      var title=document.createElement('div');
      title.style.cssText='font-size:13.5px;color:#475569;font-weight:500;margin:4px 0 10px;';
      title.textContent='Freie Termine in den n\xE4chsten 4 Wochen ('+fmtDay.format(state.rangeStart)+' \u2013 '+fmtDay.format(addDays(state.rangeStart,RANGE_DAYS-1))+')';
      body.appendChild(title);

      // 28 Tage: 4 Reihen \xD7 7 Spalten
      var grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:14px;';
      for(var i=0;i<RANGE_DAYS;i++){
        (function(i){
          var d=addDays(state.rangeStart,i);
          var ymd=toYMD(d);
          var slots=state.slotsByDay[ymd]||[];
          var disabled = d<today || slots.length===0;
          var b=document.createElement('button');b.type='button';
          var active = state.selectedDay===ymd;
          b.style.cssText='padding:8px 2px;border-radius:10px;border:1.5px solid '+(active?'#0f172a':'#e2e8f0')+';background:'+(active?'#0f172a':disabled?'#f8fafc':'#fff')+';color:'+(active?'#fff':disabled?'#cbd5e1':'#0f172a')+';cursor:'+(disabled?'not-allowed':'pointer')+';font-size:12px;font-weight:600;text-align:center;line-height:1.25;';
          var parts=ymd.split('-');
          var wd=fmtDay.format(d).split(',')[0];
          b.innerHTML='<div style="font-size:10.5px;opacity:.7;">'+wd+'</div><div style="font-size:14px;margin-top:2px;">'+parts[2]+'.'+parts[1]+'</div><div style="font-size:10px;margin-top:2px;opacity:.75;">'+(slots.length?'frei':state.loadingSlots?'\u2026':'\u2014')+'</div>';
          if(!disabled){b.onclick=function(){state.selectedDay=ymd;renderRange();};}
          grid.appendChild(b);
        })(i);
      }
      body.appendChild(grid);

      // Zeit-Slots des ausgew\xE4hlten Tages
      var slotBox=document.createElement('div');slotBox.style.cssText='min-height:60px;';
      if(state.loadingSlots){
        slotBox.innerHTML='<div style="text-align:center;color:#64748b;padding:20px;font-size:13.5px;">Lade freie Zeiten \u2026</div>';
      } else if(!state.selectedDay){
        slotBox.innerHTML='<div style="text-align:center;color:#64748b;padding:16px;font-size:13.5px;">Bitte w\xE4hlen Sie einen Tag aus.</div>';
      } else {
        var slots=state.slotsByDay[state.selectedDay]||[];
        if(slots.length===0){
          slotBox.innerHTML='<div style="text-align:center;color:#64748b;padding:16px;font-size:13.5px;">An diesem Tag sind keine Termine mehr frei.</div>';
        } else {
          var dLabel=document.createElement('div');dLabel.style.cssText='font-size:13.5px;font-weight:600;color:#0f172a;margin-bottom:8px;';
          dLabel.textContent=fmtDayLong.format(new Date(state.selectedDay+'T12:00:00'));
          slotBox.appendChild(dLabel);
          var sg=document.createElement('div');sg.style.cssText='display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;';
          slots.forEach(function(s){
            var btn=document.createElement('button');btn.type='button';
            btn.textContent=fmtTime.format(new Date(s.start));
            btn.style.cssText='padding:10px;border:1.5px solid #0f172a;background:#fff;color:#0f172a;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;transition:all .12s;';
            btn.onmouseenter=function(){btn.style.background='#0f172a';btn.style.color='#fff';};
            btn.onmouseleave=function(){btn.style.background='#fff';btn.style.color='#0f172a';};
            btn.onclick=function(){bookSlot(s);};
            sg.appendChild(btn);
          });
          slotBox.appendChild(sg);
        }
      }
      body.appendChild(slotBox);
    }

    function loadRange(){
      state.loadingSlots=true;renderRange();
      var from=toYMD(state.rangeStart);
      var to=toYMD(addDays(state.rangeStart,RANGE_DAYS-1));
      fetch(bookingUrl('slots',{schedule_id:state.schedule.schedule_id, from:from, to:to}))
        .then(function(r){return r.json();})
        .then(function(res){
          state.loadingSlots=false;
          if(!res.ok){showError('Slots konnten nicht geladen werden.');return;}
          var byDay={};(res.slots||[]).forEach(function(s){
            var ymd=toYMD(new Date(s.start));
            (byDay[ymd]=byDay[ymd]||[]).push(s);
          });
          state.slotsByDay=byDay;
          if(!state.selectedDay){
            for(var i=0;i<RANGE_DAYS;i++){var y=toYMD(addDays(state.rangeStart,i));if((byDay[y]||[]).length){state.selectedDay=y;break;}}
          }
          renderRange();
        })
        .catch(function(){state.loadingSlots=false;showError('Netzwerkfehler beim Laden der Slots.');});
    }

    function bookSlot(s){
      clearError();
      body.innerHTML='<div style="text-align:center;color:#64748b;padding:30px;font-size:14px;">Termin wird gebucht \u2026</div>';
      fetch(bookingUrl('book'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token, starts_at:s.start, applicant_timezone:TZ})})
        .then(function(r){return r.json().then(function(j){return {status:r.status, body:j};});})
        .then(function(res){
          if(!res.body||!res.body.ok){
            var err=res.body&&res.body.error;
            if(err==='already_scheduled'){
              renderRange();
              showError('F\xFCr diese Bewerbung ist bereits ein Termin gebucht. Bitte pr\xFCfen Sie Ihre Calendly-Terminbest\xE4tigung.');
              return;
            }
            if(res.status===409||err==='slot_taken'){
              loadRange();
              setTimeout(function(){showError('Dieser Termin wurde gerade schon vergeben. Bitte w\xE4hlen Sie einen anderen.');},0);
              return;
            }
            renderRange();
            showError(err==='invalid_body'?'Die Terminzeit konnte nicht verarbeitet werden. Bitte laden Sie die Seite neu und versuchen Sie es erneut.':err==='no_schedule_configured'?'Kalender-Konfiguration konnte nicht gefunden werden. Bitte kontaktieren Sie uns.':'Buchung fehlgeschlagen. Bitte versuchen Sie es erneut.');
            return;
          }
          renderConfirmed(res.body);
        })
        .catch(function(){renderRange();showError('Netzwerkfehler bei der Buchung.');});
    }

    // Kalendereintrag (.ics) lokal erzeugen \u2013 ohne Mailversand ist das die
    // einzige Erinnerung, die der Bewerber auf dem Handy bekommt.
    function icsPad(n){return String(n).padStart(2,'0');}
    function icsDate(d){return d.getUTCFullYear()+icsPad(d.getUTCMonth()+1)+icsPad(d.getUTCDate())+'T'+icsPad(d.getUTCHours())+icsPad(d.getUTCMinutes())+icsPad(d.getUTCSeconds())+'Z';}
    function icsEsc(s){return String(s).replace(/\\\\/g,'\\\\\\\\').replace(/;/g,'\\\\;').replace(/,/g,'\\\\,').replace(/\\r?\\n/g,'\\\\n');}
    function downloadIcs(start,end,title,desc,loc){
      var body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mitarbeiter-Portal//Termin//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+Date.now()+'@portal','DTSTAMP:'+icsDate(new Date()),'DTSTART:'+icsDate(start),'DTEND:'+icsDate(end),'SUMMARY:'+icsEsc(title),'DESCRIPTION:'+icsEsc(desc||''),'LOCATION:'+icsEsc(loc||''),'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(title),'TRIGGER:-PT30M','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\\r\\n');
      var blob=new Blob([body],{type:'text/calendar;charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download='bewerbungsgespraech.ics';
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url);},2000);
    }

    function renderConfirmed(bk){
      container.innerHTML='';
      var wrap=document.createElement('div');wrap.style.cssText='text-align:center;padding:12px 4px;';
      var chk=document.createElement('div');chk.style.cssText='width:56px;height:56px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;';
      chk.innerHTML='<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      var h2=document.createElement('h3');h2.style.cssText='margin:0 0 8px;font-size:22px;font-weight:700;';h2.textContent='Termin best\xE4tigt';
      var start=new Date(bk.starts_at), end=new Date(bk.ends_at);
      var when=document.createElement('p');when.style.cssText='margin:0 0 6px;font-size:16px;color:#0f172a;font-weight:600;';
      when.textContent=fmtDayLong.format(start)+' \xB7 '+fmtTime.format(start)+'\u2013'+fmtTime.format(end)+' Uhr (deutsche Zeit)';
      var mail=document.createElement('p');mail.style.cssText='margin:6px 0 14px;color:#475569;font-size:13.5px;';
      mail.textContent='Ihre Bewerbung ist eingegangen. Alle weiteren Details finden Sie direkt hier im Portal.';
      wrap.appendChild(chk);wrap.appendChild(h2);wrap.appendChild(when);wrap.appendChild(mail);

      // Terminseite im Portal (Link merken, Gespr\xE4ch starten, umbuchen)
      var portalOrigin='';
      try{portalOrigin=apiBase();}catch(_){portalOrigin='';}
      var terminUrl=(bk.cancel_token&&portalOrigin)?(portalOrigin+'/termin/'+bk.cancel_token):'';

      var actions=document.createElement('div');
      actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 auto 14px;max-width:560px;';
      var cal=document.createElement('button');
      cal.type='button';
      cal.textContent='\u{1F4C5} Termin in meinen Kalender';
      cal.style.cssText='flex:1 1 220px;padding:11px 16px;border-radius:9px;border:0;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer;';
      cal.onclick=function(){downloadIcs(start,end,'Bewerbungsgespr\xE4ch','Ihr Gespr\xE4ch findet online statt.'+(terminUrl?('\\nIhre Terminseite: '+terminUrl):''),terminUrl);};
      actions.appendChild(cal);
      if(terminUrl){
        var wa=document.createElement('a');
        wa.href='https://wa.me/?text='+encodeURIComponent('Mein Bewerbungsgespr\xE4ch: '+fmtDayLong.format(start)+' um '+fmtTime.format(start)+' Uhr. Meine Terminseite: '+terminUrl);
        wa.target='_blank';wa.rel='noopener noreferrer';
        wa.textContent='Termin per WhatsApp sichern';
        wa.style.cssText='flex:1 1 220px;padding:11px 16px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-size:14px;font-weight:600;text-decoration:none;';
        actions.appendChild(wa);
      }
      wrap.appendChild(actions);

      var next=document.createElement('div');
      next.style.cssText='margin:4px auto 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:left;font-size:13.5px;line-height:1.6;color:#0f172a;max-width:560px;';
      next.innerHTML='<strong>So geht es weiter:</strong>'
        + '<div style="margin-top:8px;">1. Termin im Kalender speichern \u2013 Ihr Handy erinnert Sie dann rechtzeitig.</div>'
        + '<div style="margin-top:4px;">2. Zur vereinbarten Zeit \xFCber den Button auf Ihrer Terminseite am Gespr\xE4ch teilnehmen.</div>'
        + '<div style="margin-top:4px;">3. Bei einer Zusage schlie\xDFen Sie Ihre Registrierung direkt im Anschluss ab.</div>'
        + (terminUrl?('<div style="margin-top:10px;">Ihre Terminseite: <a href="'+terminUrl+'" style="color:#2563eb;" target="_blank" rel="noopener noreferrer">jederzeit hier \xF6ffnen</a></div>'):'')
        + '<div style="margin-top:10px;color:#475569;">Sollten Sie den Termin nicht wahrnehmen k\xF6nnen, geben Sie uns bitte rechtzeitig \xFCber Ihre Terminseite Bescheid.</div>';
      wrap.appendChild(next);


      if(state.schedule && state.schedule.event_description){
        var desc=document.createElement('div');
        desc.style.cssText='margin:12px auto 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:left;font-size:13.5px;line-height:1.55;color:#0f172a;max-width:560px;';
        // event_description kann HTML enthalten (aus dem Portal-Editor).
        desc.innerHTML=state.schedule.event_description;
        wrap.appendChild(desc);
      }
      container.appendChild(wrap);
    }

    // \u2500\u2500 Start: Schedule laden \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    fetch(bookingUrl('schedule',{token:token}))
      .then(function(r){return r.json().then(function(j){return {status:r.status, body:j};});})
      .then(function(res){
        if(!res.body||!res.body.ok){
          sub.textContent='';
          if(res.status===404){showError('Ihr Buchungslink ist ung\xFCltig oder abgelaufen. Bitte kontaktieren Sie uns.');}
          else{showError('Terminwahl konnte nicht geladen werden.');}
          return;
        }
        state.schedule=res.body;
        var greet='W\xE4hlen Sie jetzt einen freien Termin f\xFCr Ihr Online-Interview (ca. 15 Minuten).';
        if(res.body.applicant_first_name){
          greet='Hallo '+res.body.applicant_first_name+', w\xE4hlen Sie jetzt einen freien Termin f\xFCr Ihr Online-Interview (ca. 15 Minuten).';
        }
        sub.textContent=greet;
        loadRange();
      })
      .catch(function(){sub.textContent='';showError('Netzwerkfehler beim Laden des Kalenders.');});
  }

  function showModal(opts){
    opts=opts||{};var isFast=!!opts.fast;var broker=opts.broker||null;var wa=String(opts.whatsapp||'').replace(/[^0-9]/g,'');
    var redirectUrl=opts.redirectUrl||'';var emailStatus=opts.emailStatus||null;var bookingError=opts.bookingError||'';
    var isBooking=/\\/buchen\\//.test(redirectUrl);

    // NEU: Bei Buchung kein Modal \u2014 direkt inline unter dem Formular rendern.
    if(isBooking){
      var tokenMatch=redirectUrl.match(/\\/buchen\\/([^/?#]+)/);
      var token=tokenMatch?tokenMatch[1]:null;
      if(token){
        var form=document.getElementById('application-form');
        var statusEl=document.getElementById('form-status');
        var host=document.getElementById('booking-inline-host');
        if(!host){
          host=document.createElement('div');host.id='booking-inline-host';
          (form&&form.parentNode?form.parentNode:document.body).insertBefore(host, form?form.nextSibling:null);
        }
        if(form)form.style.display='none';
        if(statusEl)statusEl.style.display='none';
        host.scrollIntoView({behavior:'smooth',block:'start'});
        renderBookingInline(host, token, {emailStatus:emailStatus});
        return;
      }
      // Fallback: alte Modal-Variante mit Fenster-Link
    }

    var ov=document.createElement('div');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;backdrop-filter:blur(2px);';
    var box=document.createElement('div');
    box.style.cssText='background:#fff;color:#0f172a;max-width:520px;width:100%;border-radius:14px;padding:32px 28px;box-shadow:0 20px 60px -10px rgba(0,0,0,.35);font-family:inherit;position:relative;text-align:center;';
    var cls=document.createElement('button');cls.type='button';cls.innerHTML='&times;';cls.setAttribute('aria-label','Schlie\xDFen');
    cls.style.cssText='position:absolute;top:10px;right:14px;background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#64748b;';
    cls.onclick=function(){ov.remove();};
    var chk=document.createElement('div');chk.style.cssText='width:64px;height:64px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;';
    chk.innerHTML='<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var h=document.createElement('h3');h.style.cssText='margin:0 0 10px;font-size:24px;font-weight:700;line-height:1.25;';
    var p=document.createElement('p');p.style.cssText='margin:0 0 16px;color:#475569;font-size:15px;line-height:1.55;';
    box.appendChild(cls);box.appendChild(chk);box.appendChild(h);box.appendChild(p);

    if(broker){
      // Einheitlicher Text auf ALLEN Landing Pages \u2013 nur das Design variiert.
      // own_brand = Gespr\xE4ch findet bei derselben Firma statt, auf der beworben
      // wurde \u2192 kein Markenwechsel, kein "Wir verbinden Sie mit ...".
      var ownBrand=broker.own_brand!==false;
      h.textContent='Fast geschafft!';
      p.textContent='Um Ihre Bewerbung abzuschlie\xDFen, w\xE4hlen Sie bitte jetzt Ihren Termin f\xFCr das Erstgespr\xE4ch aus.';
      var pc=document.createElement('div');pc.style.cssText='background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin:0 0 22px;';
      if(broker.partner_logo){var lg=document.createElement('img');lg.src=broker.partner_logo;lg.alt=broker.partner_name||'';lg.style.cssText='max-height:36px;margin:0 auto 10px;display:block;';pc.appendChild(lg);}
      var pl=document.createElement('div');pl.textContent=ownBrand?'Ihr Gespr\xE4ch findet statt mit':'Wir verbinden Sie mit';pl.style.cssText='font-size:13px;color:#475569;margin-bottom:6px;';
      var pn=document.createElement('div');pn.textContent=broker.partner_name||'unserem Partnerunternehmen';pn.style.cssText='font-size:17px;font-weight:700;color:#0f172a;';
      pc.appendChild(pl);pc.appendChild(pn);
      var pd=document.createElement('div');pd.textContent='Kurzes Kennenlerngespr\xE4ch \xB7 ca. 15 Minuten \xB7 bequem vom Handy';pd.style.cssText='font-size:12px;color:#475569;margin-top:8px;';
      pc.appendChild(pd);box.appendChild(pc);
      var hr=document.createElement('hr');hr.style.cssText='border:0;border-top:1px solid #e2e8f0;margin:18px 0;';box.appendChild(hr);
      var nextH=document.createElement('h4');nextH.textContent='Wie geht es jetzt weiter?';nextH.style.cssText='margin:0 0 8px;font-size:17px;font-weight:700;';
      var nextP=document.createElement('p');nextP.textContent='Sie w\xE4hlen jetzt Ihren Wunschtermin. Direkt danach k\xF6nnen Sie ihn in Ihren Kalender \xFCbernehmen \u2013 Ihr Handy erinnert Sie dann rechtzeitig.';nextP.style.cssText='margin:0 0 16px;color:#475569;font-size:14px;line-height:1.55;';
      box.appendChild(nextH);box.appendChild(nextP);
      // Calendly sitzt IMMER vor dem Termin. Kein Portal-/Fallback-Link mehr \u2013
      // fehlt der Calendly-Link, ist die Landing Page falsch konfiguriert.
      var bookHref=broker.calendly_url||'';
      if(bookHref){var cta2=document.createElement('a');cta2.href=bookHref;cta2.target='_blank';cta2.rel='noopener';cta2.textContent='Jetzt Termin vereinbaren  \u2192';
        cta2.style.cssText='display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:999px;font-size:16px;box-shadow:0 6px 20px -6px rgba(34,197,94,.55);';box.appendChild(cta2);
        var hint2=document.createElement('p');hint2.textContent='Es \xF6ffnet sich ein neues Fenster zur Terminauswahl.';hint2.style.cssText='margin:12px 0 0;font-size:12px;color:#94a3b8;';box.appendChild(hint2);}
      else{var hint3=document.createElement('p');hint3.textContent='Die Terminbuchung ist gerade nicht verf\xFCgbar. Bitte kontaktieren Sie uns kurz \u2013 wir vereinbaren den Termin pers\xF6nlich mit Ihnen.';hint3.style.cssText='margin:4px 0 0;font-size:13px;color:#64748b;';box.appendChild(hint3);
        try{console.error('[landing] broker.calendly_url fehlt \u2013 Landing Page ohne Calendly-Link konfiguriert');}catch(e){}}
      // WhatsApp: Der Termin ist pro forma \u2014 das Gespr\xE4ch kann jederzeit
      // stattfinden. Flexibilit\xE4t klar sagen, damit ein verpasster Termin
      // nicht wie \u201Ejetzt ist es zu sp\xE4t" wirkt.
      if(wa){
        var wcard=document.createElement('div');wcard.style.cssText='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:18px 0 0;text-align:center;';
        wcard.innerHTML='<p style="margin:0 0 10px;font-size:13px;color:#166534;line-height:1.5;"><strong>Termin passt nicht?</strong> Kein Problem \u2014 das Kennenlerngespr\xE4ch ist flexibel. Schreiben Sie uns kurz per WhatsApp, dann f\xFChren wir das Gespr\xE4ch, wann es Ihnen passt.</p><a href="https://wa.me/'+wa+'?text='+encodeURIComponent('Hallo, ich habe gerade meinen Termin f\xFCr das Kennenlerngespr\xE4ch gebucht. Passt bei mir!')+'" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25d366;color:#fff;text-decoration:none;font-weight:700;padding:12px 16px;border-radius:8px;font-size:15px;">Kurz per WhatsApp melden</a>';
        box.appendChild(wcard);
      }
    } else if(isFast){
      h.textContent='Fast geschafft!';
      p.textContent='Klicken Sie jetzt auf den Button, um Ihren Termin zu buchen.';
      if(redirectUrl){var gn=document.createElement('button');gn.type='button';gn.textContent='Jetzt zum Portal \u2192';
        gn.style.cssText='display:block;width:100%;background:#0f172a;color:#fff;border:0;padding:14px 18px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:12px;';
        var ri=document.createElement('p');ri.style.cssText='margin:0 0 12px;font-size:13px;color:#64748b;';var sec=10;ri.textContent='Automatische Weiterleitung in '+sec+' Sekunden \u2026';
        box.appendChild(gn);box.appendChild(ri);var go=function(){window.location.href=redirectUrl;};gn.onclick=go;
        var t=setInterval(function(){sec-=1;if(sec<=0){clearInterval(t);go();return;}ri.textContent='Automatische Weiterleitung in '+sec+' Sekunden \u2026';},1000);}
      box.appendChild(spamHintBox(emailStatus));
    } else if(redirectUrl){
      // KI-Interview / sonstige Redirects
      h.textContent='Vielen Dank!';
      p.textContent='Ihre Daten wurden erfolgreich \xFCbermittelt.';
      var cta=document.createElement('a');cta.href=redirectUrl;cta.textContent='Weiter  \u2192';
      cta.style.cssText='display:block;width:100%;background:#0f172a;color:#fff;text-align:center;text-decoration:none;font-weight:600;padding:16px 24px;border-radius:10px;font-size:16px;margin-bottom:6px;box-sizing:border-box;';
      box.appendChild(cta);
      box.appendChild(spamHintBox(emailStatus));
    } else {
      h.textContent='Vielen Dank!';
      p.innerHTML=bookingError==='internal_schedule_missing'
        ? 'Wir haben Ihre Daten erfolgreich erhalten. Die Terminwahl ist aktuell nicht verf\xFCgbar. Wir senden Ihnen den Termin-Link per E-Mail oder melden uns direkt bei Ihnen.'
        : 'Wir haben Ihre Daten erfolgreich erhalten. Wir melden uns zeitnah per E-Mail oder Telefon bei Ihnen.';
      if(wa){
        var c=document.createElement('div');c.style.cssText='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;text-align:left;';
        c.innerHTML='<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#2563eb;margin-bottom:8px;">SCHNELLER KONTAKT</div><p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.5;">Melden Sie sich bei WhatsApp unter <strong>'+fmtWa(wa)+'</strong>, um auf dem neusten Stand zu bleiben.</p><a href="https://wa.me/'+wa+'?text='+encodeURIComponent('Hallo, ich habe gerade meine Bewerbung abgeschickt.')+'" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:12px 16px;border-radius:8px;font-size:15px;">WhatsApp-Chat starten</a>';
        box.appendChild(c);
      }
    }
    var cb=document.createElement('button');cb.type='button';cb.textContent='Schlie\xDFen';
    cb.style.cssText='background:#fff;border:1px solid #cbd5e1;color:#0f172a;padding:9px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;margin-top:6px;';
    cb.onclick=function(){ov.remove();};box.appendChild(cb);ov.appendChild(box);
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});document.body.appendChild(ov);
  }
  // \u2500\u2500 Ablauf-Erkl\xE4rung \xFCber dem Formular \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Bewerber sollen VOR dem Absenden wissen, dass direkt danach ein Termin
  // gew\xE4hlt wird und das Gespr\xE4ch online stattfindet.
  function injectProcessSteps(form){
    if(!form || document.getElementById('lv-process-steps')) return;
    var box=document.createElement('div');
    box.id='lv-process-steps';
    box.style.cssText='margin:0 0 18px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;text-align:left;color:#0f172a;font-size:13.5px;line-height:1.55;';
    var steps=[
      ['1','Formular ausf\xFCllen','dauert ca. 2 Minuten'],
      ['2','Termin direkt ausw\xE4hlen','freie Zeiten erscheinen sofort auf dieser Seite'],
      ['3','Interview f\xFChren','online \xFCber den Link aus Ihrer Calendly-Terminbest\xE4tigung, ca. 15 Minuten'],
      ['4','Bei Zusage registrieren','Sie schlie\xDFen Ihre Anmeldung direkt im Anschluss ab'],
    ];
    var html='<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#2563eb;margin-bottom:10px;">SO L\xC4UFT ES AB</div>';
    steps.forEach(function(s){
      html+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;">'
        + '<span style="flex:0 0 22px;height:22px;border-radius:50%;background:#0f172a;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;">'+s[0]+'</span>'
        + '<span><strong>'+s[1]+'</strong> \u2013 '+s[2]+'</span>'
        + '</div>';
    });
    box.innerHTML=html;
    form.parentNode.insertBefore(box, form);
  }

  // \u2500\u2500 DSGVO-Consent + Datenschutz-Kurzfassung ins Formular injizieren \u2500\u2500\u2500\u2500
  function injectPrivacyBlock(form){
    if(!form || form.querySelector('.lv-privacy-block')) return;
    var submit = form.querySelector('button[type=submit], input[type=submit]');
    if(!submit) return;
    var firm = window.LANDING_FIRMENNAME || 'wir';
    var dsUrl = window.LANDING_DATENSCHUTZ_URL || 'datenschutz.html';
    var mail = window.LANDING_CONTACT_EMAIL || '';
    var wrap = document.createElement('div');
    wrap.className = 'lv-privacy-block';
    wrap.style.cssText = 'margin:14px 0 12px;font-size:13px;line-height:1.55;color:#475569;text-align:left;';
    wrap.innerHTML =
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">'
      + '<input type="checkbox" id="lv-dsgvo-consent" required style="margin-top:3px;flex-shrink:0;width:16px;height:16px;accent-color:#0f172a;">'
      + '<span>Ich habe die <a href="'+dsUrl+'" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;">Datenschutzerkl\xE4rung</a> zur Kenntnis genommen und willige in die Verarbeitung meiner Daten zum Zweck der Bewerbung ein. Diese Einwilligung kann ich jederzeit widerrufen'
      + (mail?' (per E-Mail an <a href="mailto:'+mail+'" style="color:#2563eb;">'+mail+'</a>)':'')
      + '.</span>'
      + '</label>'
      + '<details style="margin-top:8px;">'
      + '<summary style="cursor:pointer;font-size:12.5px;color:#64748b;padding:4px 2px;">Ihre Daten werden vertraulich behandelt \u2013 Details anzeigen</summary>'
      + '<div style="margin-top:8px;padding:10px 12px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:6px;font-size:12.5px;color:#475569;">'
      + '<strong>Verantwortlich:</strong> '+firm+'.<br>'
      + '<strong>Zweck:</strong> Durchf\xFChrung des Bewerbungsverfahrens (Art. 6 Abs. 1 lit. b DSGVO, \xA7 26 BDSG).<br>'
      + '<strong>Empf\xE4nger:</strong> Nur '+firm+' bzw. \u2013 bei Vermittlungsprozessen \u2013 die von Ihnen zur Weiterleitung freigegebenen Partnerunternehmen.<br>'
      + '<strong>Speicherdauer:</strong> Bis zu 6 Monate nach Abschluss des Verfahrens, danach L\xF6schung.<br>'
      + '<strong>Ihre Rechte:</strong> Auskunft, Berichtigung, L\xF6schung, Einschr\xE4nkung, Daten\xFCbertragbarkeit, Widerspruch, Widerruf \u2013 jederzeit'
      + (mail?' an <a href="mailto:'+mail+'" style="color:#2563eb;">'+mail+'</a>':'')+'.'
      + '</div>'
      + '</details>';
    submit.parentNode.insertBefore(wrap, submit);
  }

  document.addEventListener('DOMContentLoaded',function(){
    var form=document.getElementById('application-form');var status=document.getElementById('form-status');if(!form)return;
    injectProcessSteps(form);
    injectPrivacyBlock(form);
    // Theme-eigene Status-Klasse behalten (z. B. ttsb-form-status) und nur den
    // Zustand erg\xE4nzen \u2014 sonst sind Meldungen im Theme unsichtbar.
    var baseStatusClass=(status&&status.className?status.className:'lv-form-status');
    if(baseStatusClass.indexOf('lv-form-status')===-1)baseStatusClass=(baseStatusClass+' lv-form-status').trim();
    function setStatus(state,text){
      if(!status)return;
      status.className=baseStatusClass+(state?' '+state:'');
      status.style.display='';
      status.textContent=text;
    }
    form.addEventListener('submit',function(e){
      e.preventDefault();
      var consent=form.querySelector('#lv-dsgvo-consent');
      if(consent && !consent.checked){
        setStatus('error','Bitte best\xE4tigen Sie die Datenschutz-Einwilligung, um fortzufahren.');
        try{consent.focus();}catch(_){}
        return;
      }
      setStatus('','Wird gesendet\u2026');
      var raw=Object.fromEntries(new FormData(form).entries());
      var first=(raw.first_name||'').toString().trim();var last=(raw.last_name||'').toString().trim();var street=(raw.street||'').toString().trim();
      var data={first_name:first||null,last_name:last||null,full_name:(first+' '+last).trim(),email:raw.email,phone:raw.phone||null,
        postal_code:raw.postal_code||null,city:raw.city||null,message:street?'Adresse: '+street:null};
      data.domain=(window.location&&window.location.hostname?window.location.hostname:'').replace(/^www\\./,'');
      data.flow_type=window.FLOW_TYPE||'classic';
      if(window.TENANT_ID)data.tenant_id=window.TENANT_ID;
      if(window.PORTAL_URL)data.portal_url=window.PORTAL_URL;
      if(window.SOURCE_SLUG)data.source_slug=window.SOURCE_SLUG;
      data.dsgvo_consent=true;
      data.consent_timestamp=new Date().toISOString();
      var endpoint=String(window.PORTAL_API||'').trim();
      if(!/^https?:\\/\\//i.test(endpoint)){
        // Ohne konfigurierten Portal-Endpunkt w\xFCrde der POST auf der Landing Page
        // selbst landen (HTML-Antwort) und f\xE4lschlich als Erfolg gelten.
        try{console.error('[landing] window.PORTAL_API fehlt oder ist ung\xFCltig \u2013 Bewerbung wurde NICHT \xFCbermittelt');}catch(_){}
        setStatus('error','Das Bewerbungsformular ist aktuell nicht erreichbar. Bitte kontaktieren Sie uns direkt \u2013 Ihre Daten wurden nicht \xFCbermittelt.');
        return;
      }
      fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
        .then(function(r){
          return r.text().then(function(txt){
            var body=null;try{body=txt?JSON.parse(txt):null;}catch(_){}
            if(r.ok&&(!body||typeof body!=='object'||body.success!==true)){
              // Antwort kam nicht vom Portal (z. B. HTML einer Fehlerseite) \u2192 kein Erfolg vort\xE4uschen.
              try{console.error('[landing] unerwartete Antwort vom Bewerbungs-Endpunkt');}catch(_){}
              var e2=new Error('unexpected_response');
              e2.userMessage='Ihre Bewerbung konnte nicht \xFCbermittelt werden. Bitte versuchen Sie es erneut oder kontaktieren Sie uns direkt.';
              throw e2;
            }

            if(!r.ok){
              var msg='';
              if(body&&body.details&&body.details.fieldErrors){
                var fe=body.details.fieldErrors;var parts=[];
                for(var k in fe){if(Object.prototype.hasOwnProperty.call(fe,k))parts.push(k);}
                if(parts.length)msg='Bitte pr\xFCfen Sie diese Felder: '+parts.join(', ')+'.';
              }
              if(!msg&&body&&body.error)msg=String(body.error);
              var err=new Error(msg||('HTTP '+r.status));
              err.userMessage=msg;
              throw err;
            }
            return body||{};
          });
        })
        .then(function(res){form.reset();setStatus('success','Bewerbung erfolgreich gesendet.');
          // Eigene Danke-Seite (/danke) \u2014 echte URL f\xFCr Meta-/Facebook-Ads.
          if(window.LANDING_THANKS_URL!==false){
            try{
              var redir=(res&&res.redirect_url)||'';
              var tm=/\\/buchen\\/([^/?#]+)/.exec(redir);
              var qs=[];
              if(tm)qs.push('token='+encodeURIComponent(tm[1]));
              if(/^https?:\\/\\//i.test(redir))qs.push('next='+encodeURIComponent(redir));
              var es=(res&&res.email_status)||null;
              if(es&&es.status)qs.push('mail='+encodeURIComponent(es.status));
              if(es&&es.reason)qs.push('mailreason='+encodeURIComponent(es.reason));
              var br=(res&&res.broker)||null;
              if(br&&br.partner_name)qs.push('partner='+encodeURIComponent(br.partner_name));
              if(br&&br.partner_logo)qs.push('partnerlogo='+encodeURIComponent(br.partner_logo));
              // Vermittlungs-Flow: Terminbuchung laeuft ueber Calendly des Partners.
              if(br&&br.calendly_url&&!/^https?:\\/\\//i.test(redir))qs.push('next='+encodeURIComponent(br.calendly_url));
              // Meta-Pixel: Lead direkt beim Absenden feuern (Fast-geschafft-Moment),
              // damit die Conversion auch ohne Weiterleitung zaehlt. lead=1 verhindert
              // ein zweites Lead auf /danke.
              var leadFired=false;
              try{if(typeof window.fbq==='function'){window.fbq('track','Lead');leadFired=true;}}catch(_){}
              if(leadFired)qs.push('lead=1');
              location.assign('/danke'+(qs.length?('?'+qs.join('&')):''));
              return;
            }catch(_){}
          }
          showModal({fast:(window.FLOW_TYPE||'classic')==='fast',whatsapp:window.WHATSAPP_NUMBER||'',redirectUrl:(res&&res.redirect_url)||'',broker:(res&&res.broker)||null,emailStatus:(res&&res.email_status)||null,bookingError:(res&&res.booking_error)||''});})
        .catch(function(err){
          setStatus('error',(err&&err.userMessage)?err.userMessage:'Da ist etwas schiefgelaufen. Bitte sp\xE4ter erneut versuchen.');
          try{status.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){}
        });
    });
  });

  // \u2500\u2500 Danke-Seite (/danke): Terminauswahl direkt dort rendern \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  window.LandingBooking = { renderInline: renderBookingInline, spamHint: spamHintBox };
  document.addEventListener('DOMContentLoaded', function(){
    var host = document.getElementById('booking-inline-host');
    if(!host || host.getAttribute('data-mounted')==='1') return;
    var token = host.getAttribute('data-token') || '';
    if(!token){
      try{ token = new URLSearchParams(location.search).get('token') || ''; }catch(_){}
    }
    if(!token) return;
    host.setAttribute('data-mounted','1');
    var mail = host.getAttribute('data-mail') || '';
    var reason = host.getAttribute('data-mail-reason') || '';
    renderBookingInline(host, token, { emailStatus: mail||reason ? { status: mail, reason: reason } : null });
  });
})();

`;

// src/lib/landing-sections.ts
var SECTION_CATALOG = [
  {
    type: "hero",
    label: "Titelbereich",
    description: "Gro\xDFer Einstieg mit \xDCberschrift und Bewerbungs-Knopf.",
    fields: [
      { key: "kicker", label: "Kleine Zeile \xFCber dem Titel", kind: "text", placeholder: "z.B. Personalservice \xB7 Logistik" },
      { key: "title", label: "\xDCberschrift", kind: "text" },
      { key: "subtitle", label: "Untertitel", kind: "textarea" },
      { key: "ctaText", label: "Knopf-Text", kind: "text", placeholder: "Jetzt bewerben" },
      { key: "imageUrl", label: "Bild (optional)", kind: "image", help: "Bild direkt hochladen oder Bild-URL einf\xFCgen." },
      {
        key: "variant",
        label: "Darstellung",
        kind: "select",
        options: [
          { value: "split", label: "Text links, Bild rechts" },
          { value: "centered", label: "Zentriert, Bild darunter" },
          { value: "cover", label: "Bild als Hintergrund" }
        ]
      }
    ],
    defaults: () => ({
      kicker: "",
      title: "Dein neuer Job wartet \u2014 bewirb dich in 2 Minuten",
      subtitle: "Wir bringen dich in einen sicheren Job bei gepr\xFCften Unternehmen in deiner Region. Ohne lange Bewerbungsunterlagen.",
      ctaText: "Jetzt bewerben",
      imageUrl: "",
      variant: "split"
    })
  },
  {
    type: "stelle",
    label: "Stellenanzeige",
    description: "Konkrete Stelle mit Aufgaben und Anforderungen.",
    fields: [
      { key: "title", label: "Stellentitel", kind: "text" },
      { key: "location", label: "Ort", kind: "text" },
      { key: "salary", label: "Gehalt (optional)", kind: "text", placeholder: "z.B. 14\u201316 \u20AC/Std." },
      { key: "intro", label: "Kurzbeschreibung", kind: "textarea" },
      { key: "tasks", label: "Aufgaben", kind: "strings", itemLabel: "Aufgabe" },
      { key: "requirements", label: "Das bringst du mit", kind: "strings", itemLabel: "Anforderung" }
    ],
    defaults: () => ({
      title: "",
      location: "",
      salary: "",
      intro: "",
      tasks: [""],
      requirements: [""]
    })
  },
  {
    type: "ablauf",
    label: "Ablauf (So geht's)",
    description: "Nummerierte Schritte vom Bewerben bis zum Start.",
    fields: [
      { key: "title", label: "\xDCberschrift", kind: "text" },
      {
        key: "steps",
        label: "Schritte",
        kind: "objects",
        itemLabel: "Schritt",
        itemFields: [
          { key: "title", label: "Titel", kind: "text" },
          { key: "desc", label: "Beschreibung", kind: "textarea" }
        ]
      }
    ],
    defaults: () => ({
      title: "In drei Schritten zur Zusage",
      steps: [
        { title: "Bewerbung abschicken", desc: "Kurzes Formular \u2014 dauert ca. 2 Minuten." },
        { title: "Termin w\xE4hlen", desc: "Direkt danach w\xE4hlst du deinen Wunschtermin f\xFCrs Kennenlerngespr\xE4ch." },
        { title: "Kennenlernen & Start", desc: "Kurzes Gespr\xE4ch, ca. 15 Minuten, bequem vom Handy. Danach geht alles Weitere sehr schnell." }
      ]
    })
  },
  {
    type: "faq",
    label: "FAQ",
    description: "H\xE4ufige Fragen als aufklappbare Liste.",
    fields: [
      { key: "title", label: "\xDCberschrift", kind: "text" },
      {
        key: "items",
        label: "Fragen",
        kind: "objects",
        itemLabel: "Frage",
        itemFields: [
          { key: "q", label: "Frage", kind: "text" },
          { key: "a", label: "Antwort", kind: "textarea" }
        ]
      }
    ],
    defaults: () => ({ title: "H\xE4ufige Fragen", items: [{ q: "", a: "" }] })
  },
  {
    type: "logos",
    label: "Partner-Logos",
    description: "Logoleiste von Unternehmen, f\xFCr die vermittelt wird.",
    fields: [
      { key: "title", label: "\xDCberschrift", kind: "text", placeholder: "z.B. Unsere Partnerunternehmen" },
      {
        key: "items",
        label: "Logos",
        kind: "objects",
        itemLabel: "Logo",
        itemFields: [
          { key: "img", label: "Bild-URL", kind: "image" },
          { key: "label", label: "Name", kind: "text" }
        ]
      }
    ],
    defaults: () => ({ title: "Unsere Partnerunternehmen", items: [] })
  },
  {
    type: "kontakt",
    label: "Ansprechpartner & Kontakt",
    description: "Pers\xF6nlicher Kontakt \u2014 WhatsApp, Telefon, E-Mail aus den Grundeinstellungen.",
    fields: [
      { key: "title", label: "\xDCberschrift", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "name", label: "Name der Person (optional)", kind: "text" },
      { key: "role", label: "Rolle (optional)", kind: "text", placeholder: "z.B. Deine Ansprechpartnerin" },
      { key: "showWhatsapp", label: "WhatsApp-Knopf anzeigen", kind: "boolean" },
      { key: "showPhone", label: "Telefonnummer anzeigen", kind: "boolean" },
      { key: "showEmail", label: "E-Mail anzeigen", kind: "boolean" }
    ],
    defaults: () => ({
      title: "Fragen? Schreib uns einfach.",
      text: "Du erreichst uns pers\xF6nlich \u2014 wir melden uns schnell bei dir zur\xFCck.",
      name: "",
      role: "",
      showWhatsapp: true,
      showPhone: true,
      showEmail: true
    })
  },
  {
    type: "freitext",
    label: "Freitext",
    description: "Freier Textabschnitt (Abs\xE4tze durch Leerzeilen trennen).",
    fields: [
      { key: "title", label: "\xDCberschrift (optional)", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" }
    ],
    defaults: () => ({ title: "", text: "" })
  },
  {
    type: "bild",
    label: "Bild",
    description: "Ein einzelnes Bild in voller Breite.",
    fields: [
      { key: "imageUrl", label: "Bild-URL", kind: "image" },
      { key: "alt", label: "Beschreibung (alt)", kind: "text" },
      { key: "caption", label: "Bildunterschrift (optional)", kind: "text" }
    ],
    defaults: () => ({ imageUrl: "", alt: "", caption: "" })
  },
  {
    type: "textbild",
    label: "Text & Bild",
    description: "Text mit Bild daneben \u2014 Bild links oder rechts w\xE4hlbar.",
    fields: [
      { key: "kicker", label: "Kleine Zeile \xFCber der \xDCberschrift (optional)", kind: "text" },
      { key: "title", label: "\xDCberschrift", kind: "text" },
      { key: "text", label: "Text", kind: "textarea" },
      { key: "imageUrl", label: "Bild", kind: "image", help: "Bild direkt hochladen oder Bild-URL einf\xFCgen." },
      { key: "imageRight", label: "Bild rechts statt links anzeigen", kind: "boolean" },
      { key: "ctaText", label: "Knopf-Text (optional)", kind: "text", placeholder: "z.B. Jetzt bewerben" },
      { key: "alt", label: "Bild-Beschreibung (alt)", kind: "text" }
    ],
    defaults: () => ({
      kicker: "",
      title: "Was dich bei uns erwartet",
      text: "Kurzer, pers\xF6nlicher Text: Was die Stelle auszeichnet, was das Team bietet und warum sich die Bewerbung lohnt.",
      imageUrl: "",
      imageRight: false,
      ctaText: "",
      alt: ""
    })
  },
  {
    type: "form",
    label: "Bewerbungsformular & Termin",
    description: "Fest verdrahtetes Bewerbungsformular mit anschlie\xDFender Terminwahl. Genau einmal pro Seite.",
    unique: true,
    fields: [],
    defaults: () => ({})
  }
];
var SECTION_TYPES = SECTION_CATALOG.map((s) => s.type);
function createSection(type) {
  const def = SECTION_CATALOG.find((s) => s.type === type);
  if (!def) throw new Error(`Unbekannter Abschnittstyp: ${type}`);
  return {
    id: `sec_${Math.random().toString(36).slice(2, 10)}`,
    type,
    data: def.defaults()
  };
}
function defaultSections() {
  return ["hero", "stelle", "textbild", "ablauf", "kontakt", "faq", "form"].map(createSection);
}
var SECTION_TEMPLATES = [
  {
    id: "klassisch",
    label: "Klassische Bewerberseite",
    description: "Titelbereich, Stelle, Ablauf, Ansprechpartner, FAQ, Formular.",
    types: ["hero", "stelle", "ablauf", "kontakt", "faq", "form"]
  },
  {
    id: "kurz",
    label: "Kurze Seite",
    description: "Nur Titelbereich und Bewerbungsformular \u2014 maximal schnell.",
    types: ["hero", "form"]
  },
  {
    id: "vertrauen",
    label: "Seite mit Vertrauens-Teil",
    description: "Titelbereich, Stelle, Partner-Logos, Ansprechpartner, FAQ, Formular.",
    types: ["hero", "stelle", "logos", "kontakt", "faq", "form"]
  },
  {
    id: "leer",
    label: "Leere Seite",
    description: "Nur das Bewerbungsformular \u2014 alles andere baust du selbst.",
    types: ["form"]
  }
];
function sectionsFromTemplate(templateId) {
  const tpl = SECTION_TEMPLATES.find((t) => t.id === templateId) || SECTION_TEMPLATES[0];
  return tpl.types.map(createSection);
}
var FONT_PAIRS = [
  { id: "system", label: "System (ohne Webfont)", heading: `system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`, body: `system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`, google: [] },
  { id: "inter-plus", label: "Modern & sachlich", heading: `"Plus Jakarta Sans",system-ui,sans-serif`, body: `Inter,system-ui,sans-serif`, google: ["Plus+Jakarta+Sans:wght@600;800", "Inter:wght@400;600"] },
  { id: "dm", label: "Freundlich & rund", heading: `"DM Sans",system-ui,sans-serif`, body: `"DM Sans",system-ui,sans-serif`, google: ["DM+Sans:wght@400;500;700"] },
  { id: "serif", label: "Seri\xF6s mit Serifen", heading: `"Source Serif 4",Georgia,serif`, body: `Inter,system-ui,sans-serif`, google: ["Source+Serif+4:wght@600;700", "Inter:wght@400;600"] },
  { id: "bold", label: "Kr\xE4ftig & werblich", heading: `Archivo,system-ui,sans-serif`, body: `"Barlow",system-ui,sans-serif`, google: ["Archivo:wght@700;800", "Barlow:wght@400;600"] }
];
var HEX = /^#[0-9a-fA-F]{6}$/;
var hex = (v, fb) => HEX.test(String(v ?? "")) ? String(v) : fb;
function defaultStyle() {
  return {
    mode: "light",
    primary: "#1d4ed8",
    accent: "#0f172a",
    bg: "#ffffff",
    surface: "#f8fafc",
    ink: "#0f172a",
    muted: "#475569",
    fontPair: "system",
    radius: 14,
    density: "normal",
    buttonShape: "pill"
  };
}
function normalizeStyle(raw) {
  const d = defaultStyle();
  const s = raw && typeof raw === "object" ? raw : {};
  const mode = s.mode === "dark" ? "dark" : "light";
  const dark = mode === "dark";
  return {
    mode,
    primary: hex(s.primary, d.primary),
    accent: hex(s.accent, d.accent),
    bg: hex(s.bg, dark ? "#0b1120" : d.bg),
    surface: hex(s.surface, dark ? "#111c33" : d.surface),
    ink: hex(s.ink, dark ? "#f1f5f9" : d.ink),
    muted: hex(s.muted, dark ? "#94a3b8" : d.muted),
    fontPair: FONT_PAIRS.some((f) => f.id === s.fontPair) ? String(s.fontPair) : d.fontPair,
    radius: Number.isFinite(Number(s.radius)) ? Math.min(32, Math.max(0, Math.round(Number(s.radius)))) : d.radius,
    density: ["kompakt", "normal", "luftig"].includes(String(s.density)) ? String(s.density) : d.density,
    buttonShape: ["pill", "rund", "eckig"].includes(String(s.buttonShape)) ? String(s.buttonShape) : d.buttonShape
  };
}
var PALETTES = [
  { primary: "#1d4ed8", accent: "#0f172a", mode: "light", bg: "#ffffff", surface: "#f1f5f9", ink: "#0f172a", muted: "#475569" },
  { primary: "#0f766e", accent: "#134e4a", mode: "light", bg: "#ffffff", surface: "#f0fdfa", ink: "#0f172a", muted: "#475569" },
  { primary: "#b45309", accent: "#1c1917", mode: "light", bg: "#fffbf5", surface: "#fef3c7", ink: "#1c1917", muted: "#57534e" },
  { primary: "#be123c", accent: "#1f2937", mode: "light", bg: "#ffffff", surface: "#fff1f2", ink: "#111827", muted: "#4b5563" },
  { primary: "#4f46e5", accent: "#020617", mode: "dark", bg: "#0b1120", surface: "#131f38", ink: "#f8fafc", muted: "#94a3b8" },
  { primary: "#22c55e", accent: "#052e16", mode: "dark", bg: "#0a0f0c", surface: "#132218", ink: "#f0fdf4", muted: "#9ca3af" }
];
var pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function randomStyle() {
  const p = pick(PALETTES);
  return normalizeStyle({
    ...p,
    fontPair: pick(FONT_PAIRS).id,
    radius: pick([0, 6, 12, 18, 24]),
    density: pick(["kompakt", "normal", "luftig"]),
    buttonShape: pick(["pill", "rund", "eckig"])
  });
}
function styleCss(st) {
  const pair = FONT_PAIRS.find((f) => f.id === st.fontPair) || FONT_PAIRS[0];
  const pad = st.density === "kompakt" ? 48 : st.density === "luftig" ? 104 : 72;
  const btnRadius = st.buttonShape === "pill" ? "999px" : st.buttonShape === "rund" ? "10px" : "2px";
  return `
:root{--lb-primary:${st.primary};--lb-secondary:${st.accent};--lb-ink:${st.ink};--lb-muted:${st.muted};--lb-bg:${st.bg};--lb-surface:${st.surface};--lb-line:${st.mode === "dark" ? "rgba(255,255,255,.14)" : "#e2e8f0"};--lb-radius:${st.radius}px;}
body{font-family:${pair.body};background:var(--lb-bg);color:var(--lb-ink)}
h1,h2,h3,.lb-brand{font-family:${pair.heading}}
.lb-section{padding:${pad}px 0}
.lb-hero{padding:${pad + 16}px 0;background:linear-gradient(180deg,color-mix(in oklab,var(--lb-primary) ${st.mode === "dark" ? 18 : 7}%,var(--lb-bg)) 0%,var(--lb-bg) 100%)}
.lb-alt{background:var(--lb-surface)}
.lb-card,.lb-step,.lb-faq-item{background:var(--lb-surface);border-color:var(--lb-line);border-radius:var(--lb-radius)}
.lb-btn{border-radius:${btnRadius}}
.lb-hero-img,.lb-tb-img img,.lb-bild img{border-radius:calc(var(--lb-radius) + 4px)}
.lb-header{background:color-mix(in oklab,var(--lb-bg) 92%,transparent);border-bottom:1px solid var(--lb-line)}
.lb-hero-centered .lb-hero-grid{grid-template-columns:1fr;text-align:center;justify-items:center}
.lb-hero-centered .lb-hero-sub{margin-left:auto;margin-right:auto}
.lb-hero-cover{position:relative;color:#fff;background-size:cover;background-position:center}
.lb-hero-cover::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,6,23,.62),rgba(2,6,23,.78))}
.lb-hero-cover .lb-wrap{position:relative}
.lb-hero-cover .lb-hero-grid{grid-template-columns:1fr;text-align:center;justify-items:center}
.lb-hero-cover .lb-hero-sub,.lb-hero-cover .lb-duration{color:rgba(255,255,255,.85)}
`;
}
function fontLink(st) {
  const pair = FONT_PAIRS.find((f) => f.id === st.fontPair) || FONT_PAIRS[0];
  if (!pair.google.length) return "";
  const fam = pair.google.map((g) => `family=${g}`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fam}&display=swap">`;
}
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function safeUrl(u) {
  const s = String(u ?? "").trim();
  if (/^https:\/\//i.test(s) || s.startsWith("/assets/")) return s;
  return "";
}
function primaryOf(branding) {
  const p = String(branding?.primary_color || "");
  return /^#[0-9a-fA-F]{6}$/.test(p) ? p : "#1d4ed8";
}
function secondaryOf(branding) {
  const p = String(branding?.secondary_color || "");
  return /^#[0-9a-fA-F]{6}$/.test(p) ? p : "#0f172a";
}
function applyPlaceholders(src, branding) {
  const b = branding || {};
  const map = {
    ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v ?? "")])),
    email: String(b.email || b.contact_email || ""),
    telefon: String(b.telefon || b.contact_phone || ""),
    firmenname: String(b.firmenname || ""),
    primary_color: primaryOf(b),
    secondary_color: secondaryOf(b)
  };
  let out = src;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  return out;
}
function lines(v) {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}
function objects(v) {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}
function renderHero(d) {
  const img = safeUrl(d.imageUrl);
  const cta = esc(d.ctaText || "Jetzt bewerben");
  const variant = ["split", "centered", "cover"].includes(String(d.variant)) ? String(d.variant) : "split";
  const cover = variant === "cover" && img;
  const cls = `lb-hero${cover ? " lb-hero-cover" : variant === "centered" ? " lb-hero-centered" : ""}`;
  const bgAttr = cover ? ` style="background-image:url('${esc(img)}')"` : "";
  const showImg = img && variant === "split";
  const belowImg = img && variant === "centered" ? `<div class="lb-hero-imgwrap"><img class="lb-hero-img" src="${esc(img)}" alt="" loading="eager"></div>` : "";
  return `<section class="${cls}"${bgAttr}>
  <div class="lb-wrap lb-hero-grid">
    <div>
      ${d.kicker ? `<span class="lb-kicker">${esc(d.kicker)}</span>` : ""}
      <h1 class="lb-hero-title">${esc(d.title)}</h1>
      ${d.subtitle ? `<p class="lb-hero-sub">${esc(d.subtitle)}</p>` : ""}
      <p class="lb-hero-cta">
        <a class="lb-btn" href="#bewerbung-form">${cta}</a>
        <span class="lb-duration">Bewerbung dauert ca. 2&nbsp;Minuten</span>
      </p>
    </div>
    ${showImg ? `<div class="lb-hero-imgwrap"><img class="lb-hero-img" src="${esc(img)}" alt="" loading="eager"></div>` : belowImg}
  </div>
</section>`;
}
function renderStelle(d) {
  const meta = [d.location, d.salary].filter(Boolean).map((x) => `<span class="lb-chip">${esc(x)}</span>`).join("");
  const tasks = lines(d.tasks).map((t) => `<li>${esc(t)}</li>`).join("");
  const reqs = lines(d.requirements).map((t) => `<li>${esc(t)}</li>`).join("");
  return `<section class="lb-section">
  <div class="lb-wrap">
    ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
    ${meta ? `<p class="lb-chips">${meta}</p>` : ""}
    ${d.intro ? `<p class="lb-lead">${esc(d.intro)}</p>` : ""}
    <div class="lb-cols">
      ${tasks ? `<div class="lb-card"><h3 class="lb-h3">Deine Aufgaben</h3><ul class="lb-list">${tasks}</ul></div>` : ""}
      ${reqs ? `<div class="lb-card"><h3 class="lb-h3">Das bringst du mit</h3><ul class="lb-list">${reqs}</ul></div>` : ""}
    </div>
    <p><a class="lb-btn" href="#bewerbung-form">Jetzt bewerben</a></p>
  </div>
</section>`;
}
function renderAblauf(d) {
  const steps = objects(d.steps).map((s, i) => `<li class="lb-step"><span class="lb-step-num">${i + 1}</span><div><h3 class="lb-h3">${esc(s.title)}</h3>${s.desc ? `<p class="lb-p">${esc(s.desc)}</p>` : ""}</div></li>`).join("");
  return `<section class="lb-section lb-alt">
  <div class="lb-wrap lb-narrow">
    ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
    <ol class="lb-steps">${steps}</ol>
  </div>
</section>`;
}
function renderFaq(d) {
  const items = objects(d.items).filter((it) => it.q).map((it) => `<details class="lb-faq-item"><summary>${esc(it.q)}</summary><p class="lb-p">${esc(it.a)}</p></details>`).join("");
  return `<section class="lb-section">
  <div class="lb-wrap lb-narrow">
    ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
    ${items}
  </div>
</section>`;
}
function renderLogos(d) {
  const items = objects(d.items).map((it) => {
    const img = safeUrl(it.img);
    if (!img) return "";
    return `<figure class="lb-logo"><img src="${esc(img)}" alt="${esc(it.label || "")}" loading="lazy"><figcaption>${esc(it.label || "")}</figcaption></figure>`;
  }).filter(Boolean).join("");
  if (!items) return "";
  return `<section class="lb-section lb-alt">
  <div class="lb-wrap">
    ${d.title ? `<h2 class="lb-h2 lb-center">${esc(d.title)}</h2>` : ""}
    <div class="lb-logos">${items}</div>
  </div>
</section>`;
}
function renderKontakt(d, branding) {
  const wa = branding?.whatsapp_enabled ? String(branding?.whatsapp_number || "").replace(/[^0-9]/g, "") : "";
  const phone = String(branding?.telefon || "").trim();
  const email = String(branding?.email || "").trim();
  const btns = [];
  if (d.showWhatsapp && wa) btns.push(`<a class="lb-btn" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">Per WhatsApp schreiben</a>`);
  if (d.showPhone && phone) btns.push(`<a class="lb-btn lb-btn-ghost" href="tel:${esc(phone.replace(/\s+/g, ""))}">${esc(phone)}</a>`);
  if (d.showEmail && email) btns.push(`<a class="lb-btn lb-btn-ghost" href="mailto:${esc(email)}">${esc(email)}</a>`);
  const person = d.name ? `<p class="lb-person"><strong>${esc(d.name)}</strong>${d.role ? `<br><span>${esc(d.role)}</span>` : ""}</p>` : "";
  return `<section class="lb-section">
  <div class="lb-wrap lb-narrow lb-center">
    ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
    ${person}
    ${d.text ? `<p class="lb-lead">${esc(d.text)}</p>` : ""}
    ${btns.length ? `<p class="lb-btnrow">${btns.join("")}</p>` : ""}
  </div>
</section>`;
}
function renderFreitext(d) {
  const paras = String(d.text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p class="lb-p">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<section class="lb-section">
  <div class="lb-wrap lb-narrow">
    ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
    ${paras}
  </div>
</section>`;
}
function renderBild(d) {
  const img = safeUrl(d.imageUrl);
  if (!img) return "";
  return `<section class="lb-section">
  <div class="lb-wrap">
    <figure class="lb-bild"><img src="${esc(img)}" alt="${esc(d.alt || "")}" loading="lazy">${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>
  </div>
</section>`;
}
function renderTextbild(d) {
  const img = safeUrl(d.imageUrl);
  const cta = d.ctaText ? `<p class="lb-tb-cta"><a class="lb-btn" href="#bewerbung-form">${esc(d.ctaText)}</a></p>` : "";
  if (!img && !d.title && !d.text) return "";
  const textCol = `<div class="lb-tb-text">
      ${d.kicker ? `<span class="lb-kicker">${esc(d.kicker)}</span>` : ""}
      ${d.title ? `<h2 class="lb-h2">${esc(d.title)}</h2>` : ""}
      ${d.text ? `<p class="lb-p">${esc(d.text).replace(/\n/g, "<br>")}</p>` : ""}
      ${cta}
    </div>`;
  const imgCol = img ? `<div class="lb-tb-img"><img src="${esc(img)}" alt="${esc(d.alt || "")}" loading="lazy"></div>` : "";
  return `<section class="lb-section">
  <div class="lb-wrap">
    <div class="lb-tb${d.imageRight ? " lb-tb-right" : ""}">
      ${textCol}
      ${imgCol}
    </div>
  </div>
</section>`;
}
function renderForm(branding) {
  return applyPlaceholders(form_section_default, branding);
}
var BASE_CSS = `
:root{--lb-primary:#1d4ed8;--lb-secondary:#0f172a;--lb-ink:#0f172a;--lb-muted:#475569;--lb-line:#e2e8f0;--lb-bg:#ffffff;}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--lb-bg);color:var(--lb-ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased;}
img{max-width:100%;height:auto;display:block}
a{color:var(--lb-primary)}
.lb-wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.lb-narrow{max-width:760px}
.lb-center{text-align:center}
.lb-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--lb-line);}
.lb-header-in{max-width:1080px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.lb-brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:17px;color:var(--lb-ink);text-decoration:none}
.lb-brand img{max-height:36px;width:auto}
.lb-header .lb-btn{padding:10px 20px;font-size:14px}
.lb-btn{display:inline-block;background:var(--lb-primary);color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;font-size:16px;transition:transform .15s,box-shadow .15s}
.lb-btn:hover{transform:translateY(-1px);box-shadow:0 10px 26px -10px var(--lb-primary);text-decoration:none}
.lb-btn-ghost{background:transparent;color:var(--lb-primary);border:2px solid var(--lb-primary)}
.lb-btnrow{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:18px}
.lb-duration{display:block;margin-top:10px;font-size:13px;color:var(--lb-muted)}
.lb-hero{padding:88px 0;background:linear-gradient(180deg,color-mix(in oklab,var(--lb-primary) 7%,#fff) 0%,#fff 100%)}
.lb-hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
@media(max-width:860px){.lb-hero-grid{grid-template-columns:1fr;gap:28px}.lb-hero{padding:56px 0}}
.lb-kicker{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--lb-primary);background:color-mix(in oklab,var(--lb-primary) 10%,transparent);padding:6px 12px;border-radius:999px;margin-bottom:16px}
.lb-hero-title{font-size:clamp(30px,4.6vw,50px);line-height:1.12;font-weight:800;letter-spacing:-.015em;margin:0 0 18px}
.lb-hero-sub{font-size:18px;color:var(--lb-muted);margin:0 0 26px;max-width:56ch}
.lb-hero-cta{margin:0}
.lb-hero-img{border-radius:18px;box-shadow:0 24px 60px -20px rgba(15,23,42,.25)}
.lb-section{padding:72px 0}
.lb-alt{background:#f8fafc}
.lb-h2{font-size:clamp(24px,3vw,34px);font-weight:800;letter-spacing:-.01em;margin:0 0 18px}
.lb-h3{font-size:17px;font-weight:700;margin:0 0 8px}
.lb-lead{font-size:17px;color:var(--lb-muted);margin:0 0 22px}
.lb-p{color:var(--lb-muted);margin:0 0 14px}
.lb-chips{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px;padding:0}
.lb-chip{display:inline-block;background:color-mix(in oklab,var(--lb-primary) 9%,#fff);color:var(--lb-ink);border:1px solid color-mix(in oklab,var(--lb-primary) 25%,var(--lb-line));font-size:14px;font-weight:600;padding:6px 14px;border-radius:999px}
.lb-cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:0 0 26px}
@media(max-width:760px){.lb-cols{grid-template-columns:1fr}}
.lb-card{background:#fff;border:1px solid var(--lb-line);border-radius:14px;padding:22px 24px}
.lb-list{margin:0;padding-left:20px;color:var(--lb-muted)}
.lb-list li{margin-bottom:8px}
.lb-steps{list-style:none;margin:0;padding:0;display:grid;gap:18px}
.lb-step{display:flex;gap:18px;align-items:flex-start;background:#fff;border:1px solid var(--lb-line);border-radius:14px;padding:20px 22px}
.lb-step-num{flex:0 0 auto;width:38px;height:38px;border-radius:50%;background:var(--lb-primary);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:17px}
.lb-faq-item{background:#fff;border:1px solid var(--lb-line);border-radius:12px;padding:16px 20px;margin-bottom:12px}
.lb-faq-item summary{font-weight:700;cursor:pointer;list-style:none}
.lb-faq-item summary::-webkit-details-marker{display:none}
.lb-faq-item summary::after{content:"+";float:right;color:var(--lb-primary);font-weight:800}
.lb-faq-item[open] summary::after{content:"\u2013"}
.lb-faq-item p{margin-top:10px}
.lb-logos{display:flex;flex-wrap:wrap;gap:28px;align-items:center;justify-content:center;margin-top:8px}
.lb-logo{margin:0;text-align:center}
.lb-logo img{max-height:52px;width:auto;filter:grayscale(15%)}
.lb-logo figcaption{font-size:12px;color:var(--lb-muted);margin-top:6px}
.lb-person{margin:0 0 10px;font-size:16px}
.lb-person span{color:var(--lb-muted);font-size:14px}
.lb-bild{margin:0}
.lb-bild img{border-radius:16px;width:100%}
.lb-bild figcaption{text-align:center;font-size:13px;color:var(--lb-muted);margin-top:10px}
.lb-tb{display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
.lb-tb-right .lb-tb-img{order:-1}
.lb-tb .lb-kicker{margin-bottom:14px}
.lb-tb-cta{margin-top:20px}
.lb-tb-img img{border-radius:18px;box-shadow:0 24px 60px -20px rgba(15,23,42,.25)}
@media(max-width:860px){.lb-tb{grid-template-columns:1fr;gap:26px}}
.lb-footer{background:var(--lb-secondary);color:#cbd5e1;padding:44px 20px;font-size:14px}
.lb-footer-in{max-width:1080px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px 28px;align-items:center;justify-content:space-between}
.lb-footer a{color:#e2e8f0;text-decoration:none}
.lb-footer a:hover{text-decoration:underline}
`;
var EDITOR_CSS = `
[data-lb-sec]{position:relative}
[data-lb-sec]:hover{outline:2px dashed rgba(37,99,235,.55);outline-offset:-2px}
[data-lb-sec].lb-ed-active{outline:2px solid #2563eb;outline-offset:-2px}
.lb-ed-bar{position:absolute;top:8px;right:8px;z-index:9999;display:none;gap:6px;background:#0f172a;border-radius:999px;padding:5px 8px;box-shadow:0 8px 24px -8px rgba(0,0,0,.5)}
[data-lb-sec]:hover>.lb-ed-bar,[data-lb-sec].lb-ed-active>.lb-ed-bar{display:flex}
.lb-ed-bar button{all:unset;cursor:pointer;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.12)}
.lb-ed-bar button:hover{background:#2563eb}
.lb-ed-bar .lb-ed-del:hover{background:#dc2626}
.lb-ed-label{position:absolute;top:8px;left:8px;z-index:9998;display:none;background:#2563eb;color:#fff;font:600 11px/1 system-ui,sans-serif;padding:5px 9px;border-radius:999px}
[data-lb-sec]:hover>.lb-ed-label,[data-lb-sec].lb-ed-active>.lb-ed-label{display:block}
.lb-ed-add{position:relative;height:0;z-index:9997}
.lb-ed-add button{all:unset;cursor:pointer;position:absolute;left:50%;top:-14px;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:#2563eb;color:#fff;font:700 17px/26px system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .15s;box-shadow:0 6px 18px -6px rgba(37,99,235,.9)}
.lb-ed-add:hover button,.lb-ed-add button:focus{opacity:1}
body.lb-ed-body a{pointer-events:none}
`;
var EDITOR_JS = `
(function(){
  function send(msg){ parent.postMessage(Object.assign({source:"lb-editor"},msg),"*"); }
  document.body.classList.add("lb-ed-body");
  document.addEventListener("click",function(e){
    var btn=e.target.closest("[data-lb-act]");
    if(btn){
      e.preventDefault(); e.stopPropagation();
      send({action:btn.getAttribute("data-lb-act"),id:btn.getAttribute("data-lb-id"),index:Number(btn.getAttribute("data-lb-index"))});
      return;
    }
    var sec=e.target.closest("[data-lb-sec]");
    if(sec){ e.preventDefault(); send({action:"select",id:sec.getAttribute("data-lb-sec")}); }
  },true);
  window.addEventListener("message",function(ev){
    var d=ev.data||{};
    if(d.source!=="lb-parent") return;
    document.querySelectorAll("[data-lb-sec]").forEach(function(el){ el.classList.remove("lb-ed-active"); });
    if(d.action==="highlight"&&d.id){
      var el=document.querySelector('[data-lb-sec="'+d.id+'"]');
      if(el){ el.classList.add("lb-ed-active"); el.scrollIntoView({behavior:"smooth",block:"center"}); }
    }
  });
})();
`;
function editorWrap(html, sec, index, total, label) {
  const id = esc(sec.id);
  const btn = (act, text, cls = "") => `<button type="button" class="${cls}" data-lb-act="${act}" data-lb-id="${id}" data-lb-index="${index}">${text}</button>`;
  const bar = `<div class="lb-ed-bar">
    ${btn("edit", "Bearbeiten")}
    ${index > 0 ? btn("up", "\u2191") : ""}
    ${index < total - 1 ? btn("down", "\u2193") : ""}
    ${btn("delete", "L\xF6schen", "lb-ed-del")}
  </div>`;
  const addBefore = `<div class="lb-ed-add">${btn("add", "+")}</div>`;
  return `${addBefore}<div data-lb-sec="${id}" data-lb-index="${index}"><div class="lb-ed-label">${esc(label)}</div>${bar}${html}</div>`;
}
function renderSectionsLanding(opts) {
  const branding = opts.branding || {};
  const firm = String(branding.firmenname || "");
  const primary = primaryOf(branding);
  const secondary = secondaryOf(branding);
  const host = String(opts.host || branding.landing_domain || "").replace(/^www\./, "");
  const editor = Boolean(opts.editor);
  const st = normalizeStyle(
    branding.style && typeof branding.style === "object" ? { primary, accent: secondary, ...branding.style } : { primary, accent: secondary }
  );
  const list = Array.isArray(opts.sections) ? opts.sections : [];
  const bodyParts = [];
  let hasForm = false;
  list.forEach((sec, i) => {
    const d = sec?.data || {};
    let html = "";
    switch (sec?.type) {
      case "hero":
        html = renderHero(d);
        break;
      case "stelle":
        html = renderStelle(d);
        break;
      case "ablauf":
        html = renderAblauf(d);
        break;
      case "faq":
        html = renderFaq(d);
        break;
      case "logos":
        html = renderLogos(d);
        break;
      case "kontakt":
        html = renderKontakt(d, branding);
        break;
      case "freitext":
        html = renderFreitext(d);
        break;
      case "bild":
        html = renderBild(d);
        break;
      case "textbild":
        html = renderTextbild(d);
        break;
      case "form":
        if (!hasForm) {
          html = renderForm(branding);
          hasForm = true;
        }
        break;
    }
    if (!html && editor) {
      const def = SECTION_CATALOG.find((x) => x.type === sec?.type);
      html = `<section class="lb-section"><div class="lb-wrap lb-center"><p class="lb-p">\u201E${esc(def?.label || sec?.type)}" ist noch leer \u2014 bitte Inhalte erg\xE4nzen.</p></div></section>`;
    }
    if (!html) return;
    if (editor) {
      const def = SECTION_CATALOG.find((x) => x.type === sec?.type);
      bodyParts.push(editorWrap(html, sec, i, list.length, def?.label || String(sec?.type || "")));
    } else {
      bodyParts.push(html);
    }
  });
  if (!hasForm && !editor) bodyParts.push(renderForm(branding));
  if (editor) {
    bodyParts.push(`<div class="lb-ed-add"><button type="button" data-lb-act="add" data-lb-id="" data-lb-index="${list.length}">+</button></div>`);
  }
  const brand = opts.logoUrl ? `<img src="/assets/logo" alt="${esc(firm)}">` : `<span>${esc(firm)}</span>`;
  const addr = [branding.strasse, [branding.plz, branding.stadt].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const title = String(branding.seo_title || firm || "Jetzt bewerben");
  const desc = String(branding.seo_description || "");
  const formCss = applyPlaceholders(form_section_default2, branding);
  const formJs = applyPlaceholders(form_section_default3, branding).replace(/<\/script/gi, "<\\/script");
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ""}
<meta property="og:title" content="${esc(title)}">
${desc ? `<meta property="og:description" content="${esc(desc)}">` : ""}
<meta property="og:type" content="website">
${host ? `<meta property="og:url" content="https://${esc(host)}">` : ""}
<meta name="twitter:card" content="summary">
${opts.faviconUrl ? `<link rel="icon" href="/assets/favicon">` : ""}
${fontLink(st)}
<style>
${BASE_CSS.replace(/#1d4ed8/g, primary).replace(/#0f172a/g, secondary)}
${styleCss(st)}
${formCss}
${editor ? EDITOR_CSS : ""}
</style>
</head>
<body>
<header class="lb-header"><div class="lb-header-in">
  <a class="lb-brand" href="/">${brand}</a>
  <a class="lb-btn" href="#bewerbung-form">Jetzt bewerben</a>
</div></header>
<main>
${bodyParts.join("\n")}
</main>
<footer class="lb-footer"><div class="lb-footer-in">
  <span>\xA9 ${(/* @__PURE__ */ new Date()).getFullYear()} ${esc(firm)}</span>
  ${addr ? `<span>${esc(addr)}</span>` : ""}
  <span><a href="/impressum.html">Impressum</a> &nbsp;\xB7&nbsp; <a href="/datenschutz.html">Datenschutz</a></span>
</div></footer>
${editor ? `<script>${EDITOR_JS}</script>` : `<script>${formJs}</script>`}
</body>
</html>`;
}
export {
  FONT_PAIRS,
  SECTION_CATALOG,
  SECTION_TEMPLATES,
  SECTION_TYPES,
  createSection,
  defaultSections,
  defaultStyle,
  normalizeStyle,
  randomStyle,
  renderSectionsLanding,
  sectionsFromTemplate
};
