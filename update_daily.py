#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
每日更新房產價值試算／小資退休網站用的市場資料。

匯率
  來源：臺灣銀行牌告匯率 https://rate.bot.com.tw/xrt
  採用「即期賣出」（本行賣出即期匯率）。買美元繳外幣保費時，對應銀行賣出美元的牌價。
  掛牌時間以頁面上「牌價最新掛牌時間」為準。
  優先下載官方當日 CSV（https://rate.bot.com.tw/xrt/flcsv/0/day，即期賣出為 Selling 後的 Spot 欄），
  若遇網站防護則改讀牌告頁表格。

基金配息
  以投資型保單公開基金 API 取得淨值、最近配息與配息頻率，
  年化配息率＝最近一次每單位配息 × 年配息次數 ÷ 淨值（毛利率，未扣手續費）。
  只保留至少一個在售保單可配置的標的（on_sale 篩選與網站現行規則相同）。
  網站「每年配息率」輸入預設 8% 不在此腳本修改。

用法
  python3 update_daily.py
  python3 update_daily.py --repo /path/to/mortgage-calc
  python3 update_daily.py --no-push          只寫檔，不 commit／push
  python3 update_daily.py --no-commit        只寫檔，不 commit

結束碼
  0  成功（有更新並已處理，或資料無變更）
  2  匯率或基金抓取失敗，舊檔保留（已成功的那一項仍會寫入）
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, subprocess, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
TZ = timezone(timedelta(hours=8))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

BOT_PAGE = "https://rate.bot.com.tw/xrt?Lang=zh-TW"
BOT_CSV = "https://rate.bot.com.tw/xrt/flcsv/0/day"

# Public fund APIs (same endpoints used by the existing updater in /workspace/fund).
FUND_API = "https://invest.fubonlife.com.tw"
FUND_LIST = [
    "NGB2", "NGB1", "ACB22", "JFP11", "ACC3", "PBT1", "SCP6", "ACT1",
    "ACB17", "FRB7", "DSP5", "ACC2", "SCP4", "FRB5", "ACE17", "DST3",
]
FUND_SHORT = {
    "NGB2": "高盛新興市場債 X月配",
    "NGB1": "高盛環球非投等債 X月配",
    "ACB22": "聯博全球非投等債 AA月配",
    "JFP11": "摩根多重收益 A月配",
    "ACC3": "聯博多元資產收益 AI(美元)",
    "PBT1": "柏瑞ESG量化多重資產 B(美元)",
    "SCP6": "施羅德環球收益成長 A月配固定2",
    "ACT1": "聯博美國多重資產收益 AI(美元)",
    "ACB17": "聯博房貸收益 AA月配",
    "FRB7": "富蘭克林新興國家固收 A(Mdis)",
    "DSP5": "安聯收益成長 AM(美元)",
    "ACC2": "聯博多元資產收益 AI(台幣)",
    "SCP4": "施羅德環球多元收益 A月配固定",
    "FRB5": "富蘭克林全球債券 A(Mdis)",
    "ACE17": "聯博美國成長 AP總報酬月配",
    "DST3": "安聯AI收益成長 B月配(美元)",
}
PERIODS = {"月配": 12, "季配": 4, "半年配": 2, "年配": 1, "不配息": 0, "不配": 0}


def now_iso():
    return datetime.now(TZ).isoformat(timespec="seconds")


def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        ctype = (r.headers.get("content-type") or "").lower()
        return raw, ctype, r.geturl()


def looks_like_challenge(raw, ctype=""):
    if b"Challenge Validation" in raw[:800]:
        return True
    if "text/html" in ctype and b"Currency," not in raw[:400] and "牌告匯率".encode("utf-8") not in raw[:2000]:
        # might still be a real HTML page; only treat short challenge shells as blocked
        if len(raw) < 5000 and b"Challenge" in raw:
            return True
    return False


