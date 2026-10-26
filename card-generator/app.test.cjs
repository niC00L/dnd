const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { webcrypto } = require("node:crypto");
const { test } = require("node:test");

class Element {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.attributes = {};
        this.style = {};
        this.classList = { toggle() {}, add() {} };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
}

function app(size = "half", mode = "none", measureFits = null) {
    const printRoot = new Element("div");
    const backTemplate = {
        content: {
            firstElementChild: {
                cloneNode() {
                    const card = new Element("article");
                    const fields = new Map();
                    card.querySelector = selector => {
                        if (!fields.has(selector)) fields.set(selector, new Element("div"));
                        return fields.get(selector);
                    };
                    return card;
                }
            }
        }
    };
    const document = {
        body: { dataset: { cardSize: size } },
        querySelector: selector => selector === "#print-root" ? printRoot : selector === "#spell-back-template" ? backTemplate : { value: mode },
        querySelectorAll: () => [],
        createTextNode: text => Object.assign(new Element("#text"), { textContent: text }),
        createElement: tag => new Element(tag),
        createElementNS: (namespaceURI, tag) => Object.assign(new Element(tag), { namespaceURI })
    };
    const source = readFileSync(join(__dirname, "app.js"), "utf8");
    const initialization = source.indexOf('\nfor (const [name, options] of Object.entries(');
    assert.ok(initialization > 0, "Locate app initialization after the function declarations");
    const equipment = readFileSync(join(__dirname, "equipment.js"), "utf8");
    return runInNewContext(`${equipment}\n${source.slice(0, initialization)}
        if (measureFits) descriptionFits = measureFits;
        else getSpellCardParts = spell => spell.parts;
        buildCard = (spell, part) => Object.assign(document.createElement("front"), { key: spell.key, part });
        const buildSpellBack = buildBack;
        buildBack = (spell, part) => Object.assign(document.createElement("back"), { key: spell.key, part });
        ({ state, printRoot: elements.printRoot, cardSizeSettings, renderPrintPages,
           spellArea, areaImage, areaLabel, buildAreaDiagram, buildSpellBack, backTargetCount, backKeywordText,
           isCustomEquipment, isEquipment, equipmentStats, equipmentImage, getSpellCardParts, keywordContent });
    `, { document, crypto: webcrypto, console, measureFits });
}

test("Descriptions are measured whole before splitting and compact spacing is opt-in", () => {
    const spell = { key: "test-fit", name: "Test", desc: "A complete sentence. ".repeat(50).trim() };
    const attempts = [];
    const context = app("half", "none", (spell, part) => {
        attempts.push({ ...part });
        return true;
    });
    const parts = context.getSpellCardParts(spell);
    assert.equal(parts.length, 1);
    assert.equal(attempts[0].description, spell.desc);
    assert.equal(parts[0].compact, undefined);

    const compact = app("half", "none", (spell, part) => Boolean(part.compact));
    assert.equal(compact.getSpellCardParts(spell).length, 1);
    assert.equal(compact.getSpellCardParts(spell)[0].compact, true);

    const overflowing = app("half", "none", (spell, part) => part.description.length <= 900);
    const chunks = overflowing.getSpellCardParts(spell);
    assert.ok(chunks.length > 1);
    assert.equal(chunks.map(part => part.description).join(" "), spell.desc);
    assert.equal(chunks[0].continuation, false);
    assert.equal(chunks[1].continuation, true);
});

test("Multiple front conditions each pair their icon with a label", () => {
    const { keywordContent } = app();
    const value = new Element("span");
    const card = { querySelector: () => value };
    keywordContent(card, "effect", "Exhaustion, Unconscious", ["exhaustion", "unconscious"]);
    const conditions = value.children[0];
    assert.equal(conditions.className, "keyword-conditions");
    assert.equal(conditions.children.length, 2);
    for (const [index, name] of ["Exhaustion", "Unconscious"].entries()) {
        const row = conditions.children[index];
        assert.equal(row.className, "keyword-condition");
        assert.equal(row.children[0].src, `./img/icons/${name.toLowerCase()}.svg`);
        assert.equal(row.children[1].textContent, name);
    }
    keywordContent(card, "effect", "8d6 Fire Cold", ["fire", "cold"]);
    assert.equal(value.children.length, 3);
    assert.equal(value.children[2].textContent, "8d6 Fire Cold");
    assert.equal(value.children[2].className, "keyword-text");
    keywordContent(card, "effect", "1d8 or 1d12 Necrotic", ["necrotic"]);
    assert.equal(value.children.length, 2);
    assert.equal(value.children[0].src, "./img/icons/necrotic.svg");
    assert.equal(value.children[1].className, "keyword-text");
    assert.equal(value.children[1].textContent, "1d8 or 1d12 Necrotic");
    keywordContent(card, "effect", "Utility");
    assert.equal(value.children[0].textContent, "Utility");
});

