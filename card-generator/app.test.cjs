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

function app(size = "half", mode = "none", measureFits = null, fetch = undefined) {
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
           spellArea, areaImage, areaLabel, areaGridUnit, buildAreaDiagram, buildSpellBack, backTargetCount, backKeywordText,
           isCustomEquipment, isEquipment, equipmentStats, equipmentImage, getSpellCardParts, keywordContent,
           loadSpellLibrary, spellKeywords });
    `, { document, crypto: webcrypto, console, measureFits, fetch });
}

test("Built-in database covers every 2024 PHB spell level for all eight spellcasting classes", () => {
    // Checked against 5etools' XPHB spell and generated class lookup data, October 27, 2026.
    // Named spells use their existing SRD aliases where applicable.
    const expected = {
        Bard: [
            "Blade Ward|Dancing Lights|Friends|Light|Mage Hand|Mending|Message|Minor Illusion|Prestidigitation|Starry Wisp|Thunderclap|True Strike|Vicious Mockery",
            "Animal Friendship|Bane|Charm Person|Color Spray|Command|Comprehend Languages|Cure Wounds|Detect Magic|Disguise Self|Dissonant Whispers|Faerie Fire|Feather Fall|Healing Word|Heroism|Identify|Illusory Script|Longstrider|Silent Image|Sleep|Speak with Animals|Hideous Laughter|Thunderwave|Unseen Servant",
            "Aid|Animal Messenger|Blindness/Deafness|Calm Emotions|Cloud of Daggers|Crown of Madness|Detect Thoughts|Enhance Ability|Enlarge/Reduce|Enthrall|Heat Metal|Hold Person|Invisibility|Knock|Lesser Restoration|Locate Animals or Plants|Locate Object|Magic Mouth|Mirror Image|Phantasmal Force|See Invisibility|Shatter|Silence|Suggestion|Zone of Truth",
            "Bestow Curse|Clairvoyance|Dispel Magic|Fear|Feign Death|Glyph of Warding|Hypnotic Pattern|Tiny Hut|Major Image|Mass Healing Word|Nondetection|Plant Growth|Sending|Slow|Speak with Dead|Speak with Plants|Stinking Cloud|Tongues",
            "Charm Monster|Compulsion|Confusion|Dimension Door|Fount of Moonlight|Freedom of Movement|Greater Invisibility|Hallucinatory Terrain|Locate Creature|Phantasmal Killer|Polymorph",
            "Animate Objects|Awaken|Dominate Person|Dream|Geas|Greater Restoration|Hold Monster|Legend Lore|Mass Cure Wounds|Mislead|Modify Memory|Planar Binding|Raise Dead|Telepathic Bond|Scrying|Seeming|Synaptic Static|Teleportation Circle|Yolande's Regal Presence",
            "Eyebite|Find the Path|Guards and Wards|Heroes' Feast|Mass Suggestion|Irresistible Dance|Programmed Illusion|True Seeing",
            "Etherealness|Forcecage|Mirage Arcane|Magnificent Mansion|Arcane Sword|Power Word Fortify|Prismatic Spray|Project Image|Regenerate|Resurrection|Symbol|Teleport",
            "Antipathy/Sympathy|Befuddlement|Dominate Monster|Glibness|Mind Blank|Power Word Stun",
            "Foresight|Power Word Heal|Power Word Kill|Prismatic Wall|True Polymorph"
        ],
        Cleric: [
            "Guidance|Light|Mending|Resistance|Sacred Flame|Spare the Dying|Thaumaturgy|Toll the Dead|Word of Radiance",
            "Bane|Bless|Command|Create or Destroy Water|Cure Wounds|Detect Evil and Good|Detect Magic|Detect Poison and Disease|Guiding Bolt|Healing Word|Inflict Wounds|Protection from Evil and Good|Purify Food and Drink|Sanctuary|Shield of Faith",
            "Aid|Augury|Blindness/Deafness|Calm Emotions|Continual Flame|Enhance Ability|Find Traps|Gentle Repose|Hold Person|Lesser Restoration|Locate Object|Prayer of Healing|Protection from Poison|Silence|Spiritual Weapon|Warding Bond|Zone of Truth",
            "Animate Dead|Aura of Vitality|Beacon of Hope|Bestow Curse|Clairvoyance|Create Food and Water|Daylight|Dispel Magic|Feign Death|Glyph of Warding|Magic Circle|Mass Healing Word|Meld into Stone|Protection from Energy|Remove Curse|Revivify|Sending|Speak with Dead|Spirit Guardians|Tongues|Water Walk",
            "Aura of Life|Aura of Purity|Banishment|Control Water|Death Ward|Divination|Freedom of Movement|Guardian of Faith|Locate Creature|Stone Shape",
            "Circle of Power|Commune|Contagion|Dispel Evil and Good|Flame Strike|Geas|Greater Restoration|Hallow|Insect Plague|Legend Lore|Mass Cure Wounds|Planar Binding|Raise Dead|Scrying|Summon Celestial",
            "Blade Barrier|Create Undead|Find the Path|Forbiddance|Harm|Heal|Heroes' Feast|Planar Ally|Sunbeam|True Seeing|Word of Recall",
            "Conjure Celestial|Divine Word|Etherealness|Fire Storm|Plane Shift|Power Word Fortify|Regenerate|Resurrection|Symbol",
            "Antimagic Field|Control Weather|Earthquake|Holy Aura|Sunburst",
            "Astral Projection|Gate|Mass Heal|Power Word Heal|True Resurrection"
        ],
        Paladin: [
            "",
            "Bless|Command|Compelled Duel|Cure Wounds|Detect Evil and Good|Detect Magic|Detect Poison and Disease|Divine Favor|Divine Smite|Heroism|Protection from Evil and Good|Purify Food and Drink|Searing Smite|Shield of Faith|Thunderous Smite|Wrathful Smite",
            "Aid|Find Steed|Gentle Repose|Lesser Restoration|Locate Object|Magic Weapon|Prayer of Healing|Protection from Poison|Shining Smite|Warding Bond|Zone of Truth",
            "Aura of Vitality|Blinding Smite|Create Food and Water|Crusader's Mantle|Daylight|Dispel Magic|Elemental Weapon|Magic Circle|Remove Curse|Revivify",
            "Aura of Life|Aura of Purity|Banishment|Death Ward|Locate Creature|Staggering Smite",
            "Banishing Smite|Circle of Power|Destructive Wave|Dispel Evil and Good|Geas|Greater Restoration|Raise Dead|Summon Celestial",
            "", "", "", ""
        ],
        Druid: [
            "Druidcraft|Elementalism|Guidance|Mending|Message|Poison Spray|Produce Flame|Resistance|Shillelagh|Spare the Dying|Starry Wisp|Thorn Whip|Thunderclap",
            "Animal Friendship|Charm Person|Create or Destroy Water|Cure Wounds|Detect Magic|Detect Poison and Disease|Entangle|Faerie Fire|Fog Cloud|Goodberry|Healing Word|Ice Knife|Jump|Longstrider|Protection from Evil and Good|Purify Food and Drink|Speak with Animals|Thunderwave",
            "Aid|Animal Messenger|Augury|Barkskin|Beast Sense|Continual Flame|Darkvision|Enhance Ability|Enlarge/Reduce|Find Traps|Flame Blade|Flaming Sphere|Gust of Wind|Heat Metal|Hold Person|Lesser Restoration|Locate Animals or Plants|Locate Object|Moonbeam|Pass without Trace|Protection from Poison|Spike Growth|Summon Beast",
            "Aura of Vitality|Call Lightning|Conjure Animals|Daylight|Dispel Magic|Elemental Weapon|Feign Death|Meld into Stone|Plant Growth|Protection from Energy|Revivify|Sleet Storm|Speak with Plants|Summon Fey|Water Breathing|Water Walk|Wind Wall",
            "Blight|Charm Monster|Confusion|Conjure Minor Elementals|Conjure Woodland Beings|Control Water|Divination|Dominate Beast|Fire Shield|Fount of Moonlight|Freedom of Movement|Giant Insect|Grasping Vine|Hallucinatory Terrain|Ice Storm|Locate Creature|Polymorph|Stone Shape|Stoneskin|Summon Elemental|Wall of Fire",
            "Antilife Shell|Awaken|Commune with Nature|Cone of Cold|Conjure Elemental|Contagion|Geas|Greater Restoration|Insect Plague|Mass Cure Wounds|Planar Binding|Reincarnate|Scrying|Tree Stride|Wall of Stone",
            "Conjure Fey|Find the Path|Flesh to Stone|Heal|Heroes' Feast|Move Earth|Sunbeam|Transport via Plants|Wall of Thorns|Wind Walk",
            "Fire Storm|Mirage Arcane|Plane Shift|Regenerate|Reverse Gravity|Symbol",
            "Animal Shapes|Antipathy/Sympathy|Befuddlement|Control Weather|Earthquake|Incendiary Cloud|Sunburst|Tsunami",
            "Foresight|Shapechange|Storm of Vengeance|True Resurrection"
        ],
        Ranger: [
            "",
            "Alarm|Animal Friendship|Cure Wounds|Detect Magic|Detect Poison and Disease|Ensnaring Strike|Entangle|Fog Cloud|Goodberry|Hail of Thorns|Hunter's Mark|Jump|Longstrider|Speak with Animals",
            "Aid|Animal Messenger|Barkskin|Beast Sense|Cordon of Arrows|Darkvision|Enhance Ability|Find Traps|Gust of Wind|Lesser Restoration|Locate Animals or Plants|Locate Object|Magic Weapon|Pass without Trace|Protection from Poison|Silence|Spike Growth|Summon Beast",
            "Conjure Animals|Conjure Barrage|Daylight|Dispel Magic|Elemental Weapon|Lightning Arrow|Meld into Stone|Nondetection|Plant Growth|Protection from Energy|Revivify|Speak with Plants|Summon Fey|Water Breathing|Water Walk|Wind Wall",
            "Conjure Woodland Beings|Dominate Beast|Freedom of Movement|Grasping Vine|Locate Creature|Stoneskin|Summon Elemental",
            "Commune with Nature|Conjure Volley|Greater Restoration|Steel Wind Strike|Swift Quiver|Tree Stride",
            "", "", "", ""
        ],
        Sorcerer: [
            "Acid Splash|Blade Ward|Chill Touch|Dancing Lights|Elementalism|Fire Bolt|Friends|Light|Mage Hand|Mending|Message|Mind Sliver|Minor Illusion|Poison Spray|Prestidigitation|Ray of Frost|Shocking Grasp|Sorcerous Burst|Thunderclap|True Strike",
            "Burning Hands|Charm Person|Chromatic Orb|Color Spray|Comprehend Languages|Detect Magic|Disguise Self|Expeditious Retreat|False Life|Feather Fall|Fog Cloud|Grease|Ice Knife|Jump|Mage Armor|Magic Missile|Ray of Sickness|Shield|Silent Image|Sleep|Thunderwave|Witch Bolt",
            "Alter Self|Arcane Vigor|Blindness/Deafness|Blur|Cloud of Daggers|Crown of Madness|Darkness|Darkvision|Detect Thoughts|Dragon's Breath|Enhance Ability|Enlarge/Reduce|Flame Blade|Flaming Sphere|Gust of Wind|Hold Person|Invisibility|Knock|Levitate|Magic Weapon|Mind Spike|Mirror Image|Misty Step|Phantasmal Force|Scorching Ray|See Invisibility|Shatter|Spider Climb|Suggestion|Web",
            "Blink|Clairvoyance|Counterspell|Daylight|Dispel Magic|Fear|Fireball|Fly|Gaseous Form|Haste|Hypnotic Pattern|Lightning Bolt|Major Image|Protection from Energy|Sleet Storm|Slow|Stinking Cloud|Tongues|Vampiric Touch|Water Breathing|Water Walk",
            "Banishment|Blight|Charm Monster|Confusion|Dimension Door|Dominate Beast|Fire Shield|Greater Invisibility|Ice Storm|Polymorph|Stoneskin|Vitriolic Sphere|Wall of Fire",
            "Animate Objects|Arcane Hand|Cloudkill|Cone of Cold|Creation|Dominate Person|Hold Monster|Insect Plague|Seeming|Synaptic Static|Telekinesis|Teleportation Circle|Wall of Stone",
            "Arcane Gate|Chain Lightning|Circle of Death|Disintegrate|Eyebite|Flesh to Stone|Globe of Invulnerability|Mass Suggestion|Move Earth|Freezing Sphere|Sunbeam|True Seeing",
            "Delayed Blast Fireball|Etherealness|Finger of Death|Fire Storm|Plane Shift|Prismatic Spray|Reverse Gravity|Teleport",
            "Demiplane|Dominate Monster|Earthquake|Incendiary Cloud|Power Word Stun|Sunburst",
            "Gate|Meteor Swarm|Power Word Kill|Time Stop|Wish"
        ],
        Warlock: [
            "Blade Ward|Chill Touch|Eldritch Blast|Friends|Mage Hand|Mind Sliver|Minor Illusion|Poison Spray|Prestidigitation|Thunderclap|Toll the Dead|True Strike",
            "Armor of Agathys|Arms of Hadar|Bane|Charm Person|Comprehend Languages|Detect Magic|Expeditious Retreat|Hellish Rebuke|Hex|Illusory Script|Protection from Evil and Good|Speak with Animals|Hideous Laughter|Unseen Servant|Witch Bolt",
            "Cloud of Daggers|Crown of Madness|Darkness|Enthrall|Hold Person|Invisibility|Mind Spike|Mirror Image|Misty Step|Ray of Enfeeblement|Spider Climb|Suggestion",
            "Counterspell|Dispel Magic|Fear|Fly|Gaseous Form|Hunger of Hadar|Hypnotic Pattern|Magic Circle|Major Image|Remove Curse|Summon Fey|Summon Undead|Tongues|Vampiric Touch",
            "Banishment|Blight|Charm Monster|Dimension Door|Hallucinatory Terrain|Summon Aberration",
            "Contact Other Plane|Dream|Hold Monster|Jallarzi's Storm of Radiance|Mislead|Planar Binding|Scrying|Synaptic Static|Teleportation Circle",
            "Arcane Gate|Circle of Death|Create Undead|Eyebite|Summon Fiend|Tasha's Bubbling Cauldron|True Seeing",
            "Etherealness|Finger of Death|Forcecage|Plane Shift",
            "Befuddlement|Demiplane|Dominate Monster|Glibness|Power Word Stun",
            "Astral Projection|Foresight|Gate|Imprisonment|Power Word Kill|True Polymorph|Weird"
        ],
        Wizard: [
            "Acid Splash|Blade Ward|Chill Touch|Dancing Lights|Elementalism|Fire Bolt|Friends|Light|Mage Hand|Mending|Message|Mind Sliver|Minor Illusion|Poison Spray|Prestidigitation|Ray of Frost|Shocking Grasp|Thunderclap|Toll the Dead|True Strike",
            "Alarm|Burning Hands|Charm Person|Chromatic Orb|Color Spray|Comprehend Languages|Detect Magic|Disguise Self|Expeditious Retreat|False Life|Feather Fall|Find Familiar|Fog Cloud|Grease|Ice Knife|Identify|Illusory Script|Jump|Longstrider|Mage Armor|Magic Missile|Protection from Evil and Good|Ray of Sickness|Shield|Silent Image|Sleep|Hideous Laughter|Floating Disk|Thunderwave|Unseen Servant|Witch Bolt",
            "Alter Self|Arcane Lock|Arcane Vigor|Augury|Blindness/Deafness|Blur|Cloud of Daggers|Continual Flame|Crown of Madness|Darkness|Darkvision|Detect Thoughts|Dragon's Breath|Enhance Ability|Enlarge/Reduce|Flaming Sphere|Gentle Repose|Gust of Wind|Hold Person|Invisibility|Knock|Levitate|Locate Object|Magic Mouth|Magic Weapon|Acid Arrow|Mind Spike|Mirror Image|Misty Step|Arcanist's Magic Aura|Phantasmal Force|Ray of Enfeeblement|Rope Trick|Scorching Ray|See Invisibility|Shatter|Spider Climb|Suggestion|Web",
            "Animate Dead|Bestow Curse|Blink|Clairvoyance|Counterspell|Dispel Magic|Fear|Feign Death|Fireball|Fly|Gaseous Form|Glyph of Warding|Haste|Hypnotic Pattern|Tiny Hut|Lightning Bolt|Magic Circle|Major Image|Nondetection|Phantom Steed|Protection from Energy|Remove Curse|Sending|Sleet Storm|Slow|Speak with Dead|Stinking Cloud|Summon Fey|Summon Undead|Tongues|Vampiric Touch|Water Breathing",
            "Arcane Eye|Banishment|Blight|Charm Monster|Confusion|Conjure Minor Elementals|Control Water|Dimension Door|Divination|Black Tentacles|Fabricate|Fire Shield|Greater Invisibility|Hallucinatory Terrain|Ice Storm|Secret Chest|Locate Creature|Faithful Hound|Private Sanctum|Resilient Sphere|Phantasmal Killer|Polymorph|Stone Shape|Stoneskin|Summon Aberration|Summon Construct|Summon Elemental|Vitriolic Sphere|Wall of Fire",
            "Animate Objects|Arcane Hand|Circle of Power|Cloudkill|Cone of Cold|Conjure Elemental|Contact Other Plane|Creation|Dominate Person|Dream|Geas|Hold Monster|Jallarzi's Storm of Radiance|Legend Lore|Mislead|Modify Memory|Passwall|Planar Binding|Telepathic Bond|Scrying|Seeming|Steel Wind Strike|Summon Dragon|Synaptic Static|Telekinesis|Teleportation Circle|Wall of Force|Wall of Stone|Yolande's Regal Presence",
            "Arcane Gate|Chain Lightning|Circle of Death|Contingency|Create Undead|Disintegrate|Instant Summons|Eyebite|Flesh to Stone|Globe of Invulnerability|Guards and Wards|Magic Jar|Mass Suggestion|Move Earth|Freezing Sphere|Irresistible Dance|Programmed Illusion|Summon Fiend|Sunbeam|Tasha's Bubbling Cauldron|True Seeing|Wall of Ice",
            "Delayed Blast Fireball|Etherealness|Finger of Death|Forcecage|Mirage Arcane|Magnificent Mansion|Arcane Sword|Plane Shift|Prismatic Spray|Project Image|Reverse Gravity|Sequester|Simulacrum|Symbol|Teleport",
            "Antimagic Field|Antipathy/Sympathy|Befuddlement|Clone|Control Weather|Demiplane|Dominate Monster|Incendiary Cloud|Maze|Mind Blank|Power Word Stun|Sunburst|Telepathy",
            "Astral Projection|Foresight|Gate|Imprisonment|Meteor Swarm|Power Word Kill|Prismatic Wall|Shapechange|Time Stop|True Polymorph|Weird|Wish"
        ]
    };
    const spells = ["spells-2024-srd.json", "spells-2024-phb-supplement.json"]
        .flatMap(file => JSON.parse(readFileSync(join(__dirname, "data", file), "utf8").replace(/^\uFEFF/, "")));
    assert.equal(spells.length, 391, "Complete 2024 PHB spell catalog");
    assert.equal(new Set(spells.map(spell => spell.key)).size, spells.length, "Unique spell keys");
    assert.equal(new Set(spells.map(spell => spell.name)).size, spells.length, "No duplicate spell names");
    const expectedNames = new Set(Object.values(expected).flatMap(lists => lists.flatMap(names => names ? names.split("|") : [])));
    assert.deepEqual(spells.map(spell => spell.name).sort(), [...expectedNames].sort());
    for (const [className, lists] of Object.entries(expected)) {
        assert.equal(lists.length, 10, `${className}: cantrips through level 9`);
        for (const [level, names] of lists.entries()) {
            const actual = spells.filter(spell => spell.level === level
                && spell.classes.some(item => item.name === className)).map(spell => spell.name).sort();
            assert.deepEqual(actual, names ? names.split("|").sort() : [], `${className}, level ${level}`);
        }
    }
});

test("Spell library loader includes both local databases and preserves migrated selection keys", async () => {
    const requests = [];
    const { loadSpellLibrary, spellArea, getSpellCardParts } = app("half", "none", () => true, async url => {
        requests.push(url);
        return {
            ok: true,
            json: async () => JSON.parse(readFileSync(join(__dirname, url), "utf8").replace(/^\uFEFF/, ""))
        };
    });
    const spells = await loadSpellLibrary();
    assert.deepEqual(requests, ["./data/spells-2024-srd.json", "./data/spells-2024-phb-supplement.json"]);
    for (const key of ["local-word-of-radiance", "local-thunderclap", "local-toll-the-dead"]) {
        assert.equal(spells.filter(spell => spell.key === key).length, 1, key);
    }
    const supplementKeys = new Set(JSON.parse(readFileSync(
        join(__dirname, "data", "spells-2024-phb-supplement.json"), "utf8")).map(spell => spell.key));
    const supplement = spells.filter(spell => supplementKeys.has(spell.key));
    assert.equal(supplement.length, 51);
    for (const spell of supplement) {
        assert.ok(spell.desc.length > 0, spell.name);
        assert.ok(spell.classes.length > 0, spell.name);
        assert.match(spell.document.permalink, /^https:\/\/5e\.tools\/spells\.html#/);
        for (const field of ["verbal", "somatic", "material", "concentration", "ritual", "attack_roll"]) {
            assert.equal(typeof spell[field], "boolean", `${spell.name}: ${field}`);
        }
        assert.equal(getSpellCardParts(spell)[0].description, spell.desc);
        if (spell.shape_type) {
            const area = spellArea(spell);
            assert.equal(area.type, spell.shape_type, spell.name);
            assert.equal(area.size, spell.shape_size, spell.name);
        }
        if (spell.material) assert.ok(spell.material_specified.length > 0, spell.name);
    }
    const byName = name => spells.find(spell => spell.name === name);
    assert.equal(byName("Armor of Agathys").casting_time, "bonus action");
    assert.equal(byName("Thunderous Smite").concentration, false);
    assert.equal(byName("Wrathful Smite").concentration, false);
    assert.deepEqual(Array.from(byName("Wrathful Smite").damage_types), ["necrotic"]);
    assert.equal(byName("Blade Ward").concentration, true);
    assert.equal(byName("Friends").saving_throw_ability, "wisdom");
    assert.equal(byName("Word of Radiance").material_specified, "a sunburst token");
});

test("Higher-level PHB summaries retain 2024 timing, saving throws, materials, and scaling", () => {
    const spells = JSON.parse(readFileSync(join(__dirname, "data", "spells-2024-phb-supplement.json"), "utf8"));
    const byName = name => spells.find(spell => spell.name === name);
    const expectedCounts = { 0: 7, 1: 6, 2: 6, 3: 10, 4: 7, 5: 10, 6: 3, 7: 1, 8: 1 };
    for (const [level, count] of Object.entries(expectedCounts)) {
        assert.equal(spells.filter(spell => spell.level === Number(level)).length, count, `Level ${level}`);
    }
    for (const [name, level, damage, save, concentration] of [
        ["Blinding Smite", 3, "3d8", "constitution", false],
        ["Staggering Smite", 4, "4d6", "wisdom", false],
        ["Banishing Smite", 5, "5d10", "charisma", true]
    ]) {
        const spell = byName(name);
        assert.equal(spell.level, level, name);
        assert.equal(spell.casting_time, "bonus action", name);
        assert.equal(spell.damage_roll, damage, name);
        assert.equal(spell.saving_throw_ability, save, name);
        assert.equal(spell.concentration, concentration, name);
        assert.match(spell.desc, /immediately after hitting a creature/, name);
    }
    assert.match(byName("Banishing Smite").desc, /50 Hit Points or fewer/);
    assert.match(byName("Blinding Smite").desc, /no initial save/);
    assert.equal(byName("Aura of Vitality").casting_time, "action");
    assert.match(byName("Aura of Vitality").desc, /On casting.*start of each of your turns/);
    assert.match(byName("Cloud of Daggers").desc, /Magic action.*teleport.*30 feet/);
    assert.match(byName("Cloud of Daggers").higher_level, /2d4/);
    assert.equal(byName("Feign Death").ritual, true);
    assert.equal(byName("Feign Death").concentration, false);
    assert.equal(byName("Synaptic Static").saving_throw_ability, "intelligence");
    assert.equal(byName("Synaptic Static").concentration, false);
    assert.equal(byName("Power Word Fortify").target_count, 6);
    assert.match(byName("Power Word Fortify").desc, /120 Temporary Hit Points/);
    assert.match(byName("Hunger of Hadar").higher_level, /either the Cold or the Acid/);
    assert.match(byName("Jallarzi's Storm of Radiance").desc, /40-foot height/);
    assert.match(byName("Jallarzi's Storm of Radiance").higher_level, /1d10 to each damage type/);
    assert.match(byName("Elemental Weapon").higher_level, /level 5 or 6.*2d4.*level 7.*3d4/);
    assert.equal(byName("Tasha's Bubbling Cauldron").material_cost, "500 GP");
    assert.equal(byName("Tasha's Bubbling Cauldron").concentration, false);
    assert.match(byName("Tasha's Bubbling Cauldron").desc, /until you cast this spell again/);
    for (const [name, cost, statBlock] of [
        ["Summon Aberration", "400 GP", "Aberrant Spirit"],
        ["Summon Celestial", "500 GP", "Celestial Spirit"],
        ["Summon Fey", "300 GP", "Fey Spirit"],
        ["Summon Fiend", "600 GP", "Fiendish Spirit"],
        ["Summon Undead", "300 GP", "Undead Spirit"],
        ["Summon Beast", "200 GP", "Bestial Spirit"],
        ["Summon Construct", "400 GP", "Construct Spirit"],
        ["Summon Elemental", "400 GP", "Elemental Spirit"]
    ]) {
        const spell = byName(name);
        assert.equal(spell.material_cost, cost, name);
        assert.equal(spell.material_consumed, false, name);
        assert.equal(spell.concentration, true, name);
        assert.equal(spell.range, 90, name);
        assert.equal(spell.duration, "1 hour", name);
        assert.ok(spell.desc.includes(statBlock), name);
        assert.match(spell.desc, /immediately after you.*Initiative/);
        assert.match(spell.desc, /Without orders, it Dodges/);
        assert.match(spell.higher_level, /level of the slot spent/);
    }
});

test("Remaining PHB summaries retain 2024 attack types, timing, costs, and special ranges", () => {
    const spells = JSON.parse(readFileSync(join(__dirname, "data", "spells-2024-phb-supplement.json"), "utf8"));
    const byName = name => spells.find(spell => spell.name === name);
    const { spellKeywords, spellArea } = app();
    for (const [name, damage] of [
        ["Thorn Whip", "1d6"],
        ["Grasping Vine", "4d8"],
        ["Steel Wind Strike", "6d10"]
    ]) {
        const spell = byName(name);
        assert.equal(spell.attack_roll, true, name);
        assert.equal(spell.custom_attack, "melee", name);
        assert.equal(spell.damage_roll, damage, name);
        assert.equal(spellKeywords(spell)["attack-save"].text, "Melee Spell", name);
        assert.ok(spell.range >= 30, name);
    }
    assert.match(byName("Thorn Whip").desc, /Large or smaller.*10 feet/);
    assert.match(byName("Thorn Whip").higher_level, /2d6.*5.*3d6.*11.*4d6.*17/);
    assert.equal(byName("Grasping Vine").casting_time, "bonus action");
    assert.equal(byName("Grasping Vine").concentration, true);
    assert.match(byName("Grasping Vine").desc, /Huge or smaller.*Grappled/);
    assert.match(byName("Grasping Vine").higher_level, /grapple capacity/);
    assert.equal(byName("Steel Wind Strike").target_count, 5);
    assert.equal(byName("Steel Wind Strike").material_cost, "0.1 GP");
    assert.equal(byName("Steel Wind Strike").verbal, false);
    assert.equal(byName("Arcane Vigor").casting_time, "bonus action");
    assert.match(byName("Arcane Vigor").desc, /one or two.*Hit Point Dice.*expend/);
    assert.match(byName("Arcane Vigor").higher_level, /one additional/);
    assert.equal(byName("Beast Sense").ritual, true);
    assert.equal(byName("Beast Sense").concentration, true);
    assert.match(byName("Beast Sense").desc, /retaining access to your own senses/);
    for (const [name, shape, size, damage] of [
        ["Conjure Barrage", "cone", 60, "5d8"],
        ["Conjure Volley", "cylinder", 40, "8d8"]
    ]) {
        const spell = byName(name);
        assert.equal(spellArea(spell).type, shape, name);
        assert.equal(spellArea(spell).size, size, name);
        assert.equal(spell.damage_roll, damage, name);
        assert.deepEqual(spell.damage_types, ["force"], name);
        assert.equal(spell.material_cost, "0.01 GP", name);
        assert.equal(spell.material_consumed, false, name);
    }
    assert.match(byName("Conjure Volley").desc, /20-foot height/);
    assert.equal(byName("Cordon of Arrows").duration, "8 hours");
    assert.match(byName("Cordon of Arrows").higher_level, /two more pieces/);
    for (const name of ["Hail of Thorns", "Lightning Arrow"]) {
        const spell = byName(name);
        assert.equal(spell.casting_time, "bonus action", name);
        assert.equal(spell.concentration, false, name);
        assert.equal(spell.duration, "instantaneous", name);
        assert.match(spell.desc, /immediately after/, name);
    }
    assert.match(byName("Lightning Arrow").desc, /hits or misses/);
    assert.match(byName("Lightning Arrow").desc, /Replace all damage and other effects/);
    assert.match(byName("Lightning Arrow").higher_level, /both the primary and splash/);
    assert.equal(byName("Swift Quiver").material_cost, "1 GP");
    assert.equal(byName("Swift Quiver").concentration, true);
    assert.match(byName("Swift Quiver").desc, /On casting, make two attacks/);
    assert.equal(byName("Telepathy").level, 8);
    assert.equal(byName("Telepathy").range_text, "Unlimited");
    assert.equal(byName("Telepathy").duration, "24 hours");
    assert.equal(byName("Telepathy").concentration, false);
    assert.match(byName("Telepathy").desc, /ends if either participant leaves the other's plane/);
});

test("PHB summaries and upgrades survive continuation-card splitting", () => {
    const spells = JSON.parse(readFileSync(join(__dirname, "data", "spells-2024-phb-supplement.json"), "utf8"));
    const { getSpellCardParts } = app("half", "none", (spell, part) =>
        part.description.length + (part.upgrade || "").length <= 300);
    const normalize = text => text.replace(/\s+/g, " ").trim();
    for (const spell of spells) {
        const parts = getSpellCardParts(spell);
        const upgradeLabel = spell.level === 0 ? "Cantrip Upgrade:" : "Using a Higher-Level Spell Slot:";
        const description = parts.filter(part => !part.description.startsWith(upgradeLabel))
            .map(part => part.description).join(" ");
        assert.equal(normalize(description), normalize(spell.desc), spell.name);
        if (spell.higher_level) {
            const upgrade = parts.map(part => part.upgrade || "").filter(Boolean).join(" ")
                || parts.filter(part => part.description.startsWith(upgradeLabel))
                    .map(part => part.description.replace(upgradeLabel, "")).join(" ");
            assert.equal(normalize(upgrade), normalize(spell.higher_level), spell.name);
        }
        assert.equal(parts[0].continuation, false, spell.name);
        assert.ok(parts.slice(1).every(part => part.continuation), spell.name);
    }
});

test("Spell library loader rejects unavailable or malformed supplemental data", async () => {
    for (const response of [
        { ok: false, status: 404 },
        { ok: true, json: async () => ({}) },
        { ok: true, json: async () => { throw new SyntaxError("Invalid JSON"); } }
    ]) {
        const { loadSpellLibrary } = app("half", "none", null, async url =>
            url.includes("supplement") ? response : { ok: true, json: async () => [] });
        await assert.rejects(loadSpellLibrary, /404.*supplement|JSON array.*supplement|Invalid JSON/);
    }
});

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
    const { buildAreaDiagram, areaGridUnit } = app();
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
        for (const diagram of [small, limit, large]) {
            assert.ok(!descendants(diagram).some(node => node.textContent?.startsWith("Grid:")));
        }
        assert.equal(areaGridUnit({ type, size: circular ? 5 : 10, unit: "feet" }), 5);
        assert.equal(areaGridUnit({ type, size: circular ? 15 : 30, unit: "feet" }), 5);
        assert.equal(areaGridUnit({ type, size: circular ? 30 : 60, unit: "feet" }), 10);
    }
    const circle = size => descendants(make("sphere", size)).find(node => node.tag === "circle");
    assert.equal(Number(circle(5).attributes.r) * 3, Number(circle(15).attributes.r));
    assert.equal(circle(30).attributes.r, circle(15).attributes.r);
    assert.ok(Math.abs(260 - Number(circle(15).attributes.r) - 60 - 200 / 7) < 1e-10);
    const longLine = descendants(make("line", 5, 100));
    assert.equal(areaGridUnit({ type: "line", size: 5, length: 100, unit: "feet" }), 20);
    const rectangle = longLine.find(node => node.tag === "rect" && node.attributes.stroke);
    assert.ok(Number(rectangle.attributes.width) <= 2400 / 7);
    for (const name of ["cone", "cube-15", "cube-20", "sphere-10", "sphere-20", "square"]) {
        const source = readFileSync(join(__dirname, "img", `aoe-${name}.svg`), "utf8");
        assert.match(source, /viewBox="0 0 600 540" width="600" height="540"/);
        assert.match(source, /data-grid-unit="5"/);
        assert.doesNotMatch(source, /Grid:/);
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
        const legend = card.querySelector('[data-field="grid-legend"]');
        assert.equal(legend.hidden, false);
        assert.equal(legend.textContent, `Grid: ${size > 15 && type === "sphere" ? 10 : 5} feet / square`);
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

test("HTML grid captions are hidden without an area and preserve cylinder notes", () => {
    const { buildSpellBack } = app();
    const spell = {
        name: "Test Spell", level: 0, range_text: "Self",
        casting_time: "Action", duration: "Instantaneous", desc: ""
    };
    const plain = buildSpellBack(spell, {});
    assert.equal(plain.querySelector('[data-field="grid-legend"]').hidden, true);
    const cylinder = buildSpellBack({ ...spell, shape_type: "cylinder", shape_size: 30 }, {});
    const legend = cylinder.querySelector('[data-field="grid-legend"]');
    assert.equal(legend.hidden, false);
    assert.equal(legend.textContent, "Grid: 10 feet / square (radius shown above)");
    const template = readFileSync(join(__dirname, "index.html"), "utf8");
    assert.match(template, /<span class="back-grid-legend" data-field="grid-legend" hidden><\/span>/);
});

test("All supplied area images use fresh URLs and leave grid captions to HTML", () => {
    const { buildSpellBack, areaImage } = app();
    for (const [type, size] of [["sphere", 5], ["sphere", 10], ["cube", 15], ["cube", 20], ["cone", 15], ["square", 10]]) {
        const file = areaImage({ type, size, unit: "feet" });
        const source = readFileSync(join(__dirname, "img", file), "utf8");
        assert.doesNotMatch(source, /Grid\s*:/i, file);
        const card = buildSpellBack({
            name: "Test Area", level: 0, shape_type: type, shape_size: size,
            range_text: "Self", casting_time: "Action", duration: "Instantaneous", desc: ""
        }, {});
        const image = card.querySelector('[data-field="art"]').children.find(node => node.tag === "img");
        assert.equal(image.src, `./img/${file}?v=html-grid-legend`);
        assert.equal(card.querySelector('[data-field="grid-legend"]').textContent, "Grid: 5 feet / square");
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
