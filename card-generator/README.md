# Adventure Card Press

Serve the repository with a local web server and open `card-generator/`.
For example, run `python -m http.server 8000` from the repository root and open
<http://localhost:8000/card-generator/>. 
Or use githubpages version <https://nic00l.github.io/dnd/>

## Libraries and custom cards

Choose **Spells**, **Weapons**, or **Items** from the top tabs. The built-in
equipment library includes 203 standard SRD 5.2 equipment entries and 760
magic-item variants (963 entries total). Weapons include mundane and magic
weapons; Items includes armor, shields, gear, tools, and other magic items.
Use category, rarity, source, and text filters to narrow equipment results.
Selections are shared across tabs, so all three types can be printed together.

The Weapons library also includes the homebrew **Sword of Xenu's glory**, an
Artifact relic with the standard longsword stats and its own glowing artwork.
It always emits bright light for 10 feet and dim light for an additional 10 feet.
Search its name to find it. Edit its text and stats in
[custom-equipment.json](./data/custom-equipment.json), then refresh the page.
This file is loaded alongside the SRD library and may contain more equipment
records with unique keys; use an empty array (`[]`) for no additional records.

Use **+ Custom card** on a tab to create that kind of card. Equipment supports
damage, range, properties/charges, mastery, armor class, rarity, attunement,
cost, weight, descriptions, and illustrations. **Customize** beside built-in
equipment creates an editable custom copy without modifying the library.
Descriptions are measured in the card layout before splitting. Near-fit spell
descriptions use slightly tighter line spacing without reducing the font size;
longer descriptions are split into continuation cards.

Illustrations use the supplied item cutouts where available, with hand-painted
Ravenmore artwork and Game-icons.net SVGs as fallbacks. Magic-item variants may
share their base item's artwork. Upload PNG, JPEG, or WebP illustrations
(up to 2 MB) in the equipment editor to replace them. Only use artwork you have
permission to use.
Chain Mail, Chain Shirt, Leather Armor, and Thieves' Tools use their supplied
cutouts, including matching armor variants. Items without a supplied cutout
retain fallback artwork.
Equipment illustrations are displayed brighter with softened shadows in previews
and print to keep darker artwork readable; the original image files are unchanged.

Custom cards, uploaded images, and the shared print selection persist in this
browser. **Save JSON** backs up all custom card types and their images;
**Load JSON** restores or merges them. Existing custom-spell files still work.
Large uploads can fill browser storage; save a JSON backup and use smaller
images if storage is full.

### Data and artwork sources

See [Sources and licenses](./credits.html) for attribution and license links.
SRD rules are sourced from Open5e's SRD 2024 data under CC BY 4.0.
The separate [2024 PHB supplement](./data/spells-2024-phb-supplement.json)
contains original rules summaries, not copied book text or SRD-licensed entries.
Together the two spell files contain all **391 spells** in the 2024 Player's
Handbook, from cantrips through level 9, covering the base lists for **Bard,
Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, and Wizard**.
Subclass spells, feats, older editions, and other supplements are outside this
coverage check. Paladins and Rangers have no cantrips or spells above level 5 on
their base lists. Artificer is not in the 2024 PHB and is not included in this
coverage claim; classes without base spell lists gain spells through features
such as subclasses or feats.

