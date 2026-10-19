"""Post a budget pacing update to Slack - read-only, no budget is changed.

For every account in the accounts file: spend this month up to yesterday, where
that puts the month at the current rate, and how that compares with the client's
agreed monthly budget from the targets file. An account with no agreed budget gets
no red or yellow light, only a comparison with last month: the live campaign budgets
are not a fair yardstick, because Local Services and pay-per-lead campaigns carry
caps far above what they ever spend.

Accounts file: the same one as search_terms_digest.py (code/cache/digest-accounts.json).
Targets file (optional), default code/cache/budget-targets.json:
  {"9639711048": 6000, "1169544260": {"budget": 2000, "default": true}}
  A plain number is the client's agreed monthly budget. {"budget": N, "default": true} is a
  placeholder used until the agreed number is known, and is labelled "default" in Slack.

Usage (from the project root, so .env resolves):
  python3 code/budget_pacing.py --dry-run      # print the Slack message, post nothing
  python3 code/budget_pacing.py                # post to SLACK_WEBHOOK_PACING
"""

import argparse
import calendar
import json
import os
import sys
import urllib.request
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.getcwd(), ".env"))
from _common import load_client  # noqa: E402

UNDER, OVER = 0.90, 1.10  # projected month within 90-110% of plan counts as on pace


def client_for(acct):
    main = os.environ.get("_MAIN_REFRESH_TOKEN") or os.environ.get("GOOGLE_ADS_REFRESH_TOKEN")
    os.environ["_MAIN_REFRESH_TOKEN"] = main
    os.environ["GOOGLE_ADS_REFRESH_TOKEN"] = os.environ["GOOGLE_ADS_REFRESH_TOKEN_MCC"] if acct.get("token") == "second" else main
    os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"] = acct.get("login", "")
    client, _ = load_client()
    return client.get_service("GoogleAdsService")


def read(ga, cid, first, yesterday):
    spend = sum(r.metrics.cost_micros for r in ga.search(customer_id=cid, query=(
        f"SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '{first}' AND '{yesterday}'"))) / 1e6
    last_end = first - timedelta(days=1)
    last = sum(r.metrics.cost_micros for r in ga.search(customer_id=cid, query=(
        f"SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '{last_end.replace(day=1)}' AND '{last_end}'"))) / 1e6
    budgets, limited, cur = {}, [], "USD"
    for r in ga.search(customer_id=cid, query=(
            "SELECT campaign.name, campaign.primary_status_reasons, campaign_budget.resource_name, "
            "campaign_budget.amount_micros, customer.currency_code FROM campaign "
            "WHERE campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'")):
        budgets[r.campaign_budget.resource_name] = r.campaign_budget.amount_micros / 1e6  # shared budgets count once
        cur = r.customer.currency_code
        if any(x.name == "BUDGET_CONSTRAINED" for x in r.campaign.primary_status_reasons):
            limited.append(r.campaign.name)
    return spend, last, sum(budgets.values()), limited, cur


def build(accounts, targets):
    today = date.today()
    yesterday = today - timedelta(days=1)
    if yesterday.month != today.month:  # 1st of the month: report the month just finished
        today = yesterday + timedelta(days=1)
    first = yesterday.replace(day=1)
    days_in = calendar.monthrange(first.year, first.month)[1]
    elapsed = (yesterday - first).days + 1
    rows, errors = [], []
    for acct in accounts:
        try:
            spend, last, daily, limited, cur = read(client_for(acct), acct["id"], first, yesterday)
        except Exception as e:
            errors.append(f"{acct['name']}: could not read ({type(e).__name__})")
            continue
        target = targets.get(acct["id"])
        is_default = isinstance(target, dict) and target.get("default", False)
        plan = float(target["budget"] if isinstance(target, dict) else target) if target else 0
        projected = spend / elapsed * days_in if elapsed else 0
        if not plan:
            status = "no agreed budget"
        else:
            pct = projected / plan
            status = "under" if pct < UNDER else "over" if pct > OVER else "on pace"
        rows.append(dict(name=acct["name"], spend=spend, projected=projected, plan=plan, last=last, is_default=is_default,
                         daily=daily, status=status, limited=limited, cur=cur,
                         left_per_day=max(plan - spend, 0) / max(days_in - elapsed, 1)))
    icon = {"over": ":red_circle:", "under": ":large_yellow_circle:", "on pace": ":large_green_circle:", "no agreed budget": ":white_circle:"}
    order = {"over": 0, "under": 1, "on pace": 2, "no agreed budget": 3}
    rows.sort(key=lambda r: (order[r["status"]], -r["spend"]))
    money = lambda v, c: f"${v:,.0f}" if c == "USD" else f"{v:,.0f} {c}"
    lines = []
    for r in rows:
        if r["plan"]:
            line = (f"{icon[r['status']]} *{r['name']}* · {money(r['spend'], r['cur'])} so far · "
                    f"heading for {money(r['projected'], r['cur'])} of {money(r['plan'], r['cur'])}"
                    f"{' default' if r['is_default'] else ' agreed'} · last month {money(r['last'], r['cur'])}")
        else:
            line = (f"{icon[r['status']]} *{r['name']}* · {money(r['spend'], r['cur'])} so far · "
                    f"heading for {money(r['projected'], r['cur'])} · last month {money(r['last'], r['cur'])}")
        if r["plan"] and r["spend"] >= r["plan"]:
            line += (f"\n      already {money(r['spend'] - r['plan'], r['cur'])} over the month's budget, "
                     f"search budgets now {money(r['daily'], r['cur'])} a day")
        elif r["status"] in ("over", "under"):
            line += (f"\n      to land on budget: {money(r['left_per_day'], r['cur'])} a day from here, "
                     f"search budgets now {money(r['daily'], r['cur'])} a day")
        if r["limited"]:
            line += f"\n      limited by budget: {', '.join(r['limited'][:3])}"
        lines.append(line)
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in order}
    head = (f":moneybag: *Budget pacing* · {first:%B} day {elapsed} of {days_in} · spend to {yesterday:%d %b}\n"
            f":red_circle: {counts['over']} over · :large_yellow_circle: {counts['under']} under · "
            f":large_green_circle: {counts['on pace']} on pace · :white_circle: {counts['no agreed budget']} with no agreed budget yet\n"
            f"On pace means heading for 90 to 110% of the monthly budget. Nothing has been changed.")
    foot = ""
    if any(r["is_default"] for r in rows if r["plan"]):
        foot = "\"default\" = a $2,000 placeholder until Claude has that client's agreed monthly budget."
    if counts["no agreed budget"]:
        foot += "\n:white_circle: accounts have no budget yet and show last month for comparison."
    if errors:
        foot += "\n" + "\n".join(f":x: {e}" for e in errors)
    return f"{head}\n\n" + "\n".join(lines) + (f"\n\n{foot.strip()}" if foot.strip() else "")


def post(text):
    url = os.environ.get("SLACK_WEBHOOK_PACING")
    if not url:
        sys.exit("SLACK_WEBHOOK_PACING is not set in .env")
    req = urllib.request.Request(url, data=json.dumps({"text": text}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--accounts", default="code/cache/digest-accounts.json")
    ap.add_argument("--targets", default="code/cache/budget-targets.json")
    ap.add_argument("--dry-run", action="store_true", help="print the message, post nothing")
    args = ap.parse_args()
    targets = json.load(open(args.targets)) if os.path.exists(args.targets) else {}
    text = build(json.load(open(args.accounts)), targets)
    if args.dry_run:
        print(text)
        return
    print("posted, status", post(text))


if __name__ == "__main__":
    main()
