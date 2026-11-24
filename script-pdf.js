/* 瀏覽器端產出話術稿美編 PDF（不送資料到伺服器）。依賴同目錄 vendor/html2canvas.min.js */
(function () {
  "use strict";

  var PAGE_W = 794;
  var PAGE_H = 1123;
  var PAD_X = 40;
  var LOGO_SRC = "assets/logo-tn826.png";

  function todayYMD() {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) {
      return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.html2canvas) return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("無法載入 PDF 元件")); };
      document.head.appendChild(s);
    });
  }

  function waitImages(root) {
    var imgs = root.querySelectorAll("img");
    var list = [];
    for (var i = 0; i < imgs.length; i++) {
      (function (img) {
        if (img.complete && img.naturalWidth) return;
        list.push(new Promise(function (res) {
          img.onload = function () { res(); };
          img.onerror = function () { img.style.visibility = "hidden"; res(); };
        }));
      })(imgs[i]);
    }
    return Promise.all(list);
  }

  function injectCss() {
    if (document.getElementById("script-pdf-style")) return;
    var css = [
      "#script-pdf-stage{position:fixed;left:0;top:0;z-index:2147483646;pointer-events:none;opacity:1;}",
      ".sp-page{width:" + PAGE_W + "px;height:" + PAGE_H + "px;background:#F7FBFE;color:#14324A;",
      "font-family:\"Noto Sans TC\",\"PingFang TC\",\"Microsoft JhengHei\",sans-serif;position:relative;overflow:hidden;box-sizing:border-box;}",
      ".sp-bar{height:8px;background:linear-gradient(90deg,#0E4E7A 0%,#1A73B0 55%,#2B86C4 100%);}",
      ".sp-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px " + PAD_X + "px 12px;}",
      ".sp-header.compact{padding:12px " + PAD_X + "px 8px;}",
      ".sp-titles{min-width:0;flex:1;}",
      ".sp-kicker{margin:0 0 2px;font-size:11px;letter-spacing:0.14em;color:#1A73B0;font-weight:700;}",
      ".sp-title{margin:0;font-family:\"Noto Serif TC\",\"Noto Sans TC\",serif;font-weight:700;font-size:24px;letter-spacing:0.08em;color:#0A3656;line-height:1.35;}",
      ".sp-header.compact .sp-title{font-size:16px;letter-spacing:0.06em;}",
      ".sp-case{margin:6px 0 0;font-size:13px;letter-spacing:0.06em;color:#1A73B0;}",
      ".sp-logo{width:68px;height:68px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 4px 12px rgba(14,78,122,0.16);background:#fff;}",
      ".sp-header.compact .sp-logo{width:44px;height:44px;}",
      ".sp-rule{height:1px;background:#CDE3F0;margin:0 " + PAD_X + "px;}",
      ".sp-body{padding:14px " + PAD_X + "px 0;box-sizing:border-box;}",
      ".sp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 10px;margin:0 0 14px;}",
      ".sp-card{background:#fff;border:1px solid #B7D8EE;border-radius:12px;padding:10px 12px 11px;box-shadow:0 4px 12px rgba(14,78,122,0.06);}",
      ".sp-card-label{font-size:11px;font-weight:700;letter-spacing:0.08em;color:#1A73B0;line-height:1.3;}",
      ".sp-card-value{margin:4px 0 0;font-family:\"Noto Serif TC\",\"Noto Sans TC\",serif;font-weight:700;font-size:16px;color:#0E4E7A;line-height:1.35;word-break:break-word;}",
      ".sp-sec{margin:10px 0 6px;padding:0 0 4px;font-weight:700;font-size:14px;letter-spacing:0.08em;color:#0E4E7A;border-bottom:1px solid #CDE3F0;}",
      ".sp-line{margin:0 0 6px;border-radius:10px;padding:8px 12px;font-size:13px;line-height:1.75;box-sizing:border-box;}",
      ".sp-line.biz{background:#E8F4FB;border-left:3px solid #1A73B0;}",
      ".sp-line.cli{background:#F3F6F8;border-left:3px solid #8AA4B5;}",
      ".sp-who{display:inline-block;font-weight:700;margin-right:6px;letter-spacing:0.06em;}",
      ".sp-line.biz .sp-who{color:#0E4E7A;}",
      ".sp-line.cli .sp-who{color:#4E6E85;}",
      ".sp-disc{margin:12px 0 0;font-size:10px;line-height:1.6;color:#4E6E85;}",
      ".sp-footer{position:absolute;left:" + PAD_X + "px;right:" + PAD_X + "px;bottom:0;height:72px;border-top:1px solid #CDE3F0;display:flex;align-items:center;justify-content:space-between;gap:12px;}",
      ".sp-foot-left{min-width:0;}",
      ".sp-foot-office{margin:0;font-size:12px;font-weight:700;color:#0E4E7A;letter-spacing:0.04em;}",
      ".sp-foot-slogan{margin:2px 0 0;font-size:11px;color:#1A73B0;letter-spacing:0.08em;}",
      ".sp-foot-right{text-align:right;font-size:10px;color:#4E6E85;line-height:1.55;white-space:nowrap;}"
    ].join("");
    var el = document.createElement("style");
    el.id = "script-pdf-style";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function makePage(compact) {
    var page = document.createElement("div");
    page.className = "sp-page";
    page.innerHTML =
      '<div class="sp-bar"></div>' +
      '<div class="sp-header' + (compact ? " compact" : "") + '">' +
        '<div class="sp-titles">' +
          (compact ? "" : '<p class="sp-kicker">南恩通訊處 TN826　話術稿</p>') +
          '<h1 class="sp-title"></h1>' +
          (compact ? "" : '<p class="sp-case"></p>') +
        "</div>" +
        '<img class="sp-logo" alt="大心 TN826" width="' + (compact ? 44 : 68) + '" height="' + (compact ? 44 : 68) + '">' +
      "</div>" +
      '<div class="sp-rule"></div>' +
      '<div class="sp-body"></div>' +
      '<div class="sp-footer">' +
        '<div class="sp-foot-left">' +
          '<p class="sp-foot-office">南恩通訊處 TN826</p>' +
          '<p class="sp-foot-slogan">台南最大心，服務最用心</p>' +
        "</div>" +
        '<div class="sp-foot-right"></div>' +
      "</div>";
    return page;
  }

  function fillHeader(page, opts, compact) {
    page.querySelector(".sp-title").textContent = compact ? (opts.pageTitle + "（續）") : opts.pageTitle;
    if (!compact) {
      var c = page.querySelector(".sp-case");
      if (c) c.textContent = opts.caseName || "";
    }
    var img = page.querySelector(".sp-logo");
    img.src = opts.logoSrc || LOGO_SRC;
    img.onerror = function () { img.style.display = "none"; };
  }

  function makeCards(cards) {
    var wrap = document.createElement("div");
    wrap.className = "sp-cards";
    (cards || []).forEach(function (c) {
      var d = document.createElement("div");
      d.className = "sp-card";
      var l = document.createElement("div");
      l.className = "sp-card-label";
      l.textContent = c.label || "";
      var v = document.createElement("div");
      v.className = "sp-card-value";
      v.textContent = c.value || "—";
      d.appendChild(l);
      d.appendChild(v);
      wrap.appendChild(d);
    });
    return wrap;
  }

  function makeSec(text) {
    var p = document.createElement("div");
    p.className = "sp-sec";
    p.textContent = text;
    return p;
  }

  function makeLine(who, text) {
    var p = document.createElement("div");
    p.className = "sp-line " + (who === "業務" ? "biz" : "cli");
    var w = document.createElement("span");
    w.className = "sp-who";
    w.textContent = who;
    p.appendChild(w);
    p.appendChild(document.createTextNode(text || ""));
    return p;
  }

  function measureH(el) {
    return el.getBoundingClientRect().height;
  }

  function splitTextToFit(who, text, maxH, body) {
    if (!text || maxH < 36) return { fit: "", rest: text };
    var probe = makeLine(who, text);
    body.appendChild(probe);
    if (measureH(probe) <= maxH + 0.5) {
      body.removeChild(probe);
      return { fit: text, rest: "" };
    }
    body.removeChild(probe);
    var lo = 0, hi = text.length, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var chunk = cutAtBreak(text, mid);
      if (!chunk) { lo = mid + 1; continue; }
      probe = makeLine(who, chunk);
      body.appendChild(probe);
      var h = measureH(probe);
      body.removeChild(probe);
      if (h <= maxH + 0.5) { best = chunk.length; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (best < 8) return { fit: "", rest: text };
    var fit = cutAtBreak(text, best);
    var rest = text.slice(fit.length).replace(/^[，、。；：,.!\s]+/, "");
    return { fit: fit, rest: rest };
  }

  function cutAtBreak(text, n) {
    if (n >= text.length) return text;
    if (n < 8) return "";
    var slice = text.slice(0, n);
    var marks = "。！？；!?;，、, ";
    for (var i = slice.length - 1; i >= Math.max(8, slice.length - 24); i--) {
      if (marks.indexOf(slice.charAt(i)) >= 0) return slice.slice(0, i + 1);
    }
    return slice;
  }

  function bodyMax(page) {
    var header = page.querySelector(".sp-header");
    var footer = page.querySelector(".sp-footer");
    var bar = page.querySelector(".sp-bar");
    var used = (bar ? measureH(bar) : 8) + measureH(header) + 1 + 14 + measureH(footer);
    return PAGE_H - used - 8;
  }

  function buildPages(opts) {
    var stage = document.createElement("div");
    stage.id = "script-pdf-stage";
    document.body.appendChild(stage);

    var pages = [];
    var date = opts.date || todayYMD();

    function newPage(compact) {
      var page = makePage(compact);
      fillHeader(page, opts, compact);
      stage.appendChild(page);
      pages.push(page);
      return page;
    }

    var page = newPage(false);
    var body = page.querySelector(".sp-body");
    var max = bodyMax(page);
    var used = 0;

    if (opts.cards && opts.cards.length) {
      var cards = makeCards(opts.cards);
      body.appendChild(cards);
      used += measureH(cards) + 14;
    }

    var parts = (opts.parts || []).slice();
    var i = 0;
    while (i < parts.length) {
      var p = parts[i];
      var remaining = max - used;
      var el, h;

      if (p.sec) {
        el = makeSec(p.sec);
        body.appendChild(el);
        h = measureH(el);
        if (h + 36 > remaining && used > 0) {
          body.removeChild(el);
          page = newPage(true);
          body = page.querySelector(".sp-body");
          max = bodyMax(page);
          used = 0;
          continue;
        }
        used += h;
        i++;
        continue;
      }

      var who = p.who || "業務";
      var text = p.text || "";
      if (remaining < 40 && used > 0) {
        page = newPage(true);
        body = page.querySelector(".sp-body");
        max = bodyMax(page);
        used = 0;
        remaining = max;
      }
      var split = splitTextToFit(who, text, remaining, body);
      if (!split.fit) {
        if (used > 0) {
          page = newPage(true);
          body = page.querySelector(".sp-body");
          max = bodyMax(page);
          used = 0;
          continue;
        }
        split = { fit: text, rest: "" };
      }
      el = makeLine(who, split.fit);
      body.appendChild(el);
      used += measureH(el) + 6;
      if (split.rest) {
        parts[i] = { who: who, text: split.rest };
        continue;
      }
      i++;
    }

    if (opts.disclaimer) {
      var disc = document.createElement("p");
      disc.className = "sp-disc";
      disc.textContent = opts.disclaimer;
      body.appendChild(disc);
      if (used + measureH(disc) + 8 > max && pages.length) {
        body.removeChild(disc);
        page = newPage(true);
        body = page.querySelector(".sp-body");
        body.appendChild(disc);
      }
    }

    var total = pages.length;
    pages.forEach(function (pg, idx) {
      pg.querySelector(".sp-foot-right").innerHTML =
        "產出日期：" + date + "<br>第 " + (idx + 1) + " / " + total + " 頁";
    });

    return { stage: stage, pages: pages };
  }

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) s = "0" + s;
    return s;
  }

  function str(s) { return new TextEncoder().encode(s); }

  function concat(parts) {
    var n = 0, i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }

  function buildPdf(jpegs) {
    var W = "595.28", H = "841.89";
    var parts = [];
    var xref = [0];
    var pos = 0;
    function push(bytes) {
      if (typeof bytes === "string") bytes = str(bytes);
      parts.push(bytes);
      pos += bytes.length;
    }
    function obj(bodyBytes) {
      xref.push(pos);
      push(bodyBytes);
    }
    push("%PDF-1.4\n%\x80\x80\x80\x80\n");
    var nPages = jpegs.length;
    var pageObj = [];
    var imgObj = [];
    var contentObj = [];
    var start = 3;
    for (var i = 0; i < nPages; i++) {
      pageObj[i] = start + i * 3;
      imgObj[i] = start + i * 3 + 1;
      contentObj[i] = start + i * 3 + 2;
    }
    var pagesId = 2;
    var catalogId = 1;

    obj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    var kids = pageObj.map(function (id) { return id + " 0 R"; }).join(" ");
    obj("2 0 obj\n<< /Type /Pages /Kids [" + kids + "] /Count " + nPages + " >>\nendobj\n");

    for (i = 0; i < nPages; i++) {
      obj(pageObj[i] + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /XObject << /Im" + i + " " + imgObj[i] + " 0 R >> >> /Contents " + contentObj[i] + " 0 R >>\nendobj\n");
      var jpg = jpegs[i];
      var header = imgObj[i] + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + jpg.w + " /Height " + jpg.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpg.bytes.length + " >>\nstream\n";
      xref.push(pos);
      push(header);
      push(jpg.bytes);
      push("\nendstream\nendobj\n");
      var content = "q\n" + W + " 0 0 " + H + " 0 0 cm\n/Im" + i + " Do\nQ\n";
      obj(contentObj[i] + " 0 obj\n<< /Length " + content.length + " >>\nstream\n" + content + "endstream\nendobj\n");
    }

    var xrefPos = pos;
    var count = xref.length;
    push("xref\n0 " + count + "\n");
    push("0000000000 65535 f \n");
    for (i = 1; i < count; i++) push(pad(xref[i], 10) + " 00000 n \n");
    push("trailer\n<< /Size " + count + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF\n");
    return concat(parts);
  }

  function canvasToJpeg(canvas, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) return reject(new Error("無法輸出圖檔"));
        var fr = new FileReader();
        fr.onload = function () {
          resolve({ bytes: new Uint8Array(fr.result), w: canvas.width, h: canvas.height });
        };
        fr.onerror = reject;
        fr.readAsArrayBuffer(blob);
      }, "image/jpeg", quality || 0.92);
    });
  }

  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  async function saveBlob(blob, filename) {
    var file = new File([blob], filename, { type: "application/pdf" });
    if (isIOS() && navigator.canShare) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    var url = URL.createObjectURL(blob);
    if (isIOS()) {
      var w = window.open(url, "_blank");
      if (!w) location.href = url;
      return;
    }
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
  }

  async function download(opts, btn) {
    if (!opts || !opts.parts || !opts.parts.length) return;
    var label = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "產出中…";
    }
    var built = null;
    try {
      await loadScript("vendor/html2canvas.min.js");
      if (!window.html2canvas) throw new Error("html2canvas 未載入");
      if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) {}
      }
      injectCss();
      built = buildPages(opts);
      await waitImages(built.stage);
      await new Promise(function (r) { setTimeout(r, 80); });

      var jpegs = [];
      for (var i = 0; i < built.pages.length; i++) {
        var canvas = await window.html2canvas(built.pages[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#F7FBFE",
          width: PAGE_W,
          height: PAGE_H,
          logging: false
        });
        jpegs.push(await canvasToJpeg(canvas, 0.92));
      }
      var pdf = buildPdf(jpegs);
      var filename = (opts.fileStem || "話術稿") + "_" + todayYMD() + ".pdf";
      var blob = new Blob([pdf], { type: "application/pdf" });
      await saveBlob(blob, filename);
      if (btn) {
        btn.textContent = "已下載";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = label || "下載話術 PDF";
          btn.classList.remove("copied");
          btn.disabled = false;
        }, 1600);
      }
    } catch (err) {
      console.error(err);
      if (btn) {
        btn.textContent = label || "下載話術 PDF";
        btn.disabled = false;
      }
      alert("PDF 產出失敗，請再試一次。");
    } finally {
      if (built && built.stage && built.stage.parentNode) built.stage.parentNode.removeChild(built.stage);
    }
  }

  window.ScriptPdf = { download: download, todayYMD: todayYMD };
})();
