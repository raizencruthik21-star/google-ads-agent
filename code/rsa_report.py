"""Find responsive search ads with a low click rate AND few leads - read-only, nothing is changed.

For every account in the accounts file, reads the last N days of every enabled
responsive search ad on a live search campaign, and flags an ad when BOTH hold:
  - click rate below 70% of its ad group's (or, alone in its group, its campaign's) and at least --min-impr views
  - leads per click below its ad group's, or no lead at all after at least --min-clicks clicks
Each flagged ad comes with its weakest headlines (Google's "Low" rating) so the fix is visible.
Writing replacement ads is a separate step (/write-ads, created PAUSED, on a human yes).

Accounts file: the same one as search_terms_digest.py (code/cache/digest-accounts.json).

Usage (from the project root, so .env resolves):
  python3 code/rsa_report.py --dry-run           # print the Slack message, post nothing
  python3 code/rsa_report.py                     # post to SLACK_WEBHOOK_URL
  python3 code/rsa_report.py --days 30 --min-impr 300 --min-clicks 15
"""

import argparse
import json
import os
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.getcwd(), ".env"))
from _common import load_client  # noqa: E402


def client_for(acct):
    main = os.environ.get("_MAIN_REFRESH_TOKEN") or os.environ.get("GOOGLE_ADS_REFRESH_TOKEN")
    os.environ["_MAIN_REFRESH_TOKEN"] = main
    os.environ["GOOGLE_ADS_REFRESH_TOKEN"] = os.environ["GOOGLE_ADS_REFRESH_TOKEN_MCC"] if acct.get("token") == "second" else main
    os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] = acct.get("login", "")
    client, _ = load_client()
    return client.get_service("GoogleAdsService")


def ads(ga, cid, days):
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    q = f"""SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id,
                   ad_group_ad.ad_strength, metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros
            FROM ad_group_ad
            WHERE segments.date BETWEEN '{start}' AND '{end}'
              AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' AND ad_group_ad.status = 'ENABLED'
              AND ad_group.status = 'ENABLED' AND campaign.status = 'ENABLED'
              AND campaign.advertising_channel_type = 'SEARCH'"""
    out = {}
    for r in ga.search(customer_id=cid, query=q):
        a = out.setdefault(r.ad_group_ad.ad.id, {"campaign": r.campaign.name, "campaign_id": r.campaign.id,
                                                  "ad_group": r.ad_group.name, "ad_group_id": r.ad_group.id,
                                                  "strength": r.ad_group_ad.ad_strength.name,
                                                  "impr": 0, "clicks": 0, "conv": 0.0, "cost": 0.0})
        a["impr"] += r.metrics.impressions
        a["clicks"] += r.metrics.clicks
        a["conv"] += r.metrics.conversions
        a["cost"] += r.metrics.cost_micros / 1e6
    return out


def low_headlines(ga, cid, ad_ids):
    if not ad_ids:
        return {}
    ids = ",".join(str(i) for i in ad_ids)
    q = f"""SELECT ad_group_ad.ad.id, asset.text_asset.text, ad_group_ad_asset_view.field_type,
                   ad_group_ad_asset_view.performance_label
            FROM ad_group_ad_asset_view
            WHERE ad_group_ad.ad.id IN ({ids}) AND ad_group_ad_asset_view.enabled = TRUE
              AND ad_group_ad_asset_view.performance_label = 'LOW'"""
    out = defaultdict(list)
    try:
        for r in ga.search(customer_id=cid, query=q):
            out[r.ad_group_ad.ad.id].append(r.asset.text_asset.text)
    except Exception:
        pass  # ratings are a bonus; the flag stands without them
    return out


