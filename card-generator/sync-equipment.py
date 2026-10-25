"""Refresh the local SRD equipment library and openly licensed artwork."""
import json
import re
import urllib.request
import sys
import zipfile
from urllib.error import HTTPError
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = "https://api.open5e.com/v2/"


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "CardPress/1.0 (local SRD library)"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def records(endpoint):
    url = f"{API}{endpoint}/?document=srd-2024&limit=500&format=json"
    result = []
    while url:
        page = json.loads(download(url))
        result.extend(page["results"])
        url = page["next"]
    filtered = [row for row in result if row["document"]["key"] == "srd-2024"]
    print(f"{endpoint}: {len(filtered)} SRD 2024 records; excluded {len(result) - len(filtered)} other-source records.", flush=True)
    if not filtered:
        raise ValueError(f"No SRD-2024 {endpoint} records were returned")
    return filtered


def image_key(name, category):
    text = name.lower()
    for pattern, key in [
        (r"crossbow", "crossbow"), (r"\bbow\b|longbow|shortbow", "bow"),
        (r"arrow|bolt|ammunition", "arrows"), (r"axe|halberd", "axe"),
        (r"sword|scimitar|rapier|saber", "sword"), (r"dagger|knife", "dagger"),
        (r"hammer|maul|pick", "hammer"), (r"spear|javelin|pike|trident|glaive", "spear"),
        (r"shield", "shield"), (r"armor|mail|breastplate|plate|splint|leather|padded", "armor"),
        (r"potion|poison|acid|oil|antitoxin|alchemist", "potion"),
        (r"ring", "ring"), (r"scroll|spellbook|book", "book"),
        (r"wand|rod|staff|quarterstaff", "staff"),
        (r"rope", "rope"), (r"torch|lantern|lamp|candle", "torch"),
        (r"pack|bag|pouch|sack", "pack"), (r"gem|diamond|ruby|pearl|crystal", "gem"),
        (r"boots|shoes|slippers", "boots"), (r"cloak|robe|clothes|vest", "cloak"),
        (r"tool|kit|supplies|instruments", "tools"),
    ]:
        if re.search(pattern, text) or re.search(pattern, category.lower()):
            return key
    return "weapon" if category == "Weapon" else "item"


