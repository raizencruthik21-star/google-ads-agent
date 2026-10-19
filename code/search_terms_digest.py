"""Post a search terms digest to Slack - read-only, nothing is negated here.

Pulls yesterday and today's search terms for every account in the accounts file,
keeps the ones that cost money, brought no lead and are not already blocked or
a keyword, and posts the top ones per account to Slack. Terms containing a word
already approved as a negative somewhere are listed first as "likely junk".
Adding negatives stays a separate step with a dry run and a human yes.

Accounts file (JSON list), default code/cache/digest-accounts.json:
  [{"id": "9639711048", "name": "All Clear", "login": "9644271246", "token": "main"}, ...]
  token "main" uses GOOGLE_ADS_REFRESH_TOKEN, "second" uses GOOGLE_ADS_REFRESH_TOKEN_MCC.
  login "" means direct access.

Usage (from the project root, so .env resolves):
  python3 code/search_terms_digest.py --dry-run      # print the Slack message, post nothing
  python3 code/search_terms_digest.py                # post to SLACK_WEBHOOK_URL
  python3 code/search_terms_digest.py --min-cost 10 --per-account 6
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.getcwd(), ".env"))
from _common import load_client  # noqa: E402

# Words already approved as negatives in at least one account. A new term containing one is "likely junk".
JUNK_WORDS = ["pumping", "pumped", "septic service", "septic tank service", "septic tank maintenance", "emptying",
              "plumber", "debris", "how to", "best way to", "best thing to use", "what kills", "what kill",
              "what do you use", "what does", "cigarette", "ozone machine", "mold armor", "glassguard",
              "mildew cleaner", "ermi", "hertsmi", "sealant", "insulation", "sill plate", "cheapest",
              "fix a hole", "jobs", "salary", "hiring", "diy", "youtube", "reddit", "chem master", "chemmaster"]


def tok(s):
    return re.findall(r"[a-z0-9$']+", s.lower())


def has_phrase(term, phrase):
    t, p = tok(term), tok(phrase)
    return any(t[i:i + len(p)] == p for i in range(len(t) - len(p) + 1))


def pull(acct):
    """Search terms for yesterday and today, summed per term. Not already excluded or added."""
    main = os.environ.get("_MAIN_REFRESH_TOKEN") or os.environ.get("GOOGLE_ADS_REFRESH_TOKEN")
    os.environ["_MAIN_REFRESH_TOKEN"] = main
    os.environ["GOOGLE_ADS_REFRESH_TOKEN"] = os.environ["GOOGLE_ADS_REFRESH_TOKEN_MCC"] if acct.get("token") == "second" else main
    os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] = acct.get("login", "")
    client, _ = load_client()
    ga = client.get_service("GoogleAdsService")
    q = """SELECT search_term_view.search_term, search_term_view.status, campaign.name,
                  metrics.cost_micros, metrics.clicks, metrics.conversions
           FROM search_term_view
           WHERE segments.date BETWEEN '%s' AND '%s'""" % date_window()
    negs = negatives(ga, acct["id"])
    terms = {}
    for r in ga.search(customer_id=acct["id"], query=q):
        if r.search_term_view.status.name in ("EXCLUDED", "ADDED", "ADDED_EXCLUDED"):
            continue
        if blocked(r.search_term_view.search_term, negs):  # blocked since it was searched
            continue
        t = terms.setdefault(r.search_term_view.search_term, {"cost": 0.0, "clicks": 0, "conv": 0.0, "campaign": r.campaign.name})
        t["cost"] += r.metrics.cost_micros / 1e6
        t["clicks"] += r.metrics.clicks
        t["conv"] += r.metrics.conversions
    return terms


def negatives(ga, cid):
    """Campaign and ad group negatives on live campaigns, as (text, match)."""
    out = set()
    for q in ("SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type, campaign.status FROM campaign_criterion "
              "WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD' AND campaign.status = 'ENABLED'",
              "SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.status FROM ad_group_criterion "
              "WHERE ad_group_criterion.negative = TRUE AND ad_group_criterion.type = 'KEYWORD' AND campaign.status = 'ENABLED'"):
        for r in ga.search(customer_id=cid, query=q):
            k = r.campaign_criterion.keyword if "campaign_criterion" in q.split("FROM")[1] else r.ad_group_criterion.keyword
            out.add((k.text.lower(), k.match_type.name))
    return out


def blocked(term, negs):
    t = tok(term)
    for text, match in negs:
        n = tok(text)
        if not n:
            continue
        if match == "EXACT" and t == n:
            return True
        if match == "PHRASE" and any(t[i:i + len(n)] == n for i in range(len(t) - len(n) + 1)):
            return True
        if match == "BROAD" and set(n) <= set(t):
            return True
    return False


def date_window():
    today = date.today()
    return (today - timedelta(days=1)).isoformat(), today.isoformat()


def build(accounts, min_cost, per_account):
    lines, total_review, errors = [], 0.0, []
    for acct in accounts:
        try:
            terms = pull(acct)
        except Exception as e:  # one bad account must not kill the digest
            errors.append(f"{acct['name']}: could not read ({type(e).__name__})")
            continue
        spend = sum(t["cost"] for t in terms.values())
        leads = sum(t["conv"] for t in terms.values())
        review = [(k, v) for k, v in terms.items() if v["conv"] == 0 and v["cost"] >= min_cost]
        junk = [(k, v) for k, v in review if any(has_phrase(k, w) for w in JUNK_WORDS)]
        rest = [(k, v) for k, v in review if (k, v) not in junk]
        if not review:
            continue
        total_review += sum(v["cost"] for _, v in review)
        out = [f"*{acct['name']}* · ${spend:,.0f} spent · {leads:.0f} leads · {len(review)} to review"]
        for k, v in sorted(junk, key=lambda x: -x[1]["cost"])[:per_account]:
            out.append(f"   :warning: `{k}` · ${v['cost']:,.0f} · likely junk")
        for k, v in sorted(rest, key=lambda x: -x[1]["cost"])[:max(0, per_account - len(junk))]:
            out.append(f"   `{k}` · ${v['cost']:,.0f}")
        lines.append("\n".join(out))
    stamp = datetime.now(timezone.utc).strftime("%d %b %H:%M UTC")
    head = (f":mag: *Search terms digest* · {stamp} · yesterday and today\n"
            f"${total_review:,.0f} on searches with no lead yet, over ${min_cost:.0f} each. Nothing has been blocked.")
    body = "\n\n".join(lines) if lines else "Nothing over the threshold. All quiet."
    foot = "To block any of these, tell Claude \"add these\" with the account. It shows a dry run first."
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
    ap.add_argument("--min-cost", type=float, default=10.0, help="only list terms that cost at least this")
    ap.add_argument("--per-account", type=int, default=6, help="max terms listed per account")
    ap.add_argument("--dry-run", action="store_true", help="print the message, post nothing")
    args = ap.parse_args()
    accounts = json.load(open(args.accounts))
    text = build(accounts, args.min_cost, args.per_account)
    if args.dry_run:
        print(text)
        return
    print("posted, status", post(text))


if __name__ == "__main__":
    main()
