# Adventure Card Press

Serve the repository with a local web server and open `card-generator/`.
For example, run `python -m http.server 8000` from the repository root and open
<http://localhost:8000/card-generator/>.

## Libraries and custom cards

Choose **Spells**, **Weapons**, or **Items** from the top tabs. The built-in
equipment library includes 203 standard SRD 5.2 equipment entries and 760
magic-item variants (963 entries total). Weapons include mundane and magic
weapons; Items includes armor, shields, gear, tools, and other magic items.
Use category, rarity, source, and text filters to narrow equipment results.
Selections are shared across tabs, so all three types can be printed together.

Use **+ Custom card** on a tab to create that kind of card. Equipment supports
damage, range, properties/charges, mastery, armor class, rarity, attunement,
cost, weight, descriptions, and illustrations. **Customize** beside built-in
equipment creates an editable custom copy without modifying the library.
Long descriptions are split into continuation cards, just like spells.

Illustrations use hand-painted artwork by Ravenmore where available and
Game-icons.net SVGs otherwise. Artwork is representative, not an exact image of
every weapon or magic-item variant. Upload PNG, JPEG, or WebP illustrations
(up to 2 MB) in the equipment editor to replace them. Only use artwork you have
permission to use; official rulebook art is not included.

Custom cards, uploaded images, and the shared print selection persist in this
browser. **Save JSON** backs up all custom card types and their images;
**Load JSON** restores or merges them. Existing custom-spell files still work.
Large uploads can fill browser storage; save a JSON backup and use smaller
images if storage is full.

### Data and artwork sources

See [Sources and licenses](./credits.html) for attribution and license links.
Rules are sourced from Open5e's SRD 2024 data under CC BY 4.0. Equipment data
and artwork are local files: printing does not depend on live source APIs.
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

Footer colors are configurable in the `:root` section of [app.css](./app.css):
`--spell-footer-color` (blue), `--weapon-footer-color` (rust), and
`--item-footer-color` (green). Each applies to both card sides, including the
curved edge on the back, in previews and printing.

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

Use **A4 portrait**, **100% / actual size**, background graphics enabled,
and browser headers/footers disabled. Do not use fit-to-page or multiple pages
per sheet. Test one sheet before a large duplex run: printer feed tolerances
can affect physical alignment.

Back previews appear after their fronts in the selection panel when either
back option is enabled. Keyword icons replace their redundant damage-type,
condition, and melee/ranged attack names; dice, durations, and save abilities
remain visible. Full keyword labels are retained for assistive technology.
Back designs use the supplied parchment, range emblems,
keyword icons, and matching area diagrams. Missing area diagrams are generated
as inline SVG for cones, cubes, cylinders, emanations, spheres, squares, and
lines. Generated grids include their scale; large areas use larger grid squares.
Sphere and cylinder sizes represent radii, cube/square sizes represent side
lengths, and line dimensions show length and width when available.
Some SRD spells lack area metadata; an area explicitly described in their opening
sentence is also recognized. Custom cards can specify their shape and size in
the editor. Target counts use explicit "up to" counts when present, otherwise the
spell's target-count metadata (or Self for self-range spells).

## Tests

Run `node --test card-generator\app.test.cjs` from the repository root.
The tests use Node's built-in test runner and require no dependencies.
