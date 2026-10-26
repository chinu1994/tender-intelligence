#!/usr/bin/env python3
"""Manual smoke check against a RUNNING deployment: what does knowledge-base
search return for two organisations? (The automated equivalent is
tests/test_tenant_isolation.py.)

    python scripts/check_tenant_isolation_live.py --a-email a@x.com --b-email b@y.com
"""
import argparse, getpass, json, urllib.request, urllib.error

_args = argparse.ArgumentParser()
_args.add_argument("--base", default="http://localhost:8000")
_args.add_argument("--a-email", required=True)
_args.add_argument("--b-email", required=True)
ARGS = _args.parse_args()
BASE = ARGS.base


def req(method, path, token=None, body=None):
    h, data = {}, None
    if token:
        h["Authorization"] = "Bearer " + token
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, None


def login(email, pw):
    st, j = req("POST", "/auth/login", body={"email": email, "password": pw})
    return j["access_token"]


def strings(o, out=None):
    """collect every string value in a JSON tree"""
    out = [] if out is None else out
    if isinstance(o, dict):
        for v in o.values():
            strings(v, out)
    elif isinstance(o, list):
        for v in o:
            strings(v, out)
    elif isinstance(o, str):
        out.append(o)
    return out


def results_list(j):
    if isinstance(j, list):
        return j
    if isinstance(j, dict):
        for k in ("results", "items", "matches", "hits", "data"):
            if isinstance(j.get(k), list):
                return j[k]
        for v in j.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
    return []


def run(who, token, query, markers):
    st, j = req("POST", "/knowledge-base/search", token, {"query": query})
    items = results_list(j)
    print("\n[%s] search %r -> HTTP %s, %d result(s)" % (who, query, st, len(items)))
    found = False
    for i, it in enumerate(items, 1):
        txt = " ".join(strings(it))
        hit = [m for m in markers if m in txt]
        found = found or bool(hit)
        names = [s for s in strings(it) if s.lower().endswith((".docx", ".pdf", ".xlsx", ".zip"))]
        print("  %2d. file=%s  marker_in_result=%s  text=%.70s" %
              (i, names[:1], hit or "-", " ".join(s for s in strings(it) if s not in names)))
    print("  => marker found INSIDE a result: %s" % found)
    return found


A = login(ARGS.a_email, getpass.getpass(f"Org A password ({ARGS.a_email}): "))
B = login(ARGS.b_email, getpass.getpass(f"Org B password ({ARGS.b_email}): "))

B_MARK = ["ORGB-HISTORICAL-888", "ORGB-CONFIDENTIAL-777", "ORGB-PROPOSAL-999"]
A_MARK = ["BLUEHERON", "ORCHID", "SILVERFOX", "Northfield"]

print("=== 1. Org A searches for Org B's markers (should NOT appear in any result) ===")
leak1 = any([run("A", A, m, B_MARK) for m in B_MARK])
print("\n=== 2. Org B searches for its own marker (sanity: SHOULD appear) ===")
own = run("B", B, "ORGB-HISTORICAL-888", B_MARK)
print("\n=== 3. Org B searches for Org A's content (should NOT appear) ===")
leak2 = any([run("B", B, m, A_MARK) for m in ("BLUEHERON-24X7", "Northfield helpdesk migration")])

print("\n" + "=" * 60)
print("A sees B's data      :", "LEAK" if leak1 else "no leak")
print("B sees A's data      :", "LEAK" if leak2 else "no leak")
print("B finds its own data :", "yes (search works)" if own else "NO (indexing issue, test inconclusive)")