function selectCards(context, count) {
    for (let index = 0; index < count; index++) {
        context.state.selected.set(index, { key: index, parts: [{ continuation: false }] });
    }
}

for (const size of ["half", "standard"]) {
    for (const mode of ["none", "fold", "duplex"]) {
        test(`${size} / ${mode}: page capacity and partial-sheet ordering`, () => {
            const context = app(size, mode);
            const capacity = size === "half" ? (mode === "fold" ? 8 : 16) : (mode === "fold" ? 3 : 9);
            assert.equal(context.cardSizeSettings().cardsPerPage, capacity);
            selectCards(context, capacity + 1);
            context.renderPrintPages();
            const pages = context.printRoot.children;
            assert.equal(pages.length, mode === "duplex" ? 4 : 2);
            assert.equal(pages[0].children.length, capacity);
            if (mode === "fold") {
                for (const pair of pages[0].children) {
                    assert.equal(pair.children.length, 2);
                    assert.equal(pair.children[0].tag, "front");
                    assert.equal(pair.children[1].tag, "back");
                    assert.equal(pair.children[0].key, pair.children[1].key);
                }
            } else if (mode === "duplex") {
                const columns = size === "half" ? 4 : 3;
                pages[1].children.forEach((back, index) => {
                    assert.equal(back.key, pages[0].children[index].key);
                    assert.equal(back.style.gridColumn, String(columns - index % columns));
                    assert.equal(back.style.gridRow, String(Math.floor(index / columns) + 1));
                });
                assert.equal(pages[2].children[0].key, capacity);
                assert.equal(pages[3].children[0].key, capacity);
                assert.equal(pages[3].children[0].style.gridColumn, String(columns));
                assert.equal(pages[3].children[0].style.gridRow, "1");
            }
        });
    }
}

test("Continuation cards keep their corresponding backs across page boundaries", () => {
    const context = app("standard", "duplex");
    selectCards(context, 8);
    context.state.selected.set(8, { key: "long-spell", parts: [{ continuation: false }, { continuation: true }] });
    context.renderPrintPages();
    const pages = context.printRoot.children;
    assert.equal(pages[1].children[8].key, "long-spell");
    assert.equal(pages[3].children[0].key, "long-spell");
    assert.equal(pages[3].children[0].part.continuation, true);
});

test("Rendering twice replaces pages and empty selections produce no pages", () => {
    const context = app("half", "duplex");
    selectCards(context, 1);
    context.renderPrintPages();
    context.renderPrintPages();
    assert.equal(context.printRoot.children.length, 2);
    context.state.selected.clear();
    context.renderPrintPages();
    assert.equal(context.printRoot.children.length, 0);
});

test("Area metadata, missing SRD areas, radius, diameter, and line dimensions", () => {
    const { spellArea, areaLabel } = app();
    assert.equal(spellArea({ desc: "Protective spirits flit around you in a 15-foot Emanation for the duration." }).size, 15);
    assert.equal(spellArea({ desc: "You create a 5-foot-diameter sphere of fire." }).size, 2.5);
    const cylinder = spellArea({ desc: "Light shines in a 40-foot-high Cylinder with a 10-foot radius." });
    assert.equal(cylinder.type, "cylinder");
    assert.equal(cylinder.size, 10);
    const line = spellArea({ shape_type: "line", shape_size: 5, desc: "A 100-foot-long, 5-foot-wide Line blasts out from you." });
    assert.equal(line.length, 100);
    assert.equal(areaLabel(line), "100 x 5 ft Line");
    assert.equal(spellArea({ desc: "A creature you touch regains Hit Points." }), null);
});

test("Reuse correctly sized reference diagrams and generate every missing area shape", () => {
    const { areaImage, buildAreaDiagram } = app();
    assert.equal(areaImage({ type: "emanation", size: 5, unit: "feet" }), null);
    assert.equal(areaImage({ type: "sphere", size: 10, unit: "feet" }), "aoe-sphere-20.svg");
    assert.equal(areaImage({ type: "sphere", size: 20, unit: "feet" }), null);
    for (const type of ["cone", "cube", "cylinder", "emanation", "sphere", "square", "line"]) {
        const diagram = buildAreaDiagram({ type, size: 30, unit: "feet", length: type === "line" ? 100 : null });
        assert.equal(diagram.tag, "svg");
        assert.match(diagram.attributes["aria-label"], new RegExp(type, "i"));
        assert.ok(!JSON.stringify(diagram).match(/NaN|Infinity|undefined/));
    }
});

