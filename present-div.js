/* 小資互動版畫面（dividend.html 專用）：給客戶看的全螢幕引導式展示。
   數字全部來自小資頁的試算（window.DIV_MODEL，由 dividend.html 的 updateScript 產生），
   滑桿直接改小資頁欄位並觸發原本的 recalc，兩邊數字永遠一致。
   分頁依小資話術稿：起點（年輕的時間）→ 滾雪球（每 5 年）→ 65 歲現金流 → 階梯式推進。
   圖表小工具與樣式沿用 present.js／present.css 的同一套（此檔不影響 index.html）。 */
(function () {
  "use strict";
  if (!document.getElementById("open-present")) return;

  var C = { blue: "#1A73B0", soft: "#2B86C4", deep: "#0E4E7A", dark: "#0A3656", sky: "#D4EBF7", sky2: "#B7D8EE",
    pale: "#E8F4FB", green: "#1E7A4A", red: "#B42318", gold: "#E3A72F", muted: "#4E6E85", grid: "#E1EEF6" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function yuan(v) { return Math.round(v).toLocaleString("zh-TW") + " 元"; }
  function yuanShort(v) { return Math.round(v).toLocaleString("zh-TW"); }
  function wan(v) { return fmtWanBare(v); }                 // 主頁同一支格式函式
  function pct(v) { return String(parseFloat(Number(v).toFixed(4))) + "%"; }
  function wanNum(v) { var r = Math.round(v * 10) / 10; return r.toLocaleString("zh-TW", Number.isInteger(r) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }


  /* ---------- 主頁欄位存取 ---------- */
  function mainEl(id) { return document.getElementById(id); }
  function mainVal(id) { var el = mainEl(id); return el ? parseFloat(el.value) : NaN; }
  function setMain(id, v, ev) {
    var el = mainEl(id); if (!el) return;
    el.value = String(v);
    el.dispatchEvent(new Event(ev || "input", { bubbles: true }));
  }

  /* ---------- 滑桿設定（id 為小資頁欄位） ---------- */
  var SL = {
    principal: { id: "principal", lab: "投入本金", min: 1, max: 500, step: 1, f: function (v) { return wanNum(v) + " 萬"; } },
    rate: { id: "rate", lab: "每年配息率", min: 0, max: 15, step: 0.5, f: function (v) { return pct(v); } },
    age: { id: "age", lab: "起始年紀", min: 18, max: 65, step: 1, f: function (v) { return Math.round(v) + " 歲"; } },
    fee: { id: "fee", lab: "回存手續費", min: 0, max: 10, step: 0.5, f: function (v) { return pct(v); } }
  };
  function sliderHtml(key) {
    var s = SL[key];
    return '<div class="pv-sl" data-sl="' + key + '"><div class="pv-sl-top"><span class="pv-sl-lab">' + esc(s.lab) + '</span><span class="pv-sl-val"></span></div>' +
      '<div class="pv-sl-row"><button type="button" class="pv-pm" data-pm="-1" aria-label="減少">−</button>' +
      '<input type="range" aria-label="' + esc(s.lab) + '"><button type="button" class="pv-pm" data-pm="1" aria-label="增加">＋</button></div></div>';
  }
  function ctrlCard(inner) { return '<aside class="pv-ctrl"><div class="pv-card"><h3>當場調整</h3>' + inner + "</div></aside>"; }
  /* ---------- 小型 SVG 圖表 ---------- */
  function vbars(items, o) {
    o = o || {};
    var W = 560, H = o.h || 300, top = 40, bot = 56, n = items.length, gap = W / n;
    var max = Math.max.apply(null, items.map(function (i) { return i.v; }).concat([1])) * 1.08;
    var bw = Math.min(110, gap * 0.56), s = '<svg class="pv-svg" viewBox="0 0 ' + W + " " + H + '" role="img">';
    s += '<line x1="20" x2="' + (W - 20) + '" y1="' + (H - bot) + '" y2="' + (H - bot) + '" stroke="' + C.sky2 + '" stroke-width="2"/>';
    items.forEach(function (it, i) {
      var h = Math.max(2, (H - top - bot) * it.v / max), x = gap * i + (gap - bw) / 2, y = H - bot - h;
      s += '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + h + '" rx="10" fill="' + it.c + '"/>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (y - 10) + '" text-anchor="middle" font-size="' + (o.fs || (n > 5 ? 15 : 22)) + '" font-weight="700" fill="' + C.dark + '">' + esc(it.t) + "</text>";
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - bot + 26) + '" text-anchor="middle" font-size="' + (n > 5 ? 15 : 18) + '" font-weight="700" fill="' + C.deep + '">' + esc(it.l) + "</text>";
      if (it.l2) s += '<text x="' + (x + bw / 2) + '" y="' + (H - bot + 47) + '" text-anchor="middle" font-size="15" fill="' + C.muted + '">' + esc(it.l2) + "</text>";
    });
    return s + "</svg>";
  }
  function donut(segs, center, sub) {
    var W = 320, R = 120, r = 74, cx = 160, cy = 150, tot = 0, a0 = -Math.PI / 2, s = '<svg class="pv-svg" viewBox="0 0 ' + W + ' 300" role="img">';
    segs.forEach(function (g) { tot += Math.max(0, g.v); });
    if (tot <= 0) tot = 1;
    segs.forEach(function (g) {
      var v = Math.max(0, g.v); if (v <= 0) return;
      var a1 = a0 + 2 * Math.PI * v / tot; if (a1 - a0 >= 2 * Math.PI - 1e-6) a1 = a0 + 2 * Math.PI - 1e-4;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + " " + (cy + rad * Math.sin(a)).toFixed(2); };
      s += '<path d="M' + p(R, a0) + " A" + R + " " + R + " 0 " + large + " 1 " + p(R, a1) + " L" + p(r, a1) + " A" + r + " " + r + " 0 " + large + " 0 " + p(r, a0) + 'Z" fill="' + g.c + '" stroke="#fff" stroke-width="3"/>';
      var am = (a0 + a1) / 2, share = v / tot;
      if (share > 0.06) s += '<text x="' + (cx + (R + r) / 2 * Math.cos(am)) + '" y="' + (cy + (R + r) / 2 * Math.sin(am) + 6) + '" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">' + Math.round(share * 100) + "%</text>";
      a0 = a1;
    });
    s += '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="26" font-weight="700" fill="' + C.dark + '">' + esc(center) + "</text>";
    if (sub) s += '<text x="' + cx + '" y="' + (cy + 24) + '" text-anchor="middle" font-size="15" fill="' + C.muted + '">' + esc(sub) + "</text>";
    return s + "</svg>";
  }
  function legend(segs) {
    return '<div style="display:flex;flex-direction:column;gap:8px">' + segs.map(function (g) {
      return '<div style="display:flex;align-items:center;gap:10px;font-size:1.05rem"><span style="width:16px;height:16px;border-radius:5px;background:' + g.c + ';flex:0 0 auto"></span><span style="flex:1;color:' + C.deep + '">' + esc(g.l) + '</span><b style="font-size:1.2rem;color:' + C.dark + ';white-space:nowrap">' + esc(g.t) + "</b></div>";
    }).join("") + "</div>";
  }
  function hstack(total, segs, label) {
    var W = 640, H = 120, x0 = 10, w = W - 20, s = '<svg class="pv-svg" viewBox="0 0 ' + W + " " + H + '" role="img">', x = x0;
    s += '<rect x="' + x0 + '" y="30" width="' + w + '" height="56" rx="14" fill="' + C.pale + '"/>';
    segs.forEach(function (g) {
      var gw = w * Math.max(0, g.v) / total; if (gw <= 0) return;
      s += '<rect x="' + x + '" y="30" width="' + gw + '" height="56" rx="14" fill="' + g.c + '"/>';
      if (gw > 120) s += '<text x="' + (x + gw / 2) + '" y="65" text-anchor="middle" font-size="20" font-weight="700" fill="' + (g.tc || "#fff") + '">' + esc(g.t) + "</text>";
      x += gw;
    });
    s += '<text x="' + x0 + '" y="20" font-size="17" fill="' + C.muted + '">' + esc(label) + "</text>";
    return s + "</svg>";
  }
  function lineChart(xs, series, o) {
    o = o || {};
    var W = 640, H = o.h || 300, L = 64, R = 18, T = 20, B = 44, max = 1;
    series.forEach(function (sr) { sr.v.forEach(function (v) { if (v != null && v > max) max = v; }); });
    max *= 1.1;
    var n = xs.length, X = function (i) { return L + (W - L - R) * (n <= 1 ? 0 : i / (n - 1)); }, Y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var s = '<svg class="pv-svg" viewBox="0 0 ' + W + " " + H + '" role="img">';
    for (var g = 0; g <= 4; g++) {
      var gv = max / 4 * g, gy = Y(gv);
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '" stroke="' + C.grid + '"/>';
      s += '<text x="' + (L - 8) + '" y="' + (gy + 5) + '" text-anchor="end" font-size="14" fill="' + C.muted + '">' + Math.round(gv / 10000).toLocaleString("zh-TW") + "萬</text>";
    }
    var stepX = Math.max(1, Math.ceil(n / 8));
    xs.forEach(function (x, i) { if (i % stepX === 0 || i === n - 1) s += '<text x="' + X(i) + '" y="' + (H - B + 22) + '" text-anchor="middle" font-size="14" fill="' + C.muted + '">' + esc(x) + "</text>"; });
    if (o.xlab) s += '<text x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end" font-size="13" fill="' + C.muted + '">' + esc(o.xlab) + "</text>";
    if (o.mark != null && o.mark >= 0) {
      var mx = X(o.mark);
      s += '<line x1="' + mx + '" x2="' + mx + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + C.gold + '" stroke-width="2" stroke-dasharray="6 5"/>';
      s += '<text x="' + Math.min(mx + 6, W - 180) + '" y="' + (T + 16) + '" font-size="15" font-weight="700" fill="#9A6B00">' + esc(o.markLab || "") + "</text>";
    }
    series.forEach(function (sr) {
      var d = "", started = false, area = "";
      sr.v.forEach(function (v, i) { if (v == null) return; d += (started ? " L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); started = true; });
      if (!d) return;
      if (sr.fill) { area = d + " L" + X(n - 1) + " " + Y(0) + " L" + X(0) + " " + Y(0) + "Z"; s += '<path d="' + area + '" fill="' + sr.fill + '"/>'; }
      s += '<path d="' + d + '" fill="none" stroke="' + sr.c + '" stroke-width="' + (sr.w || 4) + '" stroke-linejoin="round" stroke-linecap="round"' + (sr.dash ? ' stroke-dasharray="' + sr.dash + '"' : "") + "/>";
    });
    return s + "</svg>";
  }
  function keyRow(series) {
    return '<div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:4px;font-size:.98rem">' + series.map(function (s) {
      return '<span style="display:inline-flex;align-items:center;gap:6px;color:' + C.deep + '"><span style="width:22px;height:5px;border-radius:3px;background:' + s.c + '"></span>' + esc(s.l) + "</span>";
    }).join("") + "</div>";
  }
  function stat(k, v, unit, cls) { return '<div class="pv-stat ' + (cls || "") + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + (unit ? "<small>" + esc(unit) + "</small>" : "") + "</div></div>"; }


  /* ---------- 頁面骨架（依小資話術稿：滾雪球 → 階梯式推進） ---------- */
  var PAGES = [
    { tab: "起點", sliders: "{principal}{age}" },
    { tab: "滾雪球", sliders: "{rate}{fee}" },
    { tab: "65歲", sliders: "{age}{rate}" },
    { tab: "下一步", sliders: "{principal}{rate}" }
  ];
  function expandSliders(t) { return t.replace(/\{(\w+)\}/g, function (_, k) { return sliderHtml(k); }); }
  var root = document.createElement("div");
  root.className = "pv"; root.id = "pv"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "小資退休互動畫面");
  root.innerHTML =
    '<header class="pv-top"><div class="pv-brand">小資也能輕鬆退休</div><nav class="pv-tabs" role="tablist">' +
    PAGES.map(function (p, i) { return '<button type="button" class="pv-tab" role="tab" data-go="' + i + '"><span class="n">' + (i + 1) + "</span>" + p.tab + "</button>"; }).join("") +
    '</nav><div class="pv-actions"><button type="button" class="pv-btn ghost" id="pv-undo" title="把數字還原成打開互動版之前">還原數字</button><button type="button" class="pv-btn primary" id="pv-close">回到試算</button></div></header>' +
    '<main class="pv-stage" id="pv-stage">' +
    PAGES.map(function (p, i) {
      return '<section class="pv-page" data-page="' + i + '"><p class="pv-step">STEP ' + (i + 1) + "・" + p.tab + '</p><h2 class="pv-title" data-slot="title"></h2>' +
        '<div class="pv-ask" data-slot="ask"></div><div class="pv-grid"><div data-slot="viz"></div>' + ctrlCard(expandSliders(p.sliders)) + "</div>" +
        '<details class="pv-cue"><summary>業務提詞（客戶畫面可收起）</summary><div class="cue-tools"><label class="oral-switch" title="話術改用好念的整數與短句；畫面數字仍為精確數字"><input type="checkbox" data-pv-oral><span class="oral-track" aria-hidden="true"></span><span class="oral-text">口語版</span></label></div><div class="cue-b" data-slot="cue"></div></details></section>';
    }).join("") +
    '<p class="pv-disc">配息率為試算假設數字，配息不保證且可能來自本金；推算已計入回存手續費，未計匯率、稅費與淨值波動。定存以 1.5% 對照試算。實際以商品公告為準。</p></main>' +
    '<footer class="pv-foot"><button type="button" class="pv-btn ghost" id="pv-prev">‹ 上一步</button><div class="pv-dots" id="pv-dots">' +
    PAGES.map(function () { return "<span></span>"; }).join("") + '</div><button type="button" class="pv-btn primary" id="pv-next">下一步 ›</button></footer>';
  document.body.appendChild(root);

  var cur = 0, snapshot = null, dragging = null;
  function slot(i, name) { return root.querySelector('.pv-page[data-page="' + i + '"] [data-slot="' + name + '"]'); }
  function asks(list) { return list.map(function (q, i) { return '<div class="pv-q"><span class="qi">問' + (i + 1) + "</span><span>" + esc(q) + "</span></div>"; }).join(""); }

  /* 小資頁話術稿（與主頁同一份 lastScriptParts／lastScriptPartsOral），依段落與句子切給各頁提詞 */
  function scriptParts() {
    var oral = window.McScriptOral && McScriptOral.isOn() && typeof lastScriptPartsOral !== "undefined" && lastScriptPartsOral.length;
    return oral ? lastScriptPartsOral : (typeof lastScriptParts !== "undefined" ? lastScriptParts : []);
  }
  function splitScript() {
    var exact = typeof lastScriptParts !== "undefined" ? lastScriptParts : [], shown = scriptParts();
    var g = { intro: [], walk: [], peak: [], ladder: [] }, secIdx = -1, secName = ["", ""];
    exact.forEach(function (p, i) {
      var q = shown[i] || p;
      if (p.sec) { secIdx++; secName[secIdx] = q.sec; return; }
      if (secIdx >= 1) { g.ladder.push(q); return; }
      var t = p.text || "";
      if (t.indexOf("巴菲特") >= 0 || t.indexOf("一路滾到") >= 0) g.peak.push(q);
      else if (/^這.*配息不花掉/.test(t)) g.walk.push(q);
      else g.intro.push(q);
    });
    g.sec1 = secName[0]; g.sec2 = secName[1];
    return g;
  }
  function cueHtml(sec, parts) {
    if (!parts || !parts.length) return "<p>（此情境沒有對應話術）</p>";
    return (sec ? '<p class="sec">' + esc(sec) + "</p>" : "") + parts.map(function (p) {
      return '<p class="' + (p.who === "業務" ? "biz" : "cli") + '"><span class="who">' + esc(p.who) + "</span>" + esc(p.text) + "</p>";
    }).join("");
  }

  /* ---------- 繪製 ---------- */
  function render() {
    if (root.hidden) return;
    var m = window.DIV_MODEL;
    syncControls();
    if (!m) {
      for (var i = 0; i < PAGES.length; i++) {
        slot(i, "title").textContent = "請先輸入本金、配息率、年紀與回存手續費";
        slot(i, "ask").innerHTML = ""; slot(i, "viz").innerHTML = '<div class="pv-card pv-empty">數字不完整，請用右側滑桿或回到試算頁補齊。</div>';
        slot(i, "cue").innerHTML = "";
      }
      return;
    }
    var g = splitScript(), prinS = m.prinS, rateS = m.rateS, n = m.yearsTo65, a65 = m.at65;
    var dPct = pct(m.depositPct), spanS = m.firstSpan + " 年";

    /* 1 起點：你贏在有年輕的時間 */
    slot(0, "title").innerHTML = m.startAge + " 歲、" + esc(prinS) + "，<br>你贏在有<em>年輕的時間</em>";
    slot(0, "ask").innerHTML = asks(n > 0
      ? ["如果這 " + prinS + "放定存 " + dPct + "，" + n + " 年下來利息有多少？", "同樣 " + prinS + "放一個 " + rateS + " 配息的標的，一年配多少？"]
      : ["現在 65 歲，這 " + prinS + "放定存 " + dPct + "，一年利息有多少？", "放一個 " + rateS + " 配息的標的，一年配多少？"]);
    slot(0, "viz").innerHTML =
      '<div class="pv-card"><h3>同樣 ' + esc(prinS) + "，一年領多少</h3>" +
      vbars([{ v: m.depoYearly, c: "#7FA9C6", t: yuan(m.depoYearly), l: "放定存", l2: dPct },
             { v: m.yearly[0].yearly, c: C.blue, t: yuan(m.yearly[0].yearly), l: "配息標的", l2: rateS }]) +
      '<div class="pv-stats" style="margin-top:8px">' + stat("起始年紀", String(m.startAge), "歲") + stat("離 65 歲還有", String(n), "年", "hl") +
      (n > 0 ? stat("第一個 " + spanS + "累積配息", wanNum(m.firstFive / 10000), "萬") : stat("每月配息", yuanShort(a65.monthly), "元")) + "</div>" +
      '<p class="pv-big">' + (n > 0 ? "時間站在你這邊：還有 <em>" + n + " 年</em>可以滾雪球" : "從今天開始，每年配 <em>" + esc(yuan(a65.yearly)) + "</em>") + "</p></div>";
    slot(0, "cue").innerHTML = cueHtml(g.sec1, g.intro);

    /* 2 滾雪球：配息不花掉，再滾進本金 */
    var mid = m.mid;
    if (n > 0 && mid.length) {
      var m1 = mid[1] || null;
      slot(1, "title").innerHTML = "配息不花掉，<br><em>本金自己長大</em>";
      slot(1, "ask").innerHTML = asks(m1
        ? ["這 " + wan(mid[0].fiveSum / 10000) + "配息不花掉，" + m1.age + " 歲時本金會變多少？", "每年配息從 " + yuan(mid[0].yearly) + " 變成多少？"]
        : ["配息不花掉、滾回本金，65 歲時本金會變多少？", "每年配息會從 " + yuan(mid[0].yearly) + " 變成多少？"]);
      var xs = m.yearly.map(function (r) { return r.age + "歲"; });
      var bars = mid.map(function (r) { return { v: r.yearly, c: C.soft, t: yuanShort(r.yearly), l: r.age + " 歲" }; })
        .concat([{ v: a65.yearly, c: C.green, t: yuanShort(a65.yearly), l: "65 歲" }]);
      slot(1, "viz").innerHTML =
        '<div class="pv-card"><h3>實際投入本金：配息滾雪球 vs 放定存</h3>' +
        lineChart(xs, [{ v: m.yearly.map(function (r) { return r.balWan * 10000; }), c: C.blue, fill: "rgba(26,115,176,.12)" },
                       { v: m.yearly.map(function (r) { return r.depoWan * 10000; }), c: "#7FA9C6", dash: "8 6", w: 3 }], { xlab: "年紀" }) +
        keyRow([{ c: C.blue, l: "配息回存滾入本金（" + rateS + "，扣 " + pct(m.feePct) + " 手續費）" }, { c: "#7FA9C6", l: "同本金放定存 " + dPct }]) + "</div>" +
        '<div class="pv-card"><h3>每 5 年，每年配息（元）</h3>' + vbars(bars, { h: 280 }) +
        '<p class="pv-big">' + esc(prinS) + " → 65 歲本金 <em>" + esc(wan(a65.balWan)) + "</em></p></div>";
    } else {
      slot(1, "title").innerHTML = "現在就是 <em>65 歲</em>，直接看現金流";
      slot(1, "ask").innerHTML = asks(["這 " + prinS + "放 " + rateS + " 配息，一年配多少？"]);
      slot(1, "viz").innerHTML = '<div class="pv-card pv-empty">起始年紀已是 65 歲，沒有滾雪球的年數；把「起始年紀」往前調，就能看到每 5 年的變化。</div>';
    }
    slot(1, "cue").innerHTML = cueHtml(g.sec1, g.walk.length ? g.walk : g.intro.slice(1));

    /* 3 65 歲：退休現金流 */
    slot(2, "title").innerHTML = "65 歲退休，每個月有<br><em>" + esc(yuan(a65.monthly)) + "</em> 的現金流";
    slot(2, "ask").innerHTML = asks(["一路滾到 65 歲退休，你猜每個月會有多少現金流？", "巴菲特大部分財富在晚年才累積，你覺得靠的是什麼？"]);
    var mb = (mid || []).map(function (r) { return { v: r.monthly, c: C.sky2, t: yuanShort(r.monthly), l: r.age + " 歲" }; })
      .concat([{ v: a65.monthly, c: C.blue, t: yuanShort(a65.monthly), l: "65 歲", l2: "退休" }]);
    slot(2, "viz").innerHTML =
      '<div class="pv-card"><h3>65 歲時</h3><div class="pv-stats">' + stat("實際投入本金", wanNum(a65.balWan), "萬") + stat("每年配息", yuanShort(a65.yearly), "元") + stat("每月配息", yuanShort(a65.monthly), "元", "hl") + "</div>" +
      '<p class="pv-big">長長的坡道（<em>' + n + " 年</em>）＋ 很濕的雪（<em>" + esc(rateS) + "</em> 配息）</p></div>" +
      '<div class="pv-card"><h3>每月配息一路長大（元）</h3>' + vbars(mb, { h: 280 }) + "</div>";
    slot(2, "cue").innerHTML = cueHtml(g.sec1, g.peak);

    /* 4 下一步：階梯式推進 */
    var half = a65.balWan / 2, beat = half - m.depoWan65;
    slot(3, "title").innerHTML = "不談保本，談<em>時間成本</em>";
    slot(3, "ask").innerHTML = asks(["你會擔心投資不保本嗎？我們看看就算打對折會怎樣。", "如果手上沒有 " + prinS + "，一年存 10 萬可以嗎？"]);
    slot(3, "viz").innerHTML =
      '<div class="pv-card"><h3>' + m.startAge + " 歲投 " + esc(prinS) + "，到 65 歲（萬）</h3>" +
      vbars([{ v: m.depoWan65, c: "#7FA9C6", t: wanNum(m.depoWan65) + " 萬", l: "放定存", l2: dPct },
             { v: a65.balWan, c: C.blue, t: wanNum(a65.balWan) + " 萬", l: "配息滾雪球", l2: rateS },
             { v: half, c: beat >= 0 ? C.green : C.red, t: wanNum(half) + " 萬", l: "就算打對折", l2: "× 50%" }]) +
      '<p class="pv-big">' + (beat >= 0 ? "打對折還比定存多 <em>" + esc(wan(beat)) + "</em>" : "打對折會比定存少 <em>" + esc(wan(-beat)) + "</em>，年數或配息率要再評估") + "</p></div>" +
      '<div class="pv-card"><h3>階梯式推進</h3><div class="pv-stats two">' +
      stat("第一階：有整筆", prinS + " 滾雪球", "") + stat("第二階：沒有整筆", "一年存 10 萬", "定期定額", "hl") + "</div>" +
      '<p class="cap">花的是時間成本，越早開始，坡道越長。</p></div>';
    slot(3, "cue").innerHTML = cueHtml(g.sec2, g.ladder);
  }

  /* ---------- 控制項同步 ---------- */
  function syncControls() {
    var oralOn = !!(window.McScriptOral && McScriptOral.isOn());
    root.querySelectorAll("[data-pv-oral]").forEach(function (el) { el.checked = oralOn; });
    root.querySelectorAll("[data-sl]").forEach(function (box) {
      var s = SL[box.getAttribute("data-sl")], inp = box.querySelector("input"), v = mainVal(s.id), isEmpty = !isFinite(v);
      if (!isFinite(v)) v = s.min;
      var min = s.min, max = s.max;
      if (v < min) min = v; if (v > max) max = v;
      inp.min = min; inp.max = max; inp.step = s.step;
      if (dragging !== inp) inp.value = v;
      inp.style.setProperty("--p", ((v - min) / ((max - min) || 1) * 100).toFixed(2) + "%");
      box.querySelector(".pv-sl-val").textContent = isEmpty ? "未填" : s.f(v);
    });
  }
  root.addEventListener("input", function (e) {
    var box = e.target.closest("[data-sl]"); if (!box || e.target.type !== "range") return;
    dragging = e.target;
    setMain(SL[box.getAttribute("data-sl")].id, e.target.value);
  });
  root.addEventListener("change", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-pv-oral")) { if (window.McScriptOral) McScriptOral.set(e.target.checked); return; }
    if (e.target.type === "range") { dragging = null; render(); }
  });
  root.addEventListener("click", function (e) {
    var pm = e.target.closest("[data-pm]");
    if (pm) {
      var box = pm.closest("[data-sl]"), s = SL[box.getAttribute("data-sl")], v = mainVal(s.id); if (!isFinite(v)) v = s.min;
      var nv = Math.round((v + s.step * Number(pm.getAttribute("data-pm"))) / s.step) * s.step;
      if (nv < 0) nv = 0;
      if (s.id === "age") nv = Math.max(1, Math.min(65, nv));
      if (s.id === "principal" && nv <= 0) nv = s.step;
      setMain(s.id, parseFloat(nv.toFixed(4)));
      return;
    }
    var go = e.target.closest("[data-go]");
    if (go) { show(Number(go.getAttribute("data-go"))); return; }
  });

  function show(i) {
    cur = Math.max(0, Math.min(PAGES.length - 1, i));
    root.querySelectorAll(".pv-page").forEach(function (p, k) { p.classList.toggle("on", k === cur); });
    root.querySelectorAll(".pv-tab").forEach(function (t, k) { t.setAttribute("aria-selected", k === cur ? "true" : "false"); });
    root.querySelectorAll("#pv-dots span").forEach(function (d, k) { d.classList.toggle("on", k === cur); });
    document.getElementById("pv-prev").disabled = cur === 0;
    var nx = document.getElementById("pv-next");
    nx.textContent = cur === PAGES.length - 1 ? "回到試算" : "下一步 ›";
    document.getElementById("pv-stage").scrollTop = 0;
    var tab = root.querySelectorAll(".pv-tab")[cur]; if (tab && tab.scrollIntoView) try { tab.scrollIntoView({ block: "nearest", inline: "center" }); } catch (err) {}
  }

  var SNAP_IDS = ["principal", "rate", "age", "fee"];
  function open() {
    snapshot = { v: {} };
    SNAP_IDS.forEach(function (id) { var el = mainEl(id); if (el) snapshot.v[id] = el.value; });
    root.hidden = false;
    document.documentElement.classList.add("pv-lock");
    try { history.pushState({ pv: 1 }, "", location.pathname + location.search + "#present"); } catch (err) {}
    show(0);
    render();
  }
  function close(fromPop) {
    if (root.hidden) return;
    root.hidden = true; dragging = null;
    document.documentElement.classList.remove("pv-lock");
    if (!fromPop && history.state && history.state.pv) { try { history.back(); } catch (err) {} }
    if (window.McInputs && McInputs.save) McInputs.save();
    toast("已把互動版的數字帶回試算頁");
  }
  function undo() {
    if (!snapshot) return;
    SNAP_IDS.forEach(function (id) { var el = mainEl(id); if (el && snapshot.v[id] != null) el.value = snapshot.v[id]; });
    if (typeof recalc === "function") recalc();
    if (window.McInputs && McInputs.save) McInputs.save();
    toast("已還原成打開互動版之前的數字");
  }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "pv-toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1800);
  }

  document.getElementById("open-present").addEventListener("click", open);
  document.getElementById("pv-close").addEventListener("click", function () { close(false); });
  document.getElementById("pv-undo").addEventListener("click", undo);
  document.getElementById("pv-prev").addEventListener("click", function () { show(cur - 1); });
  document.getElementById("pv-next").addEventListener("click", function () { if (cur === PAGES.length - 1) close(false); else show(cur + 1); });
  window.addEventListener("popstate", function () { if (!root.hidden) close(true); });
  document.addEventListener("keydown", function (e) {
    if (root.hidden) return;
    if (e.key === "Escape") { close(false); return; }
    if (e.target && e.target.type === "range") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") show(cur + 1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") show(cur - 1);
  });

  window.McPresentRefresh = render;
  window.McPresent = { open: open, close: close, show: show };
})();