def parse_bot_csv(text):
    """Official day CSV: Selling 後的 Spot 欄即「即期賣出」。"""
    lines = [ln.strip() for ln in text.replace("\ufeff", "").splitlines() if ln.strip()]
    if len(lines) < 2:
        return None
    header = [h.strip() for h in lines[0].split(",")]
    # Locate Selling then the Spot column after it
    selling_at = None
    for i, h in enumerate(header):
        if h.lower() == "rate" or h == "Rate":
            pass
        if h.lower() == "selling" or h == "Selling":
            selling_at = i
            break
    # Data rows may encode Buying/Selling as values in the Rate columns
    usd = None
    for ln in lines[1:]:
        cols = [c.strip() for c in ln.split(",")]
        if not cols:
            continue
        if cols[0].upper().startswith("USD"):
            usd = cols
            break
    if not usd:
        return None
    # Format: USD,Buying,cashBuy,spotBuy,...,Selling,cashSell,spotSell,...
    try:
        sell_idx = next(i for i, c in enumerate(usd) if c.lower() == "selling")
        # after Selling: Cash, Spot
        cash_sell = float(usd[sell_idx + 1])
        spot_sell = float(usd[sell_idx + 2])
    except Exception:
        # fallback: 13th 0-based index 12 was sometimes documented as cash sell;
        # prefer named parse only
        return None
    if not (20 < spot_sell < 50):
        return None
    return {
        "usd_twd": spot_sell,
        "usd_twd_kind": "即期賣出",
        "usd_twd_source": "臺灣銀行牌告匯率",
        "cash_sell": cash_sell,
        "via": "csv",
    }


def parse_bot_html(text):
    text = unescape(re.sub(r"\s+", " ", text))
    posted = None
    m = re.search(r"牌價最新掛牌時間：\s*(\d{4}/\d{1,2}/\d{1,2}\s+\d{1,2}:\d{2})", text)
    if m:
        posted = m.group(1).strip()
    # 美金 (USD) then four numbers: 現金買入、現金賣出、即期買入、即期賣出
    m = re.search(
        r"美金\s*\(?USD\)?\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        text,
        re.I,
    )
    if not m:
        return None
    cash_buy, cash_sell, spot_buy, spot_sell = (float(m.group(i)) for i in range(1, 5))
    if not (20 < spot_sell < 50):
        return None
    rec = {
        "usd_twd": spot_sell,
        "usd_twd_kind": "即期賣出",
        "usd_twd_source": "臺灣銀行牌告匯率",
        "usd_twd_posted_at": posted,
        "via": "html",
    }
    if posted:
        rec["usd_twd_date"] = posted.split()[0].replace("/", "-")
    return rec


def fetch_bot_via_playwright():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            accept_downloads=True,
            locale="zh-TW",
            user_agent=UA,
            viewport={"width": 1280, "height": 900},
        )
        page = ctx.new_page()
        page.goto(BOT_PAGE, wait_until="domcontentloaded", timeout=45000)
        for _ in range(15):
            if page.title() != "Challenge Validation":
                break
            page.wait_for_timeout(2000)
        if page.title() == "Challenge Validation":
            browser.close()
            raise RuntimeError("牌告匯率頁仍停留在防護驗證")
        html = page.content()
        text = page.inner_text("body")
        rec = parse_bot_html(text) or parse_bot_html(html)
        # Prefer official CSV if the session can download it
        try:
            with page.expect_download(timeout=8000) as di:
                page.goto(BOT_CSV, wait_until="commit", timeout=15000)
            path = di.value.path()
            raw = open(path, "rb").read()
            if raw and not looks_like_challenge(raw):
                csv_rec = parse_bot_csv(raw.decode("utf-8-sig", "replace"))
                if csv_rec:
                    if rec:
                        csv_rec["usd_twd_posted_at"] = rec.get("usd_twd_posted_at")
                        csv_rec["usd_twd_date"] = rec.get("usd_twd_date")
                    rec = csv_rec
                    rec["via"] = "csv"
        except Exception:
            pass
        browser.close()
        if not rec:
            raise RuntimeError("已開啟牌告頁，但無法解析美元即期賣出")
        return rec


def fetch_fx():
    # 1) official CSV
    try:
        raw, ctype, _ = http_get(BOT_CSV)
        if not looks_like_challenge(raw, ctype):
            rec = parse_bot_csv(raw.decode("utf-8-sig", "replace"))
            if rec:
                return rec
    except Exception as e:
        csv_err = e
    else:
        csv_err = None
    # 2) official HTML
    try:
        raw, ctype, _ = http_get(BOT_PAGE)
        if not looks_like_challenge(raw, ctype):
            rec = parse_bot_html(raw.decode("utf-8", "replace"))
            if rec:
                return rec
    except Exception:
        pass
    # 3) browser (needed when the official site shows a bot challenge)
    try:
        return fetch_bot_via_playwright()
    except Exception as e:
        raise RuntimeError("無法取得臺灣銀行牌告匯率（CSV／頁面／瀏覽器皆失敗：%s）" % e)