test("Back target counts respect self and explicit multiple targets", () => {
    const { backTargetCount } = app();
    assert.equal(backTargetCount({ range_text: "Self", target_count: 1 }), "Self");
    assert.equal(backTargetCount({ desc: "Up to three creatures of your choice", target_count: 1 }), "3");
    assert.equal(backTargetCount({ desc: "Choose up to 12 targets." }), "12");
    assert.equal(backTargetCount({ range_text: "Touch", target_count: 1 }), "1");
});

test("Area diagrams keep a fixed frame and grid spacing while scaling areas by full extent", () => {
    const { buildAreaDiagram } = app();
    const descendants = node => [node, ...node.children.flatMap(descendants)];
    const make = (type, size, length) => buildAreaDiagram({ type, size, length, unit: "feet" });
    for (const type of ["sphere", "emanation", "cylinder", "cone", "cube", "square", "line"]) {
        const circular = ["sphere", "emanation", "cylinder"].includes(type);
        const small = make(type, circular ? 5 : 10);
        const limit = make(type, circular ? 15 : 30);
        const large = make(type, circular ? 30 : 60);
        for (const diagram of [small, limit, large]) {
            assert.equal(diagram.attributes.viewBox, "0 0 600 540");
            const fill = descendants(diagram).find(node => node.tag === "pattern" && node.attributes.width === String(400 / 7));
            assert.ok(fill, `${type}: fixed grid spacing`);
        }
        const legend = diagram => descendants(diagram).filter(node => node.tag === "text").at(-1).textContent;
        assert.match(legend(small), /^Grid: 5 feet/);
        assert.match(legend(limit), /^Grid: 5 feet/);
        assert.match(legend(large), /^Grid: 10 feet/);
    }
    const circle = size => descendants(make("sphere", size)).find(node => node.tag === "circle");
    assert.equal(Number(circle(5).attributes.r) * 3, Number(circle(15).attributes.r));
    assert.equal(circle(30).attributes.r, circle(15).attributes.r);
    assert.ok(Math.abs(260 - Number(circle(15).attributes.r) - 60 - 200 / 7) < 1e-10);
    const longLine = descendants(make("line", 5, 100));
    assert.match(longLine.filter(node => node.tag === "text").at(-1).textContent, /^Grid: 20 feet/);
    const rectangle = longLine.find(node => node.tag === "rect" && node.attributes.stroke);
    assert.ok(Number(rectangle.attributes.width) <= 2400 / 7);
    for (const name of ["cone", "cube-15", "cube-20", "sphere-10", "sphere-20", "square"]) {
        const source = readFileSync(join(__dirname, "img", `aoe-${name}.svg`), "utf8");
        assert.match(source, /viewBox="0 0 600 540" width="600" height="540"/);
        assert.match(source, /data-grid-unit="5"/);
        assert.match(source, /Grid: 5 feet \/ square/);
    }
});

test("Area sizes appear in the red back frame and above supplied and generated diagrams", () => {
    const { buildSpellBack, buildAreaDiagram, areaImage } = app();
    for (const [type, size, expected] of [
        ["sphere", 5, "5 ft radius Sphere"],
        ["sphere", 10, "10 ft radius Sphere"],
        ["sphere", 20, "20 ft radius Sphere"],
        ["cone", 15, "15 ft Cone"],
        ["cone", 30, "30 ft Cone"],
        ["square", 10, "10 ft Square"],
        ["square", 20, "20 ft Square"],
        ["emanation", 5, "5 ft radius Emanation"]
    ]) {
        const area = { type, size, unit: "feet" };
        const card = buildSpellBack({
            name: "Test Area", level: 0, shape_type: type, shape_size: size,
            range_text: "Self", casting_time: "Action", duration: "Instantaneous", desc: ""
        }, {});
        const range = card.querySelector('[data-field="range"]');
        assert.equal(range.children[1].children[0].textContent, "Area");
        assert.equal(range.children[1].children[1].textContent, expected);
        const heading = buildAreaDiagram(area).children.find(node => node.tag === "text" && node.attributes.y === "40");
        assert.equal(heading.textContent, expected);
        const image = areaImage(area);
        if (image) {
            const source = readFileSync(join(__dirname, "img", image), "utf8");
            assert.ok(source.includes(`font-weight="bold">${expected}</text>`));
            assert.match(source, /<text x="300" y="40"/);
        }
    }
});