Coverage was checked against [5etools](https://5e.tools/spells.html) on October 27,
2026, using its XPHB spell data and XPHB base-class lookup. Eight missing spells
were added: Armor of Agathys, Arms of Hadar, Blade Ward, Compelled Duel, Friends,
Mind Sliver, Thunderous Smite, and Wrathful Smite. Word of Radiance, Thunderclap,
and Toll the Dead were moved from app code into the supplement, retaining their
existing keys for saved selections. Thunderclap now uses the 2024 Emanation area.
The supplement also adds 25 missing higher-level spells: two at level 2, eight at
level 3, four at level 4, seven at level 5, three at level 6, and one at level 7.
The level-8 and level-9 lists for those four classes were already complete.
Completing the remaining class lists added 15 more spells: Arcane Vigor, Beast
Sense, Conjure Barrage, Conjure Volley, Cordon of Arrows, Grasping Vine, Hail of
Thorns, Lightning Arrow, Steel Wind Strike, Summon Beast, Summon Construct,
Summon Elemental, Swift Quiver, Telepathy, and Thorn Whip. The supplement now
contains 51 entries. Summoning spells reference the required 2024 spirit stat
blocks rather than reproducing them, matching Summon Dragon in the existing library.
Exact class-list coverage at each spell level, unique names and keys, and
the 391-spell catalog total are checked by the offline tests.
Named spells already available under SRD aliases are not duplicated; for example,
Tasha's Hideous Laughter is **Hideous Laughter**, Leomund's Tiny Hut is **Tiny Hut**,
and Mordenkainen's Sword is **Arcane Sword**.
No live requests to 5etools are made by the app.

Spell data, equipment data, and artwork are local files: printing does not depend
on live source APIs.
Magic-item compact weapon stats show the underlying weapon profile; consult
the description for magical bonuses and additional rules. Unlisted magic-item
prices are shown as "Not listed".

To refresh equipment data and SVGs, run
`python card-generator\sync-equipment.py` from the repository root. The script
explicitly filters every returned record by its source document, including
endpoints that do not honor the server-side document filter.

Hand-painted artwork comes from the CC BY 3.0 Ravenmore Icon Pack 2.0 linked
on the credits page. Download its ZIP and run
`python card-generator\sync-equipment.py C:\path\to\RavenmoreIconPack.02.2014.zip`
to extract only the illustrations used by this app.

## Printing

Equipment cards follow the supplied dagger template: artwork, weight, a price
coin, and compact combat details on the front; stats and rules text on the back.
Front armor badges abbreviate Dexterity formulas (for example, `13+DEX` with
a smaller `(MAX 2)` line). Back stats retain the full armor-class wording.
Long equipment names wrap into balanced lines, with the front title kept clear
of the weight and price icons.
Enable **Fold and glue** or **Double-sided** to include the equipment rules text
when printing. Long descriptions continue on additional matched card pairs.
Gold prices use gold coins and silver prices use silver coins. Sub-gold prices
are expressed in silver; copper is converted to silver, and electrum/platinum
to gold or silver as appropriate. Unlisted prices use a neutral question mark.

Equipment footer colors follow rarity on both sides: mundane/common/varies
black, uncommon green, rare blue, very rare purple, legendary orange, and
artifact copper. These are configured with the `data-rarity` rules in
[app.css](./app.css). Spell footer color remains configurable with
`--spell-footer-color` in `:root`, including the curved back edge.
The three range emblem PNGs are color-matched to the spell footer's `#047EA1`
blue; recolor these images separately when changing that footer color.

Select cards from any library, choose a card size, and choose **Card backs**:

- **Fronts only** preserves the original layout: 16 half-size or 9 standard cards
  per A4 page.
- **Fold and glue** places each front immediately beside its corresponding back,
  with a dashed fold seam and no gap between them. Cut around the whole pair,
  fold on the seam, and glue. Print single-sided. Each page fits 8 half-size or
  3 standard pairs.
- **Double-sided** alternates a front page with its matching back page. Back
  columns are reversed, including empty positions on partial pages. Print
  duplex with **flip on long edge**. Each sheet fits 16 half-size or 9 standard
  cards. Continuation cards receive their own corresponding backs.

Set **Copies** above each selected card to print that entry multiple times.
Each copy includes all continuation cards and the backs chosen above. Counts
include every copy; previews show each entry once. Copy counts are saved with
the selection, and removing an entry resets its count to one.

Use **A4 portrait**, **100% / actual size**, background graphics enabled,
and browser headers/footers disabled. Do not use fit-to-page or multiple pages
per sheet. Test one sheet before a large duplex run: printer feed tolerances
can affect physical alignment.

Back previews appear after their fronts in the selection panel when either
back option is enabled. Keyword icons replace their redundant damage-type,
condition, and melee/ranged attack names; dice, durations, and save abilities
remain visible. Full keyword labels are retained for assistive technology.
Front keyword rows grow to fit wrapped values, with each condition icon beside
its own label. Multiple condition icons stay in a horizontal row on the back.
Keyword icons stay beside their text rather than wrapping onto a line alone.
Back icon/text groups are centered together, with multiline text left-aligned
when accompanied by keyword icons. Text-only values are centered.
Description fitting accounts for the space used by expanded keyword rows.
Back designs use the supplied parchment, range emblems,
keyword icons, and matching area diagrams. All area diagrams share a 600 by 540
image frame and the same visible grid spacing. Areas up to 30 feet across use
5-foot squares: a 30-foot area has half a square of grid around it, and smaller
areas show more empty grid. Larger areas use coarser squares in 5-foot increments
to fit the same frame. The cutoff uses full diameter for spheres, emanations,
and cylinders, or side/length for other shapes. Labels remain visible beyond
the grid where needed. Missing area diagrams are generated
as inline SVG for cones, cubes, cylinders, emanations, spheres, squares, and
lines. Grid scales are HTML captions in the back-card template, styled with
`.back-grid-legend` in `app.css`, rather than text embedded in the SVGs.
Both supplied and generated diagrams include a size heading above the grid.
The red back-card Area frame uses the same size
wording, including an explicit radius for spheres. Emanations use generated
diagrams so their headings identify them as Emanations rather than Spheres.
Sphere and cylinder sizes represent radii, cube/square sizes represent side
lengths, and line dimensions show length and width when available.
Some SRD spells lack area metadata; an area explicitly described in their opening
sentence is also recognized. Custom cards can specify their shape and size in
the editor. Target counts use explicit "up to" counts when present, otherwise the
spell's target-count metadata (or Self for self-range spells).

## Tests

Run `node --test card-generator\app.test.cjs` from the repository root.
The tests use Node's built-in test runner and require no dependencies.