def flag(all_ads, min_impr, min_clicks):
    groups = defaultdict(list)
    camps = defaultdict(list)
    for i, a in all_ads.items():
        groups[a["ad_group_id"]].append(a)
        camps[a["campaign_id"]].append(a)
    rate = lambda xs, n, d: (sum(x[n] for x in xs) / sum(x[d] for x in xs)) if sum(x[d] for x in xs) else 0
    flagged = []
    for i, a in all_ads.items():
        if a["impr"] < min_impr:
            continue
        peers = [x for x in groups[a["ad_group_id"]] if x is not a]
        if not peers:
            peers = [x for x in camps[a["campaign_id"]] if x is not a]
        if not peers:
            continue
        ctr, peer_ctr = a["clicks"] / a["impr"], rate(peers, "clicks", "impr")
        cvr, peer_cvr = (a["conv"] / a["clicks"] if a["clicks"] else 0), rate(peers, "conv", "clicks")
        low_ctr = peer_ctr and ctr < 0.7 * peer_ctr
        low_conv = (a["conv"] == 0 and a["clicks"] >= min_clicks) or (peer_cvr and a["clicks"] >= min_clicks and cvr < peer_cvr)
        if low_ctr and low_conv:
            flagged.append(dict(a, id=i, ctr=ctr, peer_ctr=peer_ctr, cvr=cvr, peer_cvr=peer_cvr, watch=False))
        elif low_ctr and a["clicks"] < min_clicks:  # weak click rate, too few clicks to judge leads yet
            flagged.append(dict(a, id=i, ctr=ctr, peer_ctr=peer_ctr, cvr=cvr, peer_cvr=peer_cvr, watch=True))
    return sorted(flagged, key=lambda x: (x["watch"], -x["cost"]))


def build(accounts, days, min_impr, min_clicks):
    blocks, errors, n, n_watch, n_ads, n_judged = [], [], 0, 0, 0, 0
    for acct in accounts:
        try:
            ga = client_for(acct)
            all_ads = ads(ga, acct["id"], days)
            n_ads += len(all_ads)
            n_judged += sum(1 for a in all_ads.values() if a["impr"] >= min_impr)
            found = flag(all_ads, min_impr, min_clicks)
            lows = low_headlines(ga, acct["id"], [f["id"] for f in found])
        except Exception as e:
            errors.append(f"{acct['name']}: could not read ({type(e).__name__})")
            continue
        if not found:
            continue
        weak = [f for f in found if not f["watch"]]
        n += len(weak)
        n_watch += len(found) - len(weak)
        lines = [f"*{acct['name']}* · {len(weak)} weak · {len(found) - len(weak)} to watch"]
        for f in found[:5]:
            tag = ":eyes: watch" if f["watch"] else ":red_circle: weak"
            lines.append(f"   {tag} · {f['campaign']} › {f['ad_group']} · ${f['cost']:,.0f} spent")
            lines.append(f"      click rate {f['ctr']:.1%} vs {f['peer_ctr']:.1%} for its neighbours · "
                         f"{f['conv']:.0f} leads from {f['clicks']} clicks vs {f['peer_cvr']:.0%} lead rate")
            low = lows.get(f["id"], [])[:3]
            if low:
                lines.append("      rated Low: " + " · ".join(f"`{t}`" for t in low))
            lines.append(f"      <https://ads.google.com/aw/ads?campaignId={f['campaign_id']}&__c={acct['id']}|open the ads>")
        blocks.append("\n".join(lines))
    stamp = datetime.now(timezone.utc).strftime("%d %b %Y")
    head = (f":bar_chart: *Ad check* · {stamp} · last {days} days\n"
            f":red_circle: {n} weak: low click rate AND fewer leads than the ads beside them\n"
            f":eyes: {n_watch} to watch: low click rate, not enough clicks yet to judge leads\n"
            f"Only {n_judged} of {n_ads} live ads had {min_impr}+ views, enough to judge. Nothing has been changed.")
    body = "\n\n".join(blocks) if blocks else "No weak ads this time. Every ad is keeping up with its neighbours."
    foot = ("Leads only started counting properly around 14 to 16 October, so lead rates firm up over the next few weeks.\n"
            "To replace an ad, tell Claude which one. New ads are created PAUSED for you to switch on.")
    if errors:
        foot += "\n" + "\n".join(f":x: {e}" for e in errors)
    return f"{head}\n\n{body}\n\n{foot}"


def post(text):
    url = os.environ.get("SLACK_WEBHOOK_URL")
    if not url:
        sys.exit("SLACK_WEBHOOK_URL is not set in .env")
    req = urllib.request.Request(url, data=json.dumps({"text": text}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--accounts", default="code/cache/digest-accounts.json")
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--min-impr", type=int, default=300, help="ignore ads with fewer views than this")
    ap.add_argument("--min-clicks", type=int, default=15, help="clicks before 'no lead' counts against an ad")
    ap.add_argument("--dry-run", action="store_true", help="print the message, post nothing")
    args = ap.parse_args()
    text = build(json.load(open(args.accounts)), args.days, args.min_impr, args.min_clicks)
    if args.dry_run:
        print(text)
        return
    print("posted, status", post(text))


if __name__ == "__main__":
    main()