def post_json(url, body=None, retries=5):
    data = json.dumps(body or {}).encode()
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": UA,
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                j = json.loads(r.read().decode("utf-8"))
            if j.get("returnCode") != "0000":
                raise RuntimeError("returnCode=%s %s" % (j.get("returnCode"), j.get("message")))
            return j.get("data")
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError("%s 失敗：%s" % (url, last))


def fnum(x):
    try:
        return float(str(x).replace(",", "").replace("%", ""))
    except Exception:
        return None


def iso_date(d):
    return d.replace("/", "-") if d else None


def fund_on_sale(asset):
    ins = asset.get("insurances")
    if not isinstance(ins, list):
        return False
    for p in ins:
        if not isinstance(p, dict):
            continue
        name = (p.get("name") or "")
        if name and "停售" not in name:
            return True
    return False


def fetch_funds():
    assets = {a["assetFbCode"]: a for a in post_json(FUND_API + "/api/asset/getAssets")}
    out = []
    nav_dates = []
    ok = 0
    for code in FUND_LIST:
        a = assets.get(code)
        if not a:
            continue
        if not fund_on_sale(a):
            continue
        nav = fnum(a.get("netAssetValue") if a.get("netAssetValue") is not None else a.get("navPrice"))
        nav_date = iso_date(a.get("navDate"))
        dpu = a.get("dividendPerUnit")
        freq = None
        try:
            info = post_json(FUND_API + "/api/fund/getFundInfo", {"assetFbCode": code}) or {}
            freq = info.get("dividendFrequency")
            risk = info.get("riskLevel") or a.get("riskLevel")
        except Exception:
            risk = a.get("riskLevel")
        try:
            divs = [d for d in (post_json(FUND_API + "/api/fund/getFundDividends", {"assetFbCode": code}) or []) if d.get("status") == "配息"]
            if divs:
                divs.sort(key=lambda d: d["dividendDate"], reverse=True)
                dpu = divs[0].get("dividendPerUnit")
        except Exception:
            pass
        periods = PERIODS.get(freq) if freq else None
        annual = None
        if nav and periods and dpu is not None:
            annual = round(float(dpu) * periods / nav, 6)
        rec = {
            "code": code,
            "name": FUND_SHORT.get(code) or (a.get("assetChName") or code),
            "risk": risk or "",
            "rate": round(annual * 100, 2) if annual is not None else None,
            "nav": nav,
            "nav_date": nav_date,
            "dividend_per_unit": dpu,
            "frequency": freq,
        }
        # Public site must not contain banned words
        blob = json.dumps(rec, ensure_ascii=False)
        if "\u5bcc\u90a6" in blob or "\u5357\u6069" in blob:
            rec["name"] = rec["code"]
        if rec["rate"] is None:
            continue
        out.append(rec)
        if nav_date:
            nav_dates.append(nav_date)
        ok += 1
    if ok == 0:
        raise RuntimeError("基金資料全部抓不到")
    out.sort(key=lambda x: (-(x["rate"] or 0), x["code"]))
    latest_nav = max(nav_dates) if nav_dates else None
    return {
        "updated_at": now_iso(),
        "nav_date": latest_nav,
        "source_note": "團隊官網配息基金頁；年化配息率＝最近一次每單位配息×年配息次數÷淨值（毛利率）",
        "funds": out,
    }


def load_json(path):
    if not os.path.exists(path):
        return None
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return None


def write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fp:
        json.dump(obj, fp, ensure_ascii=False, indent=2)
        fp.write("\n")
    os.replace(tmp, path)


