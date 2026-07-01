"""Apply Milk & Honey business-rule defaults to the imported CBW orders (live DB).

Rules (owner-specified):
  * hair_type -> 'Peruvian' unless a specific origin is given
  * density   -> '150%' unless specified (normalise 1.5 -> 150%)
  * cap_size  -> present on every order (derive from cap style term where possible)
  * BOB       -> supplier length = the SAME stated length (no -2"), fix 'INCG' -> 'INCH',
                 and a bob is a normal made_to_order (not needs_review)
Reads the imported orders from Supabase and PATCHes each. Reports cap sizes still missing.
"""
import re, json, argparse, requests

ENV = "/Users/yasmintolley/mhw-production-portal/.env.local"
SUPPLIER = "China Best Wigs"
SIZE_TERMS = {"petite": "S (Petite)", "regular": "M (Regular)", "medium": "M (Medium)",
              "large": "L (Large)", "small": "S", "xs": "XS", "\bs\b": "S", "\bm\b": "M", "\bl\b": "L"}

def env(k):
    for line in open(ENV):
        if line.startswith(k+'='): return line.split('=',1)[1].strip()

def norm_density(d):
    if not d: return "150%"
    s = str(d).strip()
    if "%" in s: return s
    try:
        f = float(s); return f"{int(round(f*100))}%" if f < 10 else f"{int(round(f))}%"
    except ValueError:
        return s

def norm_hair(h):
    s = (h or "").strip()
    return "Peruvian" if (not s or s.lower() in ("human hair", "hair")) else s

def cap_from_style(cs):
    s = (cs or "").strip().lower()
    for term, mapped in SIZE_TERMS.items():
        if re.search(term, s): return mapped
    return None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--commit', action='store_true'); a = ap.parse_args()
    URL, KEY = env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY')
    H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    sup = requests.get(f"{URL}/rest/v1/suppliers?name=eq.{SUPPLIER}&select=id", headers=H).json()
    sid = sup[0]['id']
    orders = requests.get(f"{URL}/rest/v1/orders?supplier_id=eq.{sid}&select=id,order_number,hair_type,density,cap_size,cap_style,customer_ordered_length,supplier_order_length,order_type,status&limit=1000", headers=H).json()
    print(f"orders to process: {len(orders)}")

    updated = 0; bobs = 0; missing_cap = []
    for o in orders:
        patch = {}
        # hair + density
        nh = norm_hair(o.get('hair_type')); nd = norm_density(o.get('density'))
        if nh != o.get('hair_type'): patch['hair_type'] = nh
        if nd != o.get('density'): patch['density'] = nd
        # cap size on every line
        cap = (o.get('cap_size') or '').strip()
        if not cap:
            derived = cap_from_style(o.get('cap_style'))
            if derived: patch['cap_size'] = derived
            else: missing_cap.append(o['order_number'])
        # bob handling
        col = (o.get('customer_ordered_length') or '')
        fixed = col.replace('INCG', 'INCH').replace('incg', 'INCH')
        if fixed != col: patch['customer_ordered_length'] = fixed
        if 'BOB' in fixed.upper():
            bobs += 1
            nums = re.findall(r'\d+', fixed)
            if nums:
                patch['supplier_order_length'] = nums[0]  # same length as ordered, no -2"
            if o.get('order_type') == 'needs_review':
                patch['order_type'] = 'made_to_order'
            if o.get('status') == 'manager_review_required':
                patch['status'] = 'new_made_to_order'
        if patch and a.commit:
            res = requests.patch(f"{URL}/rest/v1/orders?id=eq.{o['id']}", headers=H, data=json.dumps(patch))
            if res.status_code < 300: updated += 1
            else: print("fail", o['order_number'], res.text[:120])
        elif patch:
            updated += 1

    print(f"{'UPDATED' if a.commit else 'WOULD UPDATE'}: {updated} | bobs corrected: {bobs}")
    print(f"cap size STILL missing (need from you): {len(missing_cap)}")
    if missing_cap: print("  " + ", ".join(sorted(missing_cap)))
    if not a.commit: print("\n(dry run — add --commit to apply)")

if __name__ == "__main__": main()
