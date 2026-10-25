const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
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
        this.classList = { toggle() {} };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
}

function app(size = "half", mode = "none") {
    const printRoot = new Element("div");
    const document = {
        body: { dataset: { cardSize: size } },
        querySelector: selector => selector === "#print-root" ? printRoot : { value: mode },
        querySelectorAll: () => [],
        createElement: tag => new Element(tag),
        createElementNS: (namespaceURI, tag) => Object.assign(new Element(tag), { namespaceURI })
    };
    const source = readFileSync(join(__dirname, "app.js"), "utf8");
    const initialization = source.indexOf('\nfor (const [name, options] of Object.entries(');
    assert.ok(initialization > 0, "Locate app initialization after the function declarations");
    return runInNewContext(`${source.slice(0, initialization)}
        getSpellCardParts = spell => spell.parts;
        buildCard = (spell, part) => Object.assign(document.createElement("front"), { key: spell.key, part });
        buildBack = (spell, part) => Object.assign(document.createElement("back"), { key: spell.key, part });
        ({ state, printRoot: elements.printRoot, cardSizeSettings, renderPrintPages,
           spellArea, areaImage, areaLabel, buildAreaDiagram, backTargetCount, backKeywordText });
    `, { document, crypto: webcrypto, console });
}

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
    assert.equal(areaImage({ type: "emanation", size: 5, unit: "feet" }), "aoe-sphere-10.svg");
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