def digest(obj, drop=("updated_at",)):
    o = json.loads(json.dumps(obj))
    for k in drop:
        o.pop(k, None)
    return hashlib.sha256(json.dumps(o, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def normalize_fx(rec):
    posted = rec.get("usd_twd_posted_at")
    date = rec.get("usd_twd_date")
    if posted and not date:
        date = posted.split()[0].replace("/", "-")
    if not date:
        date = datetime.now(TZ).strftime("%Y-%m-%d")
    fx = rec["usd_twd"]
    # keep official precision, strip trailing zeros safely
    fx = float(("%0.6f" % fx).rstrip("0").rstrip(".")) if isinstance(fx, float) else float(fx)
    out = {
        "usd_twd": fx,
        "usd_twd_kind": "即期賣出",
        "usd_twd_source": "臺灣銀行牌告匯率",
        "usd_twd_posted_at": posted or date,
        "usd_twd_date": date.replace("/", "-"),
        "updated_at": now_iso(),
    }
    return out


def git_changed(repo, paths):
    r = subprocess.run(["git", "status", "--porcelain", "--"] + paths, cwd=repo, capture_output=True, text=True)
    return bool(r.stdout.strip())


def maybe_commit_push(repo, paths, message, do_commit, do_push):
    if not do_commit:
        return None
    subprocess.run(["git", "add", "--"] + paths, cwd=repo, check=True)
    if not git_changed(repo, paths):
        # after add, if nothing staged
        r = subprocess.run(["git", "diff", "--cached", "--name-only", "--"] + paths, cwd=repo, capture_output=True, text=True)
        if not r.stdout.strip():
            return None
    subprocess.run(["git", "commit", "-m", message], cwd=repo, check=True)
    sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=repo, text=True).strip()
    if do_push:
        subprocess.run(["git", "push", "origin", "HEAD"], cwd=repo, check=True)
    return sha


def main():
    ap = argparse.ArgumentParser(description="更新試算網站的匯率與基金配息資料")
    ap.add_argument("--repo", default=HERE, help="網站檔案目錄（預設為本腳本所在目錄）")
    ap.add_argument("--no-commit", action="store_true")
    ap.add_argument("--no-push", action="store_true")
    args = ap.parse_args()
    repo = os.path.abspath(args.repo)
    market_path = os.path.join(repo, "market.json")
    funds_path = os.path.join(repo, "funds.json")

    errors = []
    wrote = []
    fx_info = None
    funds_info = None

    try:
        rec = fetch_fx()
        market = normalize_fx(rec)
        old = load_json(market_path)
        if old and digest(old) == digest(market):
            print("匯率無變更：即期賣出 %s（掛牌 %s）" % (market["usd_twd"], market["usd_twd_posted_at"]))
            fx_info = old or market
        else:
            write_json(market_path, market)
            wrote.append("market.json")
            print("已更新匯率：美元兌台幣即期賣出 %s（臺灣銀行牌告，掛牌 %s，取自 %s）" % (
                market["usd_twd"], market["usd_twd_posted_at"], rec.get("via")))
            fx_info = market
    except Exception as e:
        errors.append("匯率：" + str(e))
        print("匯率抓取失敗，保留舊值：%s" % e, file=sys.stderr)
        fx_info = load_json(market_path)

    try:
        funds = fetch_funds()
        old = load_json(funds_path)
        old_rates = {f["code"]: f.get("rate") for f in (old or {}).get("funds") or []}
        new_rates = {f["code"]: f.get("rate") for f in funds["funds"]}
        changed = [c for c in new_rates if old_rates.get(c) != new_rates[c]]
        added = [c for c in new_rates if c not in old_rates]
        removed = [c for c in old_rates if c not in new_rates]
        if old and digest(old) == digest(funds):
            print("基金無變更：%d 檔在售" % len(funds["funds"]))
            funds_info = old
        else:
            write_json(funds_path, funds)
            wrote.append("funds.json")
            print("已更新基金：在售 %d 檔，配息率變動 %d 檔%s；淨值日期 %s" % (
                len(funds["funds"]),
                len(changed),
                ("（" + ",".join(changed) + "）") if changed else "",
                funds.get("nav_date") or "—",
            ))
            if added:
                print("  新增：%s" % ",".join(added))
            if removed:
                print("  已排除：%s" % ",".join(removed))
            funds_info = funds
    except Exception as e:
        errors.append("基金：" + str(e))
        print("基金抓取失敗，保留舊值：%s" % e, file=sys.stderr)
        funds_info = load_json(funds_path)

    sha = None
    if wrote:
        msg = "更新市場資料："
        parts = []
        if "market.json" in wrote and fx_info:
            parts.append("美元兌台幣即期賣出 %s" % fx_info.get("usd_twd"))
        if "funds.json" in wrote and funds_info:
            parts.append("基金配息 %d 檔" % len(funds_info.get("funds") or []))
        msg += "、".join(parts) if parts else "、".join(wrote)
        try:
            sha = maybe_commit_push(
                repo,
                wrote,
                msg,
                do_commit=not args.no_commit,
                do_push=(not args.no_commit) and (not args.no_push),
            )
            if sha:
                print("已提交 %s%s" % (sha, "" if args.no_push else " 並推送"))
        except Exception as e:
            errors.append("git：" + str(e))
            print("寫檔已完成，但 commit／push 失敗：%s" % e, file=sys.stderr)
    else:
        if not errors:
            print("資料無變更，不提交")

    if errors:
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
