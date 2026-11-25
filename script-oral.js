/* 口語版話術（index.html、dividend.html 共用）：只改話術稿／提詞的念法，畫面數字、圖表、PDF 仍用精確數字。
   頁面需自行宣告 lastScriptPartsOral，並在 updateScript 用 isOralScript() 決定顯示哪一版。 */
/* ---- 口語版話術：只改話術稿／提詞的念法（好念的整數與短句），畫面數字、圖表、PDF 仍用精確數字 ---- */
const ORAL_KEY = "mc_script_oral";
function isOralScript() { try { return localStorage.getItem(ORAL_KEY) === "1"; } catch (e) { return false; } }
function setOralScript(on) {
  try { localStorage.setItem(ORAL_KEY, on ? "1" : "0"); } catch (e) {}
  document.querySelectorAll("[data-oral-toggle]").forEach(function (el) { el.checked = !!on; });
  if (typeof updateScript === "function") updateScript();
  if (typeof window.McPresentRefresh === "function") window.McPresentRefresh();
}
function numOf(s) { return parseFloat(String(s).replace(/,/g, "")); }
function groupInt(n) { return Math.round(n).toLocaleString("zh-TW"); }
function oralYuan(v) {
  if (!isFinite(v)) return null;
  const a = Math.abs(v);
  if (a >= 10000) {
    const w = a / 10000;
    if (w < 10) {
      const r = Math.round(w * 10) / 10, i = Math.floor(r + 1e-9), d = Math.round((r - i) * 10);
      return d ? (i + " 萬 " + d) : (i + " 萬");
    }
    if (w < 100) return Math.round(w) + " 萬";
    return groupInt(Math.round(w / 10) * 10) + " 萬";
  }
  if (a >= 1000) {
    const k = Math.round(a / 100) / 10, i = Math.floor(k + 1e-9), d = Math.round((k - i) * 10);
    return d ? (i + " 千 " + d) : (i + " 千");
  }
  return groupInt(Math.round(a / 10) * 10) + " 元";
}
function oralWan(w) {
  if (!isFinite(w)) return null;
  if (w >= 500) return groupInt(Math.round(w / 50) * 50) + " 萬";
  if (w >= 100) return groupInt(Math.round(w / 10) * 10) + " 萬";
  if (w >= 10) return Math.round(w) + " 萬";
  return (Math.round(w * 10) / 10) + " 萬";
}
function oralPct(p) {
  if (!isFinite(p)) return null;
  if (p < 15) return String(parseFloat(p.toFixed(2))) + "%";
  const x = p / 10, i = Math.floor(x + 1e-9), f = x - i;
  if (f < 0.2) return "約 " + i + " 成";
  if (f >= 0.6) return "快 " + (i + 1) + " 成";
  return i + " 成多";
}
function oralNum(text) {
  let t = String(text);
  // 期間：21 年 5 個月（共 257 個月）→ 21 年多／快 22 年
  t = t.replace(/(\d+) 年 (\d+) 個月（共 \d+ 個月）/g, function (_, y, m) { y = +y; m = +m; return m >= 6 ? ("快 " + (y + 1) + " 年") : (y + " 年多"); });
  t = t.replace(/(\d+) 年（\d+ 個月）/g, "$1 年");
  // 金額（元）
  t = t.replace(/(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)? ?元/g, function (m0, n) {
    const o = oralYuan(numOf(n)); if (!o) return m0;
    return o === m0 ? m0 : ("約 " + o);
  });
  // 萬元（排除萬美元）
  t = t.replace(/(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)? ?萬(?!美元)/g, function (m0, n, dec) {
    const v = numOf(n + (dec || "")), o = oralWan(v); if (!o) return m0;
    return Math.abs(numOf(o) - v) < 1e-9 ? (dec ? o : m0) : ("約 " + o);
  });
  // 比例（%）：15% 以上念成「幾成」，利率、配息率等小於 15% 照念
  t = t.replace(/(\d+(?:\.\d+)?)%/g, function (m0, n) { const v = parseFloat(n); return v >= 15 ? oralPct(v) : (String(parseFloat(v.toFixed(2))) + "%"); });
  // 倍數：8.41 倍 → 8 倍多
  t = t.replace(/(\d+)\.(\d+) 倍/g, function (m0, i, d) { return +("0." + d) >= 0.1 ? (i + " 倍多") : (i + " 倍"); });
  // 數字後面直接接中文時補空格，好念
  t = t.replace(/(萬 \d|千 \d)(?=[\u4e00-\u9fff])/g, "$1 ");
  // 重複的「約」
  t = t.replace(/(大約|大概是|大概|約繳|約)\s*約\s*/g, "$1 ");
  // 中文後面直接接「約」時不留空格（一年配 約 4 萬 → 一年配約 4 萬）
  t = t.replace(/([\u4e00-\u9fff]) 約 /g, "$1約 ");
  // 同一個數字重複念（例：約 49 萬，約 49 萬）只留一次
  t = t.replace(/(約 [^，。、；]{1,12})，\1/g, "$1");
  t = t.replace(/約 (快 |\d+ 成多)/g, "$1").replace(/約可撐 (快 \d+ 年|\d+ 年多)/g, "可撐 $1");
  t = t.replace(/\s{2,}/g, " ");
  return t;
}
function oralSplit(text) {
  // 長句拆短：每句一行，超過 34 字的句子再於逗號處斷行
  const sents = String(text).match(/[^。！？]+[。！？]?/g) || [text];
  return sents.map(function (s) {
    s = s.trim(); if (s.length <= 26) return s;
    const parts = s.split("，").map(function (p, i, arr) { return i < arr.length - 1 ? p + "，" : p; }).filter(Boolean), out = []; let cur = "";
    parts.forEach(function (p) { if ((cur + p).length > 20 && cur) { out.push(cur); cur = p; } else cur += p; });
    if (cur) out.push(cur);
    return out.join("\n");
  }).filter(Boolean).join("\n");
}
function oralizePart(p) {
  if (p.sec) return { sec: oralNum(p.sec) };
  if (p.step) return { step: p.step, text: p.text };
  return { who: p.who, text: oralSplit(oralNum(p.text)) };
}
window.McScriptOral = { isOn: isOralScript, set: setOralScript, num: oralNum, split: oralSplit };