test("Cube area images have matching dark dashed edges on both sides of the blue face", () => {
    for (const size of [15, 20]) {
        const source = readFileSync(join(__dirname, "img", `aoe-cube-${size}.svg`), "utf8");
        const darkGroups = [...source.matchAll(/<g fill="#2b2526">([\s\S]*?)<\/g>/g)];
        const rectangles = darkGroups.flatMap(([, content]) =>
            [...content.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" \/>/g)]
                .map(([, x, y, width, height]) => ({ x: Number(x), y: Number(y), width: Number(width), height: Number(height) })));
        const left = rectangles.filter(rect => rect.x === 160);
        const right = rectangles.filter(rect => rect.x === 160 + size * 18 - 14);
        assert.equal(left.length, size * 2 / 5, `${size}-foot cube: left dash count`);
        assert.deepEqual(left.map(({ x, ...dash }) => dash), right.map(({ x, ...dash }) => dash));
        for (const [index, dash] of left.entries()) {
            assert.deepEqual(dash, { x: 160, y: 162.5 + index * 45, width: 14, height: 20 });
        }
    }
});

test("Back keyword icons replace redundant names but retain numeric and save information", () => {
    const { backKeywordText } = app();
    for (const [text, icons, expected] of [
        ["Melee Spell", ["melee_spell"], ""],
        ["Ranged Spell", ["ranged_spell"], ""],
        ["8d6 Fire", ["fire"], "8d6"],
        ["1d8 or 1d12 Necrotic", ["necrotic"], "1d8 or 1d12"],
        ["Blinded, Deafened, Poisoned", ["blinded", "deafened", "poisoned"], ""],
        ["1 minute", ["concentration"], "1 min"],
        ["Action", ["ritual"], "Action"],
        ["DEX Save", [], "DEX sv"],
        ["Healing", [], "Healing"],
        ["Utility", [], "Utility"]
    ]) {
        assert.equal(backKeywordText({ text, icons }), expected);
    }
});

test("All built-in equipment records are valid, unique, licensed, and have local artwork", () => {
    const { isCustomEquipment, equipmentImage } = app();
    const cards = JSON.parse(readFileSync(join(__dirname, "data", "equipment-2024-srd.json"), "utf8"));
    assert.equal(cards.length, 963);
    assert.equal(new Set(cards.map(card => card.key)).size, cards.length);
    assert.equal(cards.filter(card => card.source.url.includes("/items/")).length, 203);
    assert.equal(cards.filter(card => card.source.url.includes("/magicitems/")).length, 760);
    for (const card of cards) {
        assert.equal(isCustomEquipment({ ...card, key: `custom-${card.key}` }), true, card.name);
        assert.equal(card.source.license, "CC BY 4.0", card.name);
        assert.ok(card.source.url.includes("srd-2024"), card.name);
        assert.ok(existsSync(join(__dirname, equipmentImage(card))), `${card.name}: missing artwork`);
    }
});

test("Equipment profiles retain range, properties, mastery, armor, and magic item rules", () => {
    const { equipmentStats } = app();
    const cards = JSON.parse(readFileSync(join(__dirname, "data", "equipment-2024-srd.json"), "utf8"));
    const sword = cards.find(card => card.name === "Longsword");
    assert.equal(sword.damage_roll, "1d8");
    assert.equal(sword.mastery, "Sap");
    assert.match(sword.properties, /Versatile \(1d10\)/);
    assert.match(sword.desc, /Disadvantage/);
    const bow = cards.find(card => card.name === "Longbow");
    assert.equal(bow.range_text, "150/600 ft");
    const armor = cards.find(card => card.name === "Breastplate");
    assert.match(armor.armor_class, /14/);
    assert.equal(equipmentStats(armor).find(([label]) => label === "Armor Class")[1], armor.armor_class);
    const magic = cards.find(card => card.magic && card.attunement);
    assert.equal(equipmentStats(magic).find(([label]) => label === "Attunement")[1], "Required");
    assert.ok(magic.desc.length > 0);
    assert.equal(cards.find(card => card.name === "Potion of Healing").rarity, "Common");
    assert.equal(cards.find(card => card.name === "Spell Scroll").rarity, "Varies");
});

test("Equipment validation rejects unsafe uploads and malformed custom cards", () => {
    const { isCustomEquipment, equipmentImage } = app();
    const source = JSON.parse(readFileSync(join(__dirname, "data", "equipment-2024-srd.json"), "utf8"))[0];
    const card = { ...source, key: "custom-equipment-test" };
    assert.equal(isCustomEquipment(card), true);
    for (const change of [
        { kind: "spell" }, { name: "" }, { desc: "" }, { image: "../other" },
        { image_data: "https://example.com/image.png" }, { image_data: "data:image/svg+xml;base64,PHN2Zz4=" },
        { damage_types: ["not-a-type"] }, { attunement: "yes" }
    ]) assert.equal(isCustomEquipment({ ...card, ...change }), false, JSON.stringify(change));
    const upload = { ...card, image_data: "data:image/png;base64,aGVsbG8=" };
    assert.equal(isCustomEquipment(upload), true);
    assert.equal(equipmentImage(upload), upload.image_data);
});