def main():
    if len(sys.argv) == 2:
        if sys.argv[1] == "--icons":
            sync_icons()
        else:
            extract_art(Path(sys.argv[1]))
        return
    weapons = {row["key"]: row for row in records("weapons")}
    base = records("items")
    magic = records("magicitems")
    merged = {row["key"]: row for row in base}
    merged.update({row["key"]: row for row in magic})
    magic_keys = {row["key"] for row in magic}
    item_magic_rarities = {
        "Potion of Healing": "Common",
        "Potions of Healing": "Varies",
        "Potion of Giant Strength": "Varies",
        "Ioun Stone": "Varies",
        "Spell Scroll": "Varies",
    }
    output = []
    for row in merged.values():
        weapon = row.get("weapon")
        if weapon:
            weapon = {**weapon, **weapons.get(weapon["key"], {})}
        armor = row.get("armor")
        category = row["category"]["name"]
        properties = weapon.get("properties", []) if weapon else []
        property_names = [
            p["property"]["name"] + (f" ({p['detail']})" if p.get("detail") else "")
            for p in properties if p["property"].get("type") != "Mastery"
        ]
        mastery = [p["property"]["name"] for p in properties if p["property"].get("type") == "Mastery"]
        desc = row.get("desc") or f"{row['name']}: {category}."
        rules = [f"**{p['property']['name']}{' (' + p['detail'] + ')' if p.get('detail') else ''}.** {p['property']['desc']}" for p in properties]
        if armor:
            if armor.get("grants_stealth_disadvantage"):
                rules.append("**Stealth.** Wearing this armor imposes Disadvantage on Dexterity (Stealth) checks.")
            if armor.get("strength_score_required"):
                rules.append(f"**Strength.** Requires Strength {armor['strength_score_required']} to avoid the armor's Speed penalty.")
        if row.get("attunement_detail"):
            rules.append(f"**Attunement.** {row['attunement_detail']}")
        if rules:
            desc += "\n\n" + "\n\n".join(rules)
        is_variant = row["key"] in magic_keys
        is_magic = is_variant or row["name"] in item_magic_rarities
        range_normal = weapon.get("range", 0) if weapon else 0
        range_long = weapon.get("long_range", 0) if weapon else 0
        range_text = f"{range_normal}{'/' + str(range_long) if range_long else ''} ft" if range_normal else ("5 ft" if weapon else "")
        if weapon and any(p["property"]["name"] == "Reach" for p in properties):
            range_text = "10 ft"
        kind = "weapon" if category == "Weapon" else "item"
        output.append({
            "key": "equipment-" + row["key"], "kind": kind, "name": row["name"],
            "category": category, "rarity": row.get("rarity", {}).get("name", item_magic_rarities.get(row["name"], "Mundane")),
            "magic": is_magic, "attunement": bool(row.get("requires_attunement")),
            "cost": f"{float(row['cost']):g} gp" if row.get("cost") and float(row["cost"]) > 0 else ("Not listed" if is_magic else "0 gp"),
            "weight": f"{float(row['weight']):g} {row.get('weight_unit', 'lb')}" if row.get("weight") is not None else "Not listed",
            "damage_roll": weapon.get("damage_dice", "") if weapon else "",
            "damage_types": [weapon["damage_type"]["key"]] if weapon and weapon.get("damage_type") else [],
            "range_text": range_text, "properties": ", ".join(property_names),
            "mastery": ", ".join(mastery), "armor_class": armor.get("ac_display", "") if armor else "",
            "weapon_type": ("Simple" if weapon.get("is_simple") else "Martial") if weapon else "",
            "desc": desc, "image": image_key(row["name"], category),
            "source": {"name": "SRD 5.2", "url": API + ("magicitems" if is_variant else "items") + "/" + row["key"] + "/", "license": "CC BY 4.0"},
        })
    output.sort(key=lambda row: row["name"])
    (ROOT / "data" / "equipment-2024-srd.json").write_text(json.dumps(output, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(output)} equipment records ({sum(r['kind'] == 'weapon' for r in output)} weapons).", flush=True)
    sync_icons()


def sync_icons():
    icons = {
        "sword": ("lorc", "broadsword"), "dagger": ("lorc", "plain-dagger"),
        "axe": ("lorc", "battle-axe"), "hammer": ("lorc", "hammer-drop"),
        "spear": ("lorc", "spear-hook"), "bow": ("lorc", "pocket-bow"),
        "crossbow": ("carl-olsen", "crossbow"), "arrows": ("lorc", "arrow-cluster"),
        "armor": ("lorc", "breastplate"), "shield": ("willdabeast", "round-shield"),
        "potion": ("lorc", "potion-ball"), "ring": ("delapouite", "ring"),
        "book": ("delapouite", "spell-book"), "staff": ("lorc", "wizard-staff"),
        "rope": ("delapouite", "lasso"), "torch": ("delapouite", "torch"),
        "pack": ("lorc", "knapsack"), "gem": ("lorc", "emerald"),
        "boots": ("lorc", "boots"), "cloak": ("lorc", "cloak-dagger"),
        "tools": ("lorc", "anvil-impact"), "weapon": ("lorc", "crossed-swords"),
        "item": ("lorc", "locked-chest"),
    }
    directory = ROOT / "img" / "equipment"
    directory.mkdir(exist_ok=True)
    failures = []
    for key, (author, slug) in icons.items():
        path = directory / f"{key}.svg"
        if not path.exists():
            url = f"https://game-icons.net/icons/000000/transparent/1x1/{author}/{slug}.svg"
            try:
                svg = download(url).decode("utf-8")
            except HTTPError as error:
                print(f"FAILED {key}: {url}: {error}", flush=True)
                failures.append(key)
                continue
            svg = re.sub(r'<path[^>]*d="M0 0h512v512H0z"[^>]*/>', "", svg)
            svg = svg.replace('fill="#000"', 'fill="#0a5c73"')
            path.write_text(svg, encoding="utf-8")
        print(f"Artwork: {key}", flush=True)
    if failures:
        raise RuntimeError(f"Artwork unavailable: {', '.join(failures)}")


def extract_art(archive):
    directory = ROOT / "img" / "equipment"
    directory.mkdir(exist_ok=True)
    art = {
        "sword": "upg_sword", "dagger": "dagger", "axe": "axe",
        "hammer": "hammer", "spear": "upg_spear", "bow": "bow",
        "armor": "armor", "shield": "shield", "potion": "potionRed",
        "book": "tome", "staff": "wand", "pack": "backpack",
        "gem": "gemBlue", "tools": "tools", "scroll": "scroll",
    }
    with zipfile.ZipFile(archive) as source:
        for key, name in art.items():
            (directory / f"art-{key}.png").write_bytes(source.read(f"512/{name}.png"))
            print(f"Hand-painted artwork: {key}")


if __name__ == "__main__":
    main()
