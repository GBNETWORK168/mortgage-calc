/* 互動版畫面：給客戶看的全螢幕引導式展示。
   數字全部來自主頁的試算（window.MC_MODEL / MC_YEARLY，由 index.html 的 updateScript 產生），
   滑桿直接改主頁欄位並觸發主頁原本的 recalc，所以兩邊數字永遠一致。
   分頁順序與問句、提詞依主頁話術稿：開場 → 方案一配置 → 護城河 → 效益總結 → 反對問題＋五步驟。 */
(function () {
  "use strict";
  if (!document.getElementById("open-present")) return;

  var C = { blue: "#1A73B0", soft: "#2B86C4", deep: "#0E4E7A", dark: "#0A3656", sky: "#D4EBF7", sky2: "#B7D8EE",
    pale: "#E8F4FB", green: "#1E7A4A", red: "#B42318", gold: "#E3A72F", muted: "#4E6E85", grid: "#E1EEF6" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function yuan(v) { return Math.round(v).toLocaleString("zh-TW") + " 元"; }
  function yuanShort(v) { return Math.round(v).toLocaleString("zh-TW"); }
  function wan(v) { return fmtWanBare(v); }                 // 主頁同一支格式函式
  function pct(v) { return fmtRatePct(v); }
  function wanNum(v) { var r = Math.round(v * 10) / 10; return r.toLocaleString("zh-TW", Number.isInteger(r) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  /* ---------- 主頁欄位存取 ---------- */
  function mainEl(id) { return document.getElementById(id); }
  function mainVal(id) { var el = mainEl(id); return el ? parseFloat(el.value) : NaN; }
  function setMain(id, v, ev) {
    var el = mainEl(id); if (!el) return;
    el.value = String(v);
    el.dispatchEvent(new Event(ev || "input", { bubbles: true }));
  }

  /* ---------- 滑桿設定（id 為主頁欄位） ---------- */
  var SL = {
    amount: { id: "amount", lab: "房貸金額（可貸 8 成）", min: 100, max: 5000, step: 10, f: function (v) { return wanNum(v) + " 萬"; } },
    rate: { id: "rate", lab: "房貸利率", min: 0.5, max: 5, step: 0.05, f: function (v) { return pct(v); } },
    divRate: { id: "div-rate", lab: "配息年化報酬率", min: 2, max: 15, step: 0.1, f: function (v) { return pct(v); } },
    divPrin: { id: "div-principal", lab: "配置配息本金", min: 0, max: 1000, step: 10, f: function (v) { return wanNum(v) + " 萬"; }, dynMax: true },
    ratio: { id: "script-ratio", lab: "FPE 保額比例（目標保障 × %）", min: 10, max: 200, step: 5, f: function (v) { return String(parseFloat(Number(v).toFixed(2))) + "%"; } },
    age: { id: "client-age", lab: "客戶年紀", min: 18, max: 78, step: 1, f: function (v) { return Math.round(v) + " 歲"; } },
    bump: { id: "stress-rate-bump", lab: "假設利率漲幅", min: -1, max: 3, step: 0.25, f: function (v) { return fmtBumpPct(v); } },
    income: { id: "monthly-income", lab: "每月收入", min: 20000, max: 300000, step: 1000, f: function (v) { return yuan(v); }, empty: "未填" },
    other: { id: "other-debt", lab: "其他貸款月付", min: 0, max: 100000, step: 1000, f: function (v) { return yuan(v); } },
    sdiv: { id: "stress-div-rate", lab: "壓力配息率（配息下降到）", min: 0, max: 12, step: 0.5, f: function (v) { return pct(v); } }
  };
  function sliderHtml(key) {
    var s = SL[key];
    return '<div class="pv-sl" data-sl="' + key + '"><div class="pv-sl-top"><span class="pv-sl-lab">' + esc(s.lab) + '</span><span class="pv-sl-val"></span></div>' +
      '<div class="pv-sl-row"><button type="button" class="pv-pm" data-pm="-1" aria-label="減少">−</button>' +
      '<input type="range" aria-label="' + esc(s.lab) + '"><button type="button" class="pv-pm" data-pm="1" aria-label="增加">＋</button></div></div>';
  }
  function segHtml(key, opts) {
    return '<div class="pv-sl" data-seg="' + key + '"><div class="pv-sl-top"><span class="pv-sl-lab">' + (key === "years" ? "貸款年限" : "性別") + '</span></div><div class="pv-seg">' +
      opts.map(function (o) { return '<button type="button" data-v="' + o[0] + '">' + o[1] + "</button>"; }).join("") + "</div></div>";
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
      s += '<text x="' + (x + bw / 2) + '" y="' + (y - 10) + '" text-anchor="middle" font-size="22" font-weight="700" fill="' + C.dark + '">' + esc(it.t) + "</text>";
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - bot + 26) + '" text-anchor="middle" font-size="18" font-weight="700" fill="' + C.deep + '">' + esc(it.l) + "</text>";
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

  /* ---------- 頁面骨架 ---------- */
  var PAGES = [
    { tab: "現況", sliders: '{amount}{income}{other}' },
    { tab: "配置", sliders: '{rate}{years}{divRate}{divPrin}' },
    { tab: "護城河", sliders: '{ratio}{age}{gender}' },
    { tab: "效益", sliders: '{divRate}{amount}' },
    { tab: "風險", sliders: '{bump}{sdiv}' }
  ];
  function expandSliders(t) {
    return t.replace(/\{(\w+)\}/g, function (_, k) {
      if (k === "years") return segHtml("years", [["20", "20 年"], ["30", "30 年"]]);
      if (k === "gender") return segHtml("gender", [["女", "女"], ["男", "男"]]);
      return sliderHtml(k);
    });
  }
  var root = document.createElement("div");
  root.className = "pv"; root.id = "pv"; root.hidden = true;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "房產活化互動畫面");
  root.innerHTML =
    '<header class="pv-top"><div class="pv-brand">讓你的房產更有價值</div><nav class="pv-tabs" role="tablist">' +
    PAGES.map(function (p, i) { return '<button type="button" class="pv-tab" role="tab" data-go="' + i + '"><span class="n">' + (i + 1) + "</span>" + p.tab + "</button>"; }).join("") +
    '</nav><div class="pv-actions"><button type="button" class="pv-btn ghost" id="pv-undo" title="把數字還原成打開互動版之前">還原數字</button><button type="button" class="pv-btn primary" id="pv-close">回到試算</button></div></header>' +
    '<main class="pv-stage" id="pv-stage">' +
    PAGES.map(function (p, i) {
      return '<section class="pv-page" data-page="' + i + '"><p class="pv-step">STEP ' + (i + 1) + "・" + p.tab + '</p><h2 class="pv-title" data-slot="title"></h2>' +
        '<div class="pv-ask" data-slot="ask"></div><div class="pv-grid"><div data-slot="viz"></div>' + ctrlCard(expandSliders(p.sliders)) + "</div>" +
        '<details class="pv-cue"><summary>業務提詞（客戶畫面可收起）</summary><div class="cue-tools"><label class="oral-switch" title="話術改用好念的整數與短句；畫面數字仍為精確數字"><input type="checkbox" data-pv-oral><span class="oral-track" aria-hidden="true"></span><span class="oral-text">口語版</span></label></div><div class="cue-b" data-slot="cue"></div></details></section>';
    }).join("") +
    '<p class="pv-disc">利率、配息率與壓力測試皆為試算假設，非任何商品之保證報酬；配息不保證且可能來自本金，未計淨值與匯率波動。FPE 倍數與解約金依中分紅假設，紅利非保證。實際貸款成數與利率依銀行核貸結果。</p></main>' +
    '<footer class="pv-foot"><button type="button" class="pv-btn ghost" id="pv-prev">‹ 上一步</button><div class="pv-dots" id="pv-dots">' +
    PAGES.map(function () { return "<span></span>"; }).join("") + '</div><button type="button" class="pv-btn primary" id="pv-next">下一步 ›</button></footer>';
  document.body.appendChild(root);

  var cur = 0, snapshot = null, dragging = null;
  function slot(i, name) { return root.querySelector('.pv-page[data-page="' + i + '"] [data-slot="' + name + '"]'); }
  function asks(list) { return list.map(function (q, i) { return '<div class="pv-q"><span class="qi">問' + (i + 1) + "</span><span>" + q + "</span></div>"; }).join(""); }

  /* 主頁話術稿依段落切出來給提詞框用（與主頁同一份 lastScriptParts） */
  function scriptSections() {
    var out = {}, curSec = "";
    var oral = window.McScriptOral && McScriptOral.isOn() && typeof lastScriptPartsOral !== "undefined" && lastScriptPartsOral.length;
    (oral ? lastScriptPartsOral : (typeof lastScriptParts !== "undefined" ? lastScriptParts : [])).forEach(function (p) {
      if (p.sec) { curSec = p.sec; out[curSec] = out[curSec] || []; return; }
      (out[curSec] = out[curSec] || []).push(p);
    });
    return out;
  }
  function findSec(secs, prefix) { for (var k in secs) if (k.indexOf(prefix) === 0) return { name: k, parts: secs[k] }; return null; }
  function cueHtml(parts) {
    if (!parts || !parts.length) return "<p>（此情境沒有對應話術）</p>";
    return parts.map(function (p) {
      if (p.sec) return '<p class="sec">' + esc(p.sec) + "</p>";
      if (p.step) return '<p class="stp"><span class="n">' + esc(p.step) + "</span>" + esc(p.text) + "</p>";
      return '<p class="' + (p.who === "業務" ? "biz" : "cli") + '"><span class="who">' + esc(p.who) + "</span>" + esc(p.text) + "</p>";
    }).join("");
  }

  /* 負債比燈號卡（數字來自主頁 computeDti） */
  function dtiCard(d) {
    if (!d) return "";
    var col = { g: ["#E5F6EE", "#1E9E5A", "#146C45"], y: ["#FFF6DD", "#E3A72F", "#8A5A00"], r: ["#FDECEC", "#D23B2E", "#9B2C2C"] }[d.ok ? d.level : ""] || ["#F4FAFD", "#C9D7E4", C.muted];
    var needs = (d.need33 ? '<div class="pv-stats" style="margin-top:10px">' + stat("落在 1/3 內，月收入至少約", yuanShort(d.need33), "元") + stat("落在 50% 內，月收入至少約", yuanShort(d.need50), "元") + "</div>" : "");
    var head = d.ok
      ? '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span style="width:34px;height:34px;border-radius:50%;background:' + col[1] + ";box-shadow:0 0 0 7px " + col[1] + '33;flex:0 0 auto"></span>' +
        '<span style="font-family:\'Noto Serif TC\',serif;font-size:clamp(2.2rem,5vw,3.2rem);font-weight:700;color:' + col[2] + ';line-height:1">' + esc(d.pctS) + "</span>" +
        '<span style="font-size:clamp(1.1rem,2.4vw,1.4rem);font-weight:700;color:' + col[2] + '">' + esc(d.light + "：" + d.label) + "</span></div>" +
        '<p class="cap" style="font-size:.98rem">（本案月付 ' + esc(yuan(d.pay)) + (d.other > 0 ? "＋其他貸款 " + esc(yuan(d.other)) : "") + "）÷ 月收入 " + esc(yuan(d.income)) + "</p>"
      : '<p style="margin:0;font-size:1.15rem;color:' + C.muted + '">' + (d.reason === "income" ? "輸入每月收入，負債比燈號馬上出來。" : "請先輸入房貸金額與利率。") + "</p>";
    return '<div class="pv-card" style="background:' + col[0] + '"><h3>負債比（本案月付＋其他貸款 ÷ 月收入）</h3>' + head + needs +
      '<p class="cap">≤33% 綠燈、33–50% 黃燈、&gt;50% 紅燈；以上為業界常見判斷範圍，非法規固定標準，實際以銀行審核為準。</p></div>';
  }

  /* ---------- 繪製 ---------- */
  function render() {
    if (root.hidden) return;
    var m = window.MC_MODEL;
    syncControls();
    if (!m) {
      for (var i = 0; i < PAGES.length; i++) {
        slot(i, "title").textContent = "請先輸入房貸金額、利率與配息率";
        slot(i, "ask").innerHTML = ""; slot(i, "viz").innerHTML = '<div class="pv-card pv-empty">數字不完整，請用右側滑桿或回到試算頁補齊。</div>';
        slot(i, "cue").innerHTML = "";
      }
      return;
    }
    var payR = m.payRound, loanS = wan(m.loanWan), propS = wan(m.propWan), needS = "約 " + wan(m.needWan), leftS = "約 " + wan(m.leftoverWan);
    var spouse = m.gender === "男" ? "老婆" : "先生";
    var secs = scriptSections();
    var secOpen = findSec(secs, "開場"), secPlan = findSec(secs, "方案一"), secSum = findSec(secs, "效益總結"), secObj = findSec(secs, "客戶反對"), secStep = findSec(secs, "處理反對");
    var planA = [], planB = [];
    if (secPlan) { var hit = false; secPlan.parts.forEach(function (p) { if (!hit && p.who === "業務" && p.text.indexOf("護城河") >= 0) hit = true; (hit ? planB : planA).push(p); }); }

    /* 1 現況：開場與房產活化概念 */
    slot(0, "title").innerHTML = "房子增值到 <em>" + esc(propS) + "</em>，<br>你覺得有賺到錢嗎？";
    slot(0, "ask").innerHTML = asks(["房子增值了，但沒賣掉，你覺得有賺到嗎？", "如果賣掉，你還有地方住嗎？", "能貸的金額大概是 8 成，是多少？"].concat(m.dti && m.dti.ok ? [] : ["你每月收入大概多少？我們先看負債比。"]));
    slot(0, "viz").innerHTML =
      '<div class="pv-card"><h3>你的房子（以可貸 8 成換算）</h3>' +
      hstack(m.propWan, [{ v: m.loanWan, c: C.blue, t: "可貸 8 成 " + loanS }, { v: m.propWan - m.loanWan, c: C.sky2, t: "2 成", tc: C.deep }], "房產價值 " + propS) +
      '<div class="pv-stats" style="margin-top:8px">' + stat("房產價值", wanNum(m.propWan), "萬") + stat("可貸金額（8 成）", wanNum(m.loanWan), "萬", "hl") + stat("房子還是你住", "居住權不變", "") + "</div>" +
      '<p class="pv-big">不賣房子，也能讓 <em>' + esc(loanS) + "</em> 動起來</p></div>" + dtiCard(m.dti);
    slot(0, "cue").innerHTML = cueHtml(secOpen && secOpen.parts);

    /* 2 配置：月付 → 打平所需本金 → 還剩多少 */
    var divPrin = m.divPrinWan, divMonth = divPrin * 10000 * (m.divRatePct / 100) / 12, gap = Math.round(divMonth) - payR;
    var needRatio = m.needWan / m.loanWan * 100;
    slot(1, "title").innerHTML = m.insufficient
      ? "以 " + esc(pct(m.divRatePct)) + " 配息，<em>全數配置也無法打平</em>月付"
      : "只要 <em>" + esc(needS) + "</em> 的配息，<br>就能付掉每月房貸";
    slot(1, "ask").innerHTML = asks(["貸款 " + loanS + "、" + m.years + " 年，利率 " + pct(m.annualPct) + "，一個月要還多少？",
      "找一個 " + pct(m.divRatePct) + " 的配息來付，本金大概要多少？是不是還有剩？"]);
    var segs2 = [{ v: Math.min(m.needWan, m.loanWan), c: C.blue, l: "打平房貸配置", t: needS }, { v: m.leftoverWan, c: C.green, l: "可靈活運用資金", t: leftS }];
    slot(1, "viz").innerHTML =
      '<div class="pv-card"><h3>每月房貸 vs 每月配息</h3>' +
      vbars([{ v: payR, c: "#7FA9C6", t: yuanShort(payR) + " 元", l: "每月房貸", l2: pct(m.annualPct) + "・" + m.years + " 年" },
             { v: Math.round(m.needWan * 10000 * m.divRatePct / 100 / 12), c: C.blue, t: yuanShort(m.needWan * 10000 * m.divRatePct / 100 / 12) + " 元", l: "打平配置配息", l2: (m.insufficient ? "需 " : "") + wan(m.needWan) + " × " + pct(m.divRatePct) },
             { v: Math.round(divMonth), c: gap >= 0 ? C.green : C.red, t: yuanShort(divMonth) + " 元", l: "你選的配置", l2: wan(divPrin) + " × " + pct(m.divRatePct) }]) +
      '<p class="pv-big">' + (gap > 0 ? "配置 " + esc(wan(divPrin)) + "，每月可多出 <em>" + esc(yuan(gap)) + "</em>" : gap < 0 ? "配置 " + esc(wan(divPrin)) + "，每月還需自付 <em>" + esc(yuan(-gap)) + "</em>" : "每月剛好打平") + "</p></div>" +
      '<div class="pv-card"><h3>' + esc(loanS) + ' 怎麼分</h3><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:12px;align-items:center">' +
      donut(segs2, loanS, "可貸金額") + legend(segs2.concat([{ c: "transparent", l: "打平所需配置比例", t: m.insufficient ? "超過 100%" : fmtPct(needRatio) }])) + "</div></div>" +
      '<div class="pv-card"><h3>資產負債一起看</h3><div class="pv-tacct"><div><div class="th">資產</div><div class="row"><span>房子</span><b>' + esc(propS) + '</b></div><div class="row"><span>貸出來的資金</span><b>' + esc(loanS) + '</b></div></div>' +
      '<div><div class="th">負債</div><div class="row"><span>房貸</span><b>' + esc(loanS) + '</b></div></div><div class="net">淨資產一樣是 ' + esc(propS) + "，多的是每月會流進來的現金流</div></div></div>";
    slot(1, "cue").innerHTML = cueHtml(planA.length ? planA : (secPlan && secPlan.parts));

    /* 3 護城河：FPE */
    var y = window.MC_YEARLY;
    if (m.insufficient) {
      slot(2, "title").innerHTML = "目前配息率<em>無法打平</em>，先調整配置";
      slot(2, "ask").innerHTML = asks(["配息率或貸款金額要不要調整一下，先讓房貸打平？"]);
      slot(2, "viz").innerHTML = '<div class="pv-card pv-empty">打平後才有可靈活運用資金可以搭護城河。請到「配置」頁調高配息率或調整金額。</div>';
    } else {
      slot(2, "title").innerHTML = m.ageInRange
        ? "兩年總繳 <em>" + esc(wan(m.protectWan)) + "</em>，<br>第 6 年約 <em>" + esc(wan(m.coverWan)) + "</em> 壽險保障"
        : "幫家人搭一座<em>護城河</em>";
      slot(2, "ask").innerHTML = asks(["你有" + spouse + "跟小孩，萬一真的有狀況，這筆房貸誰來繳？",
        m.ageInRange ? (leftS + " 減掉兩年總繳 " + wan(m.protectWan) + "，還剩多少？") : "這個年紀先保留可靈活運用資金，好嗎？"]);
      var html3 = "";
      if (m.ageInRange) {
        html3 += '<div class="pv-card"><h3>小保費、大保障（FPE 兩年期・中分紅・第 6 年）</h3>' +
          vbars([{ v: m.protectWan, c: C.soft, t: wan(m.protectWan), l: "兩年總繳", l2: "每年約 " + fmtWanFlexible(m.protectWan / 2) },
                 { v: m.coverWan, c: C.deep, t: wan(m.coverWan), l: "第 6 年壽險保障", l2: "約 " + fmtMult(m.mult) + " 倍" },
                 { v: m.loanWan, c: "#7FA9C6", t: loanS, l: "房貸金額", l2: m.coverWan >= m.loanWan - 0.05 ? "保障蓋得過房貸" : "保障 " + fmtPct(m.coverWan / m.loanWan * 100) }], { h: 300 }) +
          (m.fpeCapped ? '<div class="pv-warnbox">⚠️ 可運用資金不足規劃足額需求：足額約需兩年總繳 ' + esc(wan(m.neededProtectWan)) + "，目前可用約 " + esc(wan(Math.max(0, m.leftoverWan))) + "</div>" : "") +
          (m.fpeAtMax ? '<div class="pv-warnbox">已達此年齡 FPE 最高保額，以最高保額計算</div>' : "") + "</div>";
        if (y && y.rows && y.rows.length) {
          var xs = y.rows.map(function (r) { return r.t; }), bal = y.rows.map(function (r) { return r.bal; }), cv = y.rows.map(function (r) { return r.twd; });
          var cross = -1; for (var k = 0; k < y.rows.length; k++) if (y.rows[k].twd != null && y.rows[k].twd >= y.rows[k].bal) { cross = k; break; }
          var ser = [{ v: bal, c: "#7FA9C6", l: "年底房貸剩餘本金", fill: "rgba(127,169,198,.12)" }];
          if (y.hasCv) ser.push({ v: cv, c: C.green, l: "FPE 年度末解約金（中分紅）" });
          html3 += '<div class="pv-card"><h3>房貸越繳越少，保單價值越來越多</h3>' +
            lineChart(xs, ser, { xlab: "保單年度", mark: cross, markLab: cross >= 0 ? "第 " + (cross + 1) + " 年起解約金 ≥ 房貸餘額" : "" }) + keyRow(ser) +
            (y.hasCv ? "" : '<p class="cap">FPE 逐年解約金資料準備中</p>') + "</div>";
        }
      } else {
        html3 += '<div class="pv-card pv-empty">此年紀不在 FPE 兩年期投保年齡 0–78 歲，第 6 年壽險倍數無法自動估算。</div>';
      }
      var segs3 = [{ v: m.needWan, c: C.blue, l: "打平房貸配置", t: needS }, { v: m.protectWan, c: C.deep, l: "FPE 兩年總繳（護城河）", t: wan(m.protectWan) }, { v: m.cashWan, c: C.green, l: "剩餘投入配息", t: "約 " + wan(m.cashWan) }];
      html3 += '<div class="pv-card"><h3>' + esc(loanS) + ' 三桶金</h3><div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:12px;align-items:center">' + donut(segs3, loanS, "可貸金額") + legend(segs3) + "</div></div>";
      slot(2, "viz").innerHTML = html3;
    }
    slot(2, "cue").innerHTML = cueHtml(planB.length ? planB : []);

    /* 4 效益總結與成交問句 */
    if (m.insufficient) {
      slot(3, "title").innerHTML = "先把配置調到<em>能打平</em>，效益才會出來";
      slot(3, "ask").innerHTML = asks(["我們先把月付與所需配置看清楚，好嗎？"]);
      slot(3, "viz").innerHTML = '<div class="pv-card pv-empty">目前配息率全數配置也無法打平房貸。</div>';
    } else {
      slot(3, "title").innerHTML = "做了這件事，每月多出 <em>" + esc(yuan(m.cashMonthYuan)) + "</em>";
      slot(3, "ask").innerHTML = asks(["房子不動，生活不會變好也不會變難；做了之後，你覺得差在哪？", "好，如果是你，你願意做嗎？"]);
      var horizon = Math.max(1, Math.min(m.years, (m.age < 65 ? 65 - m.age : m.years)));
      var xs4 = [], plan = [], none = [];
      for (var t = 0; t <= horizon; t++) { xs4.push(t === 0 ? "現在" : (m.age + t) + "歲"); plan.push(m.cashYearYuan * t); none.push(0); }
      var ser4 = [{ v: plan, c: C.blue, l: "做了房產活化：多出配息逐年累積（不含再投入）", fill: "rgba(43,134,196,.14)" }, { v: none, c: "#9DB4C4", l: "房子不動：0", dash: "8 6", w: 3 }];
      slot(3, "viz").innerHTML =
        '<div class="pv-card"><div class="pv-stats two">' +
        stat("① 靠配息付房貸，不用自己掏錢", wanNum(m.needWan), "萬配置") +
        stat("② 壽險保障護城河", m.ageInRange ? wanNum(m.coverWan) : "—", m.ageInRange ? "萬" : "") +
        stat("③ 多出的配息金流／月", yuanShort(m.cashMonthYuan), "元", "hl") +
        (isFinite(m.monthAt65Yuan) ? stat("65 歲每月配息推估", yuanShort(m.monthAt65Yuan), "元", "ok") : "") +
        "</div></div>" +
        '<div class="pv-card"><h3>同一間房子，兩種結果</h3>' + lineChart(xs4, ser4, { h: 280 }) + keyRow(ser4) +
        '<p class="pv-big">' + horizon + " 年後，多出的配息累積約 <em>" + esc(wan(m.cashYearYuan * horizon / 10000)) + "</em></p>" +
        '<p class="cap">每年約 ' + esc(yuan(m.cashYearYuan)) + "；65 歲每月配息推估以配息率 " + esc(pct(m.divRatePct)) + "、回存扣 5% 手續費複利推估（同主頁）。</p></div>";
    }
    slot(3, "cue").innerHTML = cueHtml(secSum && secSum.parts);

    /* 5 風險：反對問題＋五步驟 */
    var st = m.stress;
    slot(4, "title").innerHTML = "風險是真的，<br>我們<em>直接算給你看</em>";
    slot(4, "ask").innerHTML = asks(["這樣有什麼風險嗎？", "利息不會波動嗎？", "配息如果變少怎麼辦？"]);
    if (!st) {
      slot(4, "viz").innerHTML = '<div class="pv-card pv-empty">請輸入利率漲幅與壓力配息率。</div>';
    } else {
      var runYears = st.worstGap > 0 && st.moatYuan > 0 ? st.moatYuan / st.worstGap / 12 : null;
      var html5 = '<div class="pv-card"><h3>利率 ' + esc(st.bumpS) + "、配息降到 " + esc(pct(st.stressDivPct)) + " 時</h3>" +
        vbars([{ v: st.pay, c: "#7FA9C6", t: yuanShort(st.pay), l: "原本月付", l2: st.rateS },
               { v: st.newPay, c: st.rateExtra > 0 ? C.red : C.green, t: yuanShort(st.newPay), l: "利率變動後月付", l2: st.newRatePlain },
               { v: st.stressDiv, c: C.blue, t: yuanShort(st.stressDiv), l: "壓力下打平配息", l2: "配息 " + pct(st.stressDivPct) },
               { v: st.moatDiv, c: C.green, t: yuanShort(st.moatDiv), l: "護城河配息", l2: st.moatS }], { h: 300 }) +
        '<div class="pv-stats" style="margin-top:8px">' +
        stat("利率變動 多繳／月", st.rateExtra > 0 ? yuanShort(st.rateExtra) : (st.rateExtra < 0 ? "少繳 " + yuanShort(-st.rateExtra) : "0"), "元", st.rateAbs ? "ok" : "warn") +
        stat("配息下降 缺口／月", st.divGap > 0 ? yuanShort(st.divGap) : "無缺口", st.divGap > 0 ? "元" : "", st.divAbs ? "ok" : "warn") +
        stat("最壞情境 缺口／月", st.worstGap > 0 ? yuanShort(st.worstGap) : "無缺口", st.worstGap > 0 ? "元" : "", st.worstAbsDiv ? "ok" : "warn") +
        "</div></div>";
      // 護城河可撐多久（最壞情境，本金直接扣）
      var cap = m.years * 12, months = st.worstGap > 0 ? (st.moatYuan > 0 ? st.moatYuan / st.worstGap : 0) : Infinity;
      var fillP = months === Infinity ? 100 : Math.max(0, Math.min(100, months / cap * 100));
      html5 += '<div class="pv-card"><h3>最壞情境：護城河 ' + esc(st.moatS) + " 可撐多久</h3>" +
        '<div style="position:relative;height:46px;border-radius:14px;background:' + C.pale + ';overflow:hidden"><div style="height:100%;width:' + fillP.toFixed(1) + "%;background:linear-gradient(90deg," + C.green + "," + C.soft + ');border-radius:14px"></div>' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="background:rgba(255,255,255,.92);border-radius:999px;padding:4px 14px;font-size:1.15rem;font-weight:700;color:' + C.dark + '">' + esc(st.worstGap > 0 ? st.worstRunShort : "沒有缺口，不必動用本金") + "</span></div></div>" +
        '<div style="display:flex;justify-content:space-between;font-size:.9rem;color:' + C.muted + ';margin-top:4px"><span>現在</span><span>房貸 ' + m.years + " 年</span></div>" +
        '<div class="pv-verdict ' + (st.safe ? "ok" : "warn") + '"><span class="tag">' + (st.safe ? "安全" : "需留意") + "</span><span>" +
        esc(st.safe ? "利率上漲或配息下降的單向缺口，都能由護城河每月配息（" + st.moatDivS + "）吸收。" : "單靠護城河每月配息（" + st.moatDivS + "）無法完全吸收，建議調低貸款或拉高打平配置，並每年檢視。") +
        "</span></div></div>";
      slot(4, "viz").innerHTML = html5;
    }
    slot(4, "cue").innerHTML = cueHtml((secObj ? secObj.parts : []).concat(secStep ? [{ sec: secStep.name }].concat(secStep.parts) : []));
  }

  /* ---------- 控制項同步 ---------- */
  function syncControls() {
    var oralOn = !!(window.McScriptOral && McScriptOral.isOn());
    root.querySelectorAll("[data-pv-oral]").forEach(function (el) { el.checked = oralOn; });
    root.querySelectorAll("[data-sl]").forEach(function (box) {
      var key = box.getAttribute("data-sl"), s = SL[key], inp = box.querySelector("input"), v = mainVal(s.id), isEmpty = !isFinite(v) || (s.empty && !(v > 0));
      if (!isFinite(v)) v = s.min;
      var min = s.min, max = s.max;
      if (s.dynMax) { var loan = mainVal("amount"); max = Math.max(10, isFinite(loan) ? loan : s.max); }
      if (v < min) min = v; if (v > max) max = v;
      inp.min = min; inp.max = max; inp.step = s.step;
      if (dragging !== inp) inp.value = v;
      inp.style.setProperty("--p", ((v - min) / ((max - min) || 1) * 100).toFixed(2) + "%");
      box.querySelector(".pv-sl-val").textContent = isEmpty && s.empty ? s.empty : s.f(v);
    });
    root.querySelectorAll("[data-seg]").forEach(function (box) {
      var id = box.getAttribute("data-seg") === "years" ? "years" : "client-gender", v = mainEl(id).value;
      box.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
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
      if (s.min >= 0 && nv < 0) nv = 0;
      setMain(s.id, parseFloat(nv.toFixed(4)));
      return;
    }
    var sb = e.target.closest("[data-seg] button");
    if (sb) { var id = sb.closest("[data-seg]").getAttribute("data-seg") === "years" ? "years" : "client-gender"; setMain(id, sb.getAttribute("data-v"), "change"); return; }
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

  var SNAP_IDS = ["amount", "rate", "years", "div-rate", "div-principal", "script-ratio", "script-target", "client-age", "client-gender", "stress-rate-bump", "stress-div-rate"];
  function open() {
    snapshot = { v: {}, pfl: (typeof principalFollowsLoan !== "undefined") ? principalFollowsLoan : true, tfl: (typeof targetFollowsLoan !== "undefined") ? targetFollowsLoan : true };
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
    try { principalFollowsLoan = snapshot.pfl; } catch (err) {}
    try { targetFollowsLoan = snapshot.tfl; } catch (err) {}
    if (typeof updateSyncHint === "function") updateSyncHint();
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
