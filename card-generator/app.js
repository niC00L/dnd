const DATA_URL = "./data/spells-2024-srd.json";
const SELECTION_STORAGE_KEY = "card-generator.selected-spells";
const CUSTOM_CARDS_STORAGE_KEY = "card-generator.custom-cards";
const CUSTOM_CARDS_DATA_URL = "./data/custom-spells.json";
const SPELL_CLASSES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const CASTING_TIMES = ["Action", "Bonus Action", "Reaction", "1 minute", "10 minutes", "1 hour", "8 hours", "12 hours", "24 hours", "Special"];
const TEMPLATE_ONLY_SPELLS = [{
    key: "local-word-of-radiance",
    name: "Word of Radiance",
    level: 0,
    school: { name: "Evocation" },
    classes: [{ name: "Cleric" }],
    desc: "Burning radiance erupts from you in a 5-foot Emanation. Each creature of your choice that you can see in it must succeed on a Constitution saving throw or take 1d6 Radiant damage.",
    higher_level: "The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).",
    range_text: "Self",
    range: 0,
    shape_size: 5,
    shape_size_unit: "feet",
    shape_type: "emanation",
    casting_time: "action",
    duration: "instantaneous",
    saving_throw_ability: "constitution",
    attack_roll: false,
    damage_roll: "1d6",
    damage_types: ["radiant"],
    verbal: true,
    somatic: false,
    material: true,
    material_specified: "",
    concentration: false,
    ritual: false
}, {
    key: "local-thunderclap",
    name: "Thunderclap",
    level: 0,
    school: { name: "Evocation" },
    classes: ["Bard", "Druid", "Sorcerer", "Warlock", "Wizard"].map(name => ({ name })),
    desc: "Create a thunderous burst audible within 100 feet. Each creature other than you within 5 feet must make a Constitution saving throw, taking 1d6 Thunder damage on a failure.",
    higher_level: "Damage increases by 1d6 at character levels 5, 11, and 17.",
    range_text: "Self",
    range: 5,
    shape_size: 5,
    shape_size_unit: "feet",
    shape_type: "sphere",
    casting_time: "action",
    duration: "instantaneous",
    saving_throw_ability: "constitution",
    attack_roll: false,
    damage_roll: "1d6",
    damage_types: ["thunder"],
    verbal: false,
    somatic: true,
    material: false,
    material_specified: "",
    concentration: false,
    ritual: false
}, {
    key: "local-toll-the-dead",
    name: "Toll the Dead",
    level: 0,
    school: { name: "Necromancy" },
    classes: ["Cleric", "Warlock", "Wizard"].map(name => ({ name })),
    desc: "A distant bell sounds to one creature within range. It must make a Wisdom saving throw, taking 1d8 Necrotic damage on a failure, or 1d12 if it is missing any Hit Points.",
    higher_level: "The damage increases to 2d8 or 2d12 at level 5, 3d8 or 3d12 at level 11, and 4d8 or 4d12 at level 17.",
    range_text: "60 feet",
    range: 60,
    casting_time: "action",
    duration: "instantaneous",
    saving_throw_ability: "wisdom",
    attack_roll: false,
    damage_roll: "1d8 or 1d12",
    damage_types: ["necrotic"],
    verbal: true,
    somatic: true,
    material: false,
    material_specified: "",
    concentration: false,
    ritual: false
}];
const ICON_URL = "./img/icons/";
const DAMAGE_ICONS = new Set([
    "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
    "piercing", "poison", "psychic", "radiant", "slashing", "thunder"
]);
const CONDITION_ICONS = [
    "blinded", "charmed", "deafened", "exhaustion", "frightened", "invisible",
    "paralyzed", "petrified", "poisoned", "prone", "restrained", "unconscious"
];
const AREA_ICONS = new Set(["cone", "cube", "cylinder", "emanation", "sphere", "square"]);
const ABILITY_ABBREVIATIONS = {
    strength: "STR", dexterity: "DEX", constitution: "CON",
    intelligence: "INT", wisdom: "WIS", charisma: "CHA"
};

const elements = {
    search: document.querySelector("#search-input"),
    level: document.querySelector("#level-filter"),
    school: document.querySelector("#school-filter"),
    className: document.querySelector("#class-filter"),
    source: document.querySelector("#source-filter"),
    list: document.querySelector("#spell-list"),
    resultCount: document.querySelector("#result-count"),
    selectionSummary: document.querySelector("#selection-summary"),
    selectedCount: document.querySelector("#selected-count"),
    selectionNote: document.querySelector("#selection-note"),
    selectedCards: document.querySelector("#selected-cards"),
    selectVisible: document.querySelector("#select-visible"),
    clearSelection: document.querySelector("#clear-selection"),
    printButton: document.querySelector("#print-button"),
    printCount: document.querySelector("#print-count"),
    printRoot: document.querySelector("#print-root"),
    cardTemplate: document.querySelector("#spell-card-template"),
    cardSizeInputs: [...document.querySelectorAll('input[name="card-size"]')]
};

const state = {
    spells: [],
    filtered: [],
    customSpells: [],
    selected: new Map()
};
const customEditor = {
    dialog: document.querySelector("#custom-card-dialog"),
    form: document.querySelector("#custom-card-form"),
    title: document.querySelector("#custom-card-title"),
    preview: document.querySelector("#custom-card-preview"),
    error: document.querySelector("#custom-card-error"),
    createButton: document.querySelector("#create-custom-card"),
    classSearch: document.querySelector("#custom-class-search"),
    classOptions: document.querySelector("#custom-class-options"),
    selectedClasses: document.querySelector("#custom-selected-classes"),
    classes: new Set(),
    key: null
};
let customSpellsFileHandle;
const cardPartsCache = new WeakMap();
let cardMeasurementRoot;

function cardSizeSettings() {
    const standard = document.body.dataset.cardSize === "standard";
    return {
        cardsPerPage: standard ? 9 : 16,
        maxTextLength: 900,
        label: standard ? "Standard" : "Half size",
        dimensions: standard ? "63.5 x 88.9 mm" : "44.5 x 63.5 mm"
    };
}

function levelLabel(level) {
    if (level === 0) return "Cantrip";
    const suffix = level % 100 >= 11 && level % 100 <= 13
        ? "th"
        : ({ 1: "st", 2: "nd", 3: "rd" }[level % 10] || "th");
    return `${level}${suffix} level`;
}

function titleCase(value) {
    return String(value || "")
        .replaceAll("-", " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatCastingTime(value) {
    const normalized = String(value || "").replace(/(\d)(minutes?|hours?|days?|rounds?)\b/gi, "$1 $2");
    return titleCase(normalized);
}

function displayDuration(spell) {
    const rawDuration = String(spell.duration || "Special").trim();
    return rawDuration.charAt(0).toUpperCase() + rawDuration.slice(1);
}

function populateFilters() {
    const previousValues = [elements.level.value, elements.school.value, elements.className.value];
    for (const filter of [elements.level, elements.school, elements.className]) {
        filter.replaceChildren(filter.firstElementChild);
    }
    const levels = [...new Set(state.spells.map(spell => spell.level))].sort((a, b) => a - b);
    const schools = [...new Set(state.spells.map(spell => spell.school?.name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const classes = [...new Set(state.spells.flatMap(spell => spell.classes || []).map(item => item.name))]
        .sort((a, b) => a.localeCompare(b));

    for (const level of levels) {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = levelLabel(level);
        elements.level.append(option);
    }
    for (const school of schools) {
        const option = document.createElement("option");
        option.value = school;
        option.textContent = school;
        elements.school.append(option);
    }
    for (const className of classes) {
        const option = document.createElement("option");
        option.value = className;
        option.textContent = className;
        elements.className.append(option);
    }
    [elements.level, elements.school, elements.className].forEach((filter, index) => {
        filter.value = [...filter.options].some(option => option.value === previousValues[index])
            ? previousValues[index] : "";
    });
}

function matchesFilters(spell) {
    const searchText = elements.search.value.trim().toLocaleLowerCase();
    const description = (spell.desc || "").toLocaleLowerCase();
    const matchesSearch = !searchText
        || spell.name.toLocaleLowerCase().includes(searchText)
        || description.includes(searchText);
    const matchesLevel = elements.level.value === "" || spell.level === Number(elements.level.value);
    const matchesSchool = elements.school.value === "" || spell.school?.name === elements.school.value;
    const matchesClass = elements.className.value === ""
        || (spell.classes || []).some(item => item.name === elements.className.value);
    const isCustom = state.customSpells.some(custom => custom.key === spell.key);
    const matchesSource = elements.source.value === "" || isCustom === (elements.source.value === "custom");
    return matchesSearch && matchesLevel && matchesSchool && matchesClass && matchesSource;
}

function spellDetails(spell) {
    const classes = (spell.classes || []).map(item => item.name).join(", ");
    return `${levelLabel(spell.level)} · ${spell.school?.name || "Unlisted"} · ${classes}`;
}

function createKeywordIcon(name) {
    const image = document.createElement("img");
    image.className = "keyword-icon";
    image.src = `${ICON_URL}${name}.svg`;
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
}

function keywordContent(card, field, text, icons = []) {
    const value = card.querySelector(`[data-field="${field}"]`);
    value.replaceChildren(...icons.map(createKeywordIcon), document.createTextNode(text || "None"));
}

function formatRangeArea(spell) {
    const range = String(spell.range_text || "Special").replace(/\bfeet\b/gi, "ft").replace(/\bfoot\b/gi, "ft");
    if (spell.shape_type && spell.shape_size) {
        return {
            text: range,
            area: {
                size: `${spell.shape_size} ft`,
                icon: AREA_ICONS.has(spell.shape_type) ? spell.shape_type : "",
                label: titleCase(spell.shape_type)
            }
        };
    }
    return { text: range, area: null };
}

function rangeAreaContent(card, range) {
    const value = card.querySelector('[data-field="range"]');
    const layout = document.createElement("span");
    layout.className = "range-layout";
    const rangeText = document.createElement("span");
    rangeText.textContent = range.text;
    layout.append(rangeText);

    if (range.area) {
        const area = document.createElement("span");
        area.className = "range-area";
        const areaSize = document.createElement("span");
        areaSize.className = "range-area-text";
        areaSize.textContent = `(${range.area.size}`;
        area.append(areaSize);
        if (range.area.icon) area.append(createKeywordIcon(range.area.icon));
        else {
            const areaLabel = document.createElement("span");
            areaLabel.className = "range-area-text";
            areaLabel.textContent = range.area.label;
            area.append(areaLabel);
        }
        const closingParenthesis = document.createElement("span");
        closingParenthesis.className = "range-area-text";
        closingParenthesis.textContent = ")";
        area.append(closingParenthesis);
        layout.append(area);
    }
    value.replaceChildren(layout);
}

function effectSummary(spell) {
    const damageTypes = spell.damage_types || [];
    if (damageTypes.length) {
        const damageText = [spell.damage_roll, ...damageTypes.map(titleCase)].filter(Boolean).join(" ");
        return { text: damageText, icons: damageTypes.filter(type => DAMAGE_ICONS.has(type.toLowerCase())) };
    }

    const description = spell.desc || "";
    if (/\b(regain|regains|restore|restores|healing|heal)\b/i.test(description)) {
        return { text: "Healing", icons: [] };
    }
    const conditions = CONDITION_ICONS.filter(condition => new RegExp(`\\b${condition}\\b`, "i").test(description));
    if (conditions.length) return { text: conditions.map(titleCase).join(", "), icons: conditions };
    if (/\b(subtract|reduce|decrease|weaken|impair)\b/i.test(description)) {
        return { text: "Debuff", icons: [] };
    }
    return { text: "Utility", icons: [] };
}

function spellKeywords(spell) {
    const savingThrow = ABILITY_ABBREVIATIONS[spell.saving_throw_ability];
    let attackSave = "None";
    let attackIcons = [];
    if (savingThrow) {
        attackSave = `${savingThrow} Save`;
    } else if (spell.attack_roll) {
        const melee = spell.custom_attack
            ? spell.custom_attack === "melee"
            : spell.range <= 5 || /touch|melee/i.test(spell.range_text || "");
        attackSave = `${melee ? "Melee" : "Ranged"} Spell`;
        attackIcons = [melee ? "melee_spell" : "ranged_spell"];
    }

    const components = [];
    if (spell.verbal) components.push("V");
    if (spell.somatic) components.push("S");
    if (spell.material) components.push(`M${spell.material_specified ? "*" : ""}`);
    const effect = effectSummary(spell);

    return {
        "casting-time": { text: formatCastingTime(spell.casting_time), icons: spell.ritual ? ["ritual"] : [] },
        range: formatRangeArea(spell),
        duration: { text: displayDuration(spell), icons: spell.concentration ? ["concentration"] : [] },
        "attack-save": { text: attackSave, icons: attackIcons },
        effect,
        components: { text: components.join(", ") || "None", icons: [] }
    };
}

function splitText(text, maxLength = cardSizeSettings().maxTextLength) {
    const chunks = [];
    let remaining = text.trim();
    while (remaining.length > maxLength) {
        let splitAt = remaining.lastIndexOf("\n\n", maxLength);
        if (splitAt < maxLength * 0.45) splitAt = remaining.lastIndexOf("\n", maxLength);
        if (splitAt < maxLength * 0.55) {
            const sentenceBreaks = [...remaining.slice(0, maxLength).matchAll(/[.!?;](?:\s|$)/g)];
            splitAt = sentenceBreaks.length ? sentenceBreaks[sentenceBreaks.length - 1].index + 1 : -1;
        }
        if (splitAt < maxLength * 0.55) splitAt = remaining.lastIndexOf(" ", maxLength);
        if (splitAt < maxLength * 0.6) splitAt = maxLength;
        chunks.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

function normalizeDescription(text) {
    const lines = String(text || "").split(/\r?\n/);
    const normalized = [];
    for (let index = 0; index < lines.length;) {
        if (!lines[index].trim().startsWith("|")) {
            normalized.push(lines[index]);
            index += 1;
            continue;
        }

        const tableLines = [];
        while (index < lines.length && lines[index].trim().startsWith("|")) {
            tableLines.push(lines[index].trim());
            index += 1;
        }
        const rows = tableLines
            .map(line => line.split("|").slice(1, -1).map(cell => cell.trim()))
            .filter(cells => cells.length > 0 && !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
        if (rows.length > 1) {
            const [headers, ...entries] = rows;
            normalized.push(`${headers.join(" / ")}: ${entries.map(entry => entry.join(": ")).join("; ")}`);
        } else {
            normalized.push(...tableLines);
        }
    }
    return normalized.join("\n").trim();
}

function renderDescription(element, text) {
    const fragment = document.createDocumentFragment();
    const emphasis = /(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*]+?\*|_[^_]+?_)/g;
    let cursor = 0;
    for (const match of text.matchAll(emphasis)) {
        if (match.index > cursor) fragment.append(document.createTextNode(text.slice(cursor, match.index)));
        const token = match[0];
        const strong = token.startsWith("**") || token.startsWith("__");
        const node = document.createElement(strong ? "strong" : "em");
        node.textContent = token.slice(strong ? 2 : 1, strong ? -2 : -1);
        fragment.append(node);
        cursor = match.index + token.length;
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    element.replaceChildren(fragment);
}

function descriptionFits(spell, part) {
    if (!cardMeasurementRoot) {
        cardMeasurementRoot = document.createElement("div");
        cardMeasurementRoot.style.cssText = "position:fixed;left:-10000px;top:0;width:300px;visibility:hidden;pointer-events:none;";
        document.body.append(cardMeasurementRoot);
    }
    const card = buildCard(spell, part);
    cardMeasurementRoot.append(card);
    const description = card.querySelector(".card-description");
    const upgrade = card.querySelector(".card-upgrade");
    const fits = description.scrollHeight <= description.clientHeight + 1
        && (upgrade.hidden || (upgrade.scrollHeight <= upgrade.clientHeight + 1
            && description.getBoundingClientRect().bottom <= upgrade.getBoundingClientRect().top));
    card.remove();
    return fits;
}

function fitCardParts(spell, parts) {
    const fittedParts = [];
    for (const part of parts) {
        if (descriptionFits(spell, part)) {
            fittedParts.push(part);
            continue;
        }

        let maxLength = cardSizeSettings().maxTextLength;
        let chunks;
        while (maxLength > 120) {
            chunks = splitText(part.description, maxLength);
            if (descriptionFits(spell, { ...part, description: chunks[0] })) break;
            maxLength = Math.max(120, Math.floor(maxLength * 0.9));
        }
        if (!chunks || !descriptionFits(spell, { ...part, description: chunks[0] })) {
            chunks = splitText(part.description, 120);
        }
        chunks.forEach((description, index) => fittedParts.push({
            ...part,
            description,
            continuation: part.continuation || index > 0,
            upgrade: index === 0 ? part.upgrade : ""
        }));
    }
    return fittedParts;
}

function getSpellCardParts(spell) {
    const sizeKey = document.body.dataset.cardSize || "half";
    const cachedParts = cardPartsCache.get(spell)?.get(sizeKey);
    if (cachedParts) return cachedParts;

    const description = normalizeDescription(spell.desc || "Description unavailable in this data source.");
    const descriptionParts = splitText(description);
    const parts = descriptionParts.map((text, index) => ({
        description: text,
        continuation: index > 0,
        upgrade: ""
    }));

    const fittedParts = fitCardParts(spell, parts);
    if (spell.higher_level) {
        const lastPart = fittedParts[fittedParts.length - 1];
        const upgradedPart = { ...lastPart, upgrade: spell.higher_level };
        if (descriptionFits(spell, upgradedPart)) {
            fittedParts[fittedParts.length - 1] = upgradedPart;
        } else {
            const label = spell.level === 0 ? "Cantrip Upgrade:" : "Using a Higher-Level Spell Slot:";
            const upgradeParts = splitText(`${label} ${spell.higher_level}`)
                .map(description => ({ description, continuation: true, upgrade: "" }));
            fittedParts.push(...fitCardParts(spell, upgradeParts));
        }
    }
    const sizeCache = cardPartsCache.get(spell) || new Map();
    sizeCache.set(sizeKey, fittedParts);
    cardPartsCache.set(spell, sizeCache);
    return fittedParts;
}

function renderSpellList() {
    state.filtered = state.spells.filter(matchesFilters);
    elements.list.replaceChildren();
    elements.list.setAttribute("aria-busy", "false");
    elements.resultCount.textContent = `${state.filtered.length} of ${state.spells.length} spells`;

    if (state.filtered.length === 0) {
        const message = document.createElement("p");
        message.className = "list-message";
        message.textContent = "No spells match these filters.";
        elements.list.append(message);
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const spell of state.filtered) {
        const label = document.createElement("label");
        label.className = "spell-row";
        if (state.selected.has(spell.key)) label.classList.add("is-selected");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selected.has(spell.key);
        checkbox.setAttribute("aria-label", `Select ${spell.name}`);
        checkbox.addEventListener("change", () => toggleSpell(spell));

        const content = document.createElement("span");
        content.className = "spell-row-content";
        const name = document.createElement("span");
        name.className = "spell-row-title";
        name.textContent = spell.name;
        const details = document.createElement("span");
        details.className = "spell-row-details";
        details.textContent = spellDetails(spell);
        content.append(name, details);
        label.append(checkbox, content);
        if (state.customSpells.some(custom => custom.key === spell.key)) {
            details.textContent += " · Custom";
            const row = document.createElement("div");
            row.className = "spell-entry";
            const actions = document.createElement("div");
            actions.className = "custom-card-actions";
            for (const [symbol, action, handler] of [
                ["\u270e", "Edit", () => openCustomEditor(spell)],
                ["\u00d7", "Delete", () => deleteCustomCard(spell)]
            ]) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "icon-button";
                button.textContent = symbol;
                button.title = `${action} ${spell.name}`;
                button.setAttribute("aria-label", `${action} ${spell.name}`);
                button.addEventListener("click", handler);
                actions.append(button);
            }
            row.append(label, actions);
            fragment.append(row);
        } else {
            fragment.append(label);
        }
    }
    elements.list.append(fragment);
}

function buildCard(spell, part = getSpellCardParts(spell)[0]) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const cantrip = spell.level === 0;
    const descriptionLength = part.description.length;
    card.classList.toggle("is-cantrip", cantrip);
    card.classList.toggle("is-long-title", spell.name.length > 22);
    card.classList.toggle("is-continuation", part.continuation);
    card.classList.toggle("is-custom", spell.key.startsWith("custom-"));
    card.classList.toggle("has-upgrade", Boolean(part.upgrade));
    card.classList.toggle("has-material-note", Boolean(spell.material_specified));
    card.classList.toggle("has-no-lower-content", !part.upgrade && !spell.material_specified);
    card.classList.toggle("is-dense", descriptionLength > 200);
    card.classList.toggle("is-very-dense", descriptionLength > 340);

    const setText = (field, value) => {
        card.querySelector(`[data-field="${field}"]`).textContent = value;
    };
    setText("name", part.continuation ? `${spell.name} (CONT.)` : spell.name);
    setText("badge", cantrip ? "C" : String(spell.level));
    setText("badge-prefix", cantrip ? "" : "lvl");
    const keywords = spellKeywords(spell);
    for (const [field, value] of Object.entries(keywords)) {
        if (field === "range") rangeAreaContent(card, value);
        else keywordContent(card, field, value.text, value.icons);
    }
    renderDescription(card.querySelector('[data-field="description"]'), part.description);
    setText("material-note", spell.material_specified ? `* ${spell.material_specified}` : "");
    setText("school", spell.school?.name || "Unlisted");
    const classNames = (spell.classes || []).map(item => item.name).join(", ");
    setText("classes", classNames);
    const classFontSize = Math.max(2.8, Math.min(4.5, 170 / Math.max(classNames.length, 1)));
    card.querySelector('[data-field="classes"]').style.fontSize = `${classFontSize}cqw`;

    if (part.upgrade) {
        card.querySelector('[data-field="upgrade-container"]').hidden = false;
        setText("upgrade-label", cantrip ? "Cantrip Upgrade:" : "Using a Higher-Level Spell Slot:");
        setText("upgrade-text", part.upgrade);
    }
    return card;
}

function updateSelectionSummary() {
    const size = cardSizeSettings();
    const spellCount = state.selected.size;
    const cardCount = [...state.selected.values()].reduce((count, spell) => count + getSpellCardParts(spell).length, 0);
    elements.selectedCount.textContent = String(cardCount);
    elements.printCount.textContent = String(cardCount);
    elements.printButton.disabled = spellCount === 0;
    elements.clearSelection.disabled = spellCount === 0;
    const spellLabel = spellCount === 1 ? "spell" : "spells";
    const cardLabel = cardCount === 1 ? "card" : "cards";
    elements.selectionSummary.textContent = `${spellCount} ${spellLabel} selected · ${cardCount} ${cardLabel}`;
    elements.selectionNote.textContent = `${size.label} · ${size.dimensions} · up to ${size.cardsPerPage} cards per A4 page`;
}

function renderSelectedCards() {
    elements.selectedCards.replaceChildren();
    const selected = [...state.selected.values()];
    if (selected.length === 0) {
        const empty = document.createElement("div");
        empty.className = "selection-empty";
        const mark = document.createElement("span");
        mark.className = "empty-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = "+";
        const message = document.createElement("p");
        message.textContent = "Your selected cards will appear here.";
        empty.append(mark, message);
        elements.selectedCards.append(empty);
    } else {
        const fragment = document.createDocumentFragment();
        for (const spell of selected) {
            for (const part of getSpellCardParts(spell)) fragment.append(buildCard(spell, part));
        }
        elements.selectedCards.append(fragment);
    }
    updateSelectionSummary();
    renderSpellList();
}

function readCustomCard() {
    const fields = customEditor.form.elements;
    const rangeText = fields.range_text.value.trim();
    const attack = fields.attack.value;
    const material = fields.material.checked;
    return {
        key: customEditor.key || "custom-preview",
        name: fields.name.value.trim() || "Custom spell",
        level: Number(fields.level.value),
        school: { name: fields.school.value.trim() || "Custom" },
        classes: [...customEditor.classes].map(name => ({ name })),
        casting_time: fields.casting_time.value.trim(),
        range_text: rangeText,
        range: /self|touch|melee/i.test(rangeText) ? 0 : (Number.parseFloat(rangeText) || 60),
        duration: fields.duration.value.trim(),
        attack_roll: attack === "ranged" || attack === "melee",
        saving_throw_ability: Object.hasOwn(ABILITY_ABBREVIATIONS, attack) ? attack : "",
        damage_roll: fields.damage_roll.value.trim(),
        damage_types: fields.damage_type.value ? [fields.damage_type.value] : [],
        shape_type: fields.shape_type.value || null,
        shape_size: fields.shape_type.value ? Number(fields.shape_size.value) || null : null,
        shape_size_unit: "feet",
        verbal: fields.verbal.checked,
        somatic: fields.somatic.checked,
        material,
        material_specified: material ? fields.material_specified.value.trim() : "",
        concentration: fields.concentration.checked,
        ritual: fields.ritual.checked,
        desc: fields.desc.value.trim(),
        higher_level: fields.higher_level.value.trim(),
        custom_attack: attack
    };
}

function updateCustomPreview() {
    const fields = customEditor.form.elements;
    fields.material_specified.disabled = !fields.material.checked;
    fields.shape_size.required = Boolean(fields.shape_type.value);
    const spell = readCustomCard();
    customEditor.preview.replaceChildren(...getSpellCardParts(spell).map(part => buildCard(spell, part)));
}

function renderClassPicker() {
    customEditor.selectedClasses.replaceChildren();
    for (const name of customEditor.classes) {
        const tag = document.createElement("span");
        tag.className = "selected-class";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "\u00d7";
        remove.title = `Remove ${name}`;
        remove.setAttribute("aria-label", `Remove ${name}`);
        remove.addEventListener("click", () => {
            customEditor.classes.delete(name);
            renderClassPicker();
            updateCustomPreview();
            customEditor.classSearch.focus();
        });
        tag.append(document.createTextNode(name), remove);
        customEditor.selectedClasses.append(tag);
    }
    customEditor.classOptions.replaceChildren();
    const query = customEditor.classSearch.value.trim().toLocaleLowerCase();
    const names = [...new Set([...SPELL_CLASSES, ...customEditor.classes])]
        .filter(name => name.toLocaleLowerCase().includes(query));
    for (const name of names) {
        const option = document.createElement("div");
        option.className = "class-option";
        option.tabIndex = 0;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(customEditor.classes.has(name)));
        option.textContent = `${customEditor.classes.has(name) ? "\u2713 " : ""}${name}`;
        const toggle = () => {
            if (customEditor.classes.has(name)) customEditor.classes.delete(name);
            else customEditor.classes.add(name);
            customEditor.classSearch.value = "";
            renderClassPicker();
            updateCustomPreview();
            customEditor.classSearch.focus();
            setClassPickerOpen(false);
        };
        option.addEventListener("click", toggle);
        option.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const next = event.key === "ArrowDown" ? option.nextElementSibling : option.previousElementSibling;
                (next || customEditor.classSearch).focus();
            } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                customEditor.classSearch.focus();
                setClassPickerOpen(false);
            }
        });
        customEditor.classOptions.append(option);
    }
    if (!names.length) {
        const empty = document.createElement("p");
        empty.className = "class-empty";
        empty.textContent = "No matching classes";
        customEditor.classOptions.append(empty);
    }
}

function setClassPickerOpen(open) {
    customEditor.classOptions.hidden = !open;
    customEditor.classSearch.setAttribute("aria-expanded", String(open));
}

function setEditorOption(select, value) {
    for (const option of [...select.options]) {
        if (option.dataset.legacy) option.remove();
    }
    if (![...select.options].some(option => option.value === value)) {
        const option = new Option(value, value);
        option.dataset.legacy = "true";
        select.add(option);
    }
    select.value = value;
}

function openCustomEditor(spell = null) {
    customEditor.form.reset();
    customEditor.classes = new Set((spell?.classes || []).map(item => item.name));
    customEditor.classSearch.value = "";
    renderClassPicker();
    setClassPickerOpen(false);
    customEditor.key = spell?.key || null;
    customEditor.title.textContent = spell ? "Edit custom card" : "New custom card";
    customEditor.error.hidden = true;
    if (spell) {
        const fields = customEditor.form.elements;
        for (const field of ["name", "level", "range_text", "duration", "damage_roll", "shape_size", "material_specified", "desc", "higher_level"]) {
            fields[field].value = spell[field] ?? "";
        }
        setEditorOption(fields.school, spell.school?.name || "Custom");
        const castingTime = formatCastingTime(spell.casting_time).replaceAll("-", " ");
        setEditorOption(fields.casting_time, CASTING_TIMES.find(time => time.toLowerCase() === castingTime.toLowerCase()) || castingTime);
        fields.attack.value = spell.custom_attack || spell.saving_throw_ability || "none";
        fields.damage_type.value = spell.damage_types?.[0] || "";
        fields.shape_type.value = spell.shape_type || "";
        for (const field of ["verbal", "somatic", "material", "concentration", "ritual"]) fields[field].checked = Boolean(spell[field]);
    }
    customEditor.dialog.showModal();
    updateCustomPreview();
    customEditor.form.elements.name.focus();
}

function storeCustomCards(spells) {
    try {
        localStorage.setItem(CUSTOM_CARDS_STORAGE_KEY, JSON.stringify(spells));
        return true;
    } catch (error) {
        console.warn("Could not save custom cards.", error);
        return false;
    }
}

function refreshCustomLibrary() {
    state.spells.sort((first, second) => first.name.localeCompare(second.name));
    populateFilters();
    renderSelectedCards();
}

function deleteCustomCard(spell) {
    if (!window.confirm(`Delete custom card "${spell.name}"?`)) return;
    const remaining = state.customSpells.filter(item => item.key !== spell.key);
    if (!storeCustomCards(remaining)) {
        window.alert("Could not delete the card. Browser storage is unavailable or full.");
        return;
    }
    state.customSpells = remaining;
    state.spells = state.spells.filter(item => item.key !== spell.key);
    state.selected.delete(spell.key);
    saveSelection();
    refreshCustomLibrary();
}

function isCustomSpell(spell) {
    return spell && typeof spell.key === "string" && spell.key.startsWith("custom-")
        && typeof spell.name === "string" && Boolean(spell.name.trim()) && spell.name.length <= 80
        && typeof spell.desc === "string" && spell.desc.length <= 20000
        && typeof spell.school?.name === "string" && spell.school.name.length <= 40
        && Number.isInteger(spell.level) && spell.level >= 0 && spell.level <= 9
        && Array.isArray(spell.classes) && spell.classes.every(item => item && typeof item.name === "string" && item.name.length <= 40)
        && Array.isArray(spell.damage_types) && spell.damage_types.every(type => DAMAGE_ICONS.has(type))
        && typeof spell.higher_level === "string" && spell.higher_level.length <= 5000
        && ["casting_time", "range_text", "duration", "damage_roll", "material_specified"].every(field => typeof spell[field] === "string")
        && ["verbal", "somatic", "material", "concentration", "ritual", "attack_roll"].every(field => typeof spell[field] === "boolean")
        && Number.isFinite(spell.range)
        && (spell.shape_type === null || AREA_ICONS.has(spell.shape_type))
        && (spell.shape_size === null || (Number.isFinite(spell.shape_size) && spell.shape_size > 0))
        && (spell.saving_throw_ability === "" || Object.hasOwn(ABILITY_ABBREVIATIONS, spell.saving_throw_ability))
        && (spell.custom_attack === undefined || ["none", "ranged", "melee", ...Object.keys(ABILITY_ABBREVIATIONS)].includes(spell.custom_attack));
}

async function restoreCustomCards() {
    try {
        let stored = null;
        try {
            stored = localStorage.getItem(CUSTOM_CARDS_STORAGE_KEY);
        } catch (error) {
            console.warn("Could not read custom card storage.", error);
        }
        const response = stored === null ? await fetch(CUSTOM_CARDS_DATA_URL) : null;
        const saved = stored === null ? (response.ok ? await response.json() : []) : JSON.parse(stored);
        if (!Array.isArray(saved)) return;
        const seen = new Set(state.spells.map(spell => spell.key));
        state.customSpells = saved.filter(spell => {
            if (!isCustomSpell(spell) || seen.has(spell.key)) return false;
            seen.add(spell.key);
            return true;
        });
        state.spells.push(...state.customSpells);
    } catch (error) {
        console.warn("Could not restore custom cards.", error);
    }
}

function setCustomFileStatus(message, error = false) {
    const status = document.querySelector("#custom-file-status");
    status.textContent = message;
    status.style.color = error ? "#9b2828" : "";
}

function importCustomSpells(text) {
    const imported = JSON.parse(text.replace(/^\uFEFF/, ""));
    if (!Array.isArray(imported) || !imported.every(isCustomSpell)) {
        throw new Error("The file must contain an array of valid custom spells.");
    }
    const keys = new Set(imported.map(spell => spell.key));
    if (keys.size !== imported.length) throw new Error("The file contains duplicate spell IDs.");
    const existingKeys = new Set(state.customSpells.map(spell => spell.key));
    const replacements = imported.filter(spell => existingKeys.has(spell.key)).length;
    if (replacements && !window.confirm(`Replace ${replacements} existing custom spell(s) with the versions in this file?`)) return;
    const merged = [...state.customSpells.filter(spell => !keys.has(spell.key)), ...imported];
    if (!storeCustomCards(merged)) throw new Error("Could not save imported spells. Browser storage is unavailable or full.");
    const oldCustomKeys = new Set(state.customSpells.map(spell => spell.key));
    state.spells = [...state.spells.filter(spell => !oldCustomKeys.has(spell.key)), ...merged];
    state.customSpells = merged;
    for (const spell of imported) {
        if (state.selected.has(spell.key)) state.selected.set(spell.key, spell);
    }
    refreshCustomLibrary();
    setCustomFileStatus(`Loaded ${imported.length} custom spell(s).`);
}

async function saveCustomSpellsFile() {
    const json = `${JSON.stringify(state.customSpells, null, 2)}\n`;
    try {
        if ("showSaveFilePicker" in window) {
            if (!customSpellsFileHandle) {
                customSpellsFileHandle = await window.showSaveFilePicker({
                    suggestedName: "custom-spells.json",
                    types: [{ description: "JSON spells", accept: { "application/json": [".json"] } }]
                });
            }
            const writer = await customSpellsFileHandle.createWritable();
            await writer.write(json);
            await writer.close();
        } else {
            const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "custom-spells.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        setCustomFileStatus(`Saved ${state.customSpells.length} custom spell(s) to JSON.`);
    } catch (error) {
        customSpellsFileHandle = null;
        if (error.name !== "AbortError") setCustomFileStatus("Could not save the JSON file. Try again or choose another location.", true);
    }
}

function saveSelection() {
    try {
        localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify([...state.selected.keys()]));
    } catch (error) {
        console.warn("Could not save the spell selection.", error);
    }
}

function restoreSelection() {
    try {
        const keys = JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY) || "[]");
        if (!Array.isArray(keys)) return;
        const spellsByKey = new Map(state.spells.map(spell => [spell.key, spell]));
        for (const key of keys) {
            const spell = spellsByKey.get(key);
            if (spell) state.selected.set(key, spell);
        }
    } catch (error) {
        console.warn("Could not restore the spell selection.", error);
    }
}

function toggleSpell(spell) {
    if (state.selected.has(spell.key)) state.selected.delete(spell.key);
    else state.selected.set(spell.key, spell);
    saveSelection();
    renderSelectedCards();
}

function renderPrintPages() {
    elements.printRoot.replaceChildren();
    const cardsPerPage = cardSizeSettings().cardsPerPage;
    const selected = [...state.selected.values()].flatMap(spell =>
        getSpellCardParts(spell).map(part => ({ spell, part })));
    for (let start = 0; start < selected.length; start += cardsPerPage) {
        const page = document.createElement("section");
        page.className = "print-page";
        page.setAttribute("aria-label", `Print page ${Math.floor(start / cardsPerPage) + 1}`);
        for (const { spell, part } of selected.slice(start, start + cardsPerPage)) page.append(buildCard(spell, part));
        elements.printRoot.append(page);
    }
}

async function loadSpells() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`Data request failed (${response.status}).`);
        const spells = await response.json();
        if (!Array.isArray(spells)) throw new Error("The spell data must be a JSON array.");
        state.spells = spells.filter(spell => spell && spell.key && spell.name && Number.isInteger(spell.level));
        const knownNames = new Set(state.spells.map(spell => spell.name));
        state.spells.push(...TEMPLATE_ONLY_SPELLS.filter(spell => !knownNames.has(spell.name)));
        await restoreCustomCards();
        state.spells.sort((a, b) => a.name.localeCompare(b.name));
        populateFilters();
        restoreSelection();
        const fontStyles = getComputedStyle(document.body);
        const bodyFont = fontStyles.getPropertyValue("--body-font");
        const labelFont = fontStyles.getPropertyValue("--label-font");
        const titleFont = fontStyles.getPropertyValue("--card-title-font");
        await Promise.allSettled([
            ...["400", "700", "italic 400", "italic 700"]
                .map(style => document.fonts.load(`${style} 16px ${bodyFont}`)),
            ...["400", "500"].map(weight => document.fonts.load(`${weight} 16px ${labelFont}`)),
            document.fonts.load(`400 16px ${titleFont}`)
        ]);
        await document.fonts.ready;
        renderSelectedCards();
        customEditor.createButton.disabled = false;
        document.querySelector("#load-custom-json").disabled = false;
        document.querySelector("#save-custom-json").disabled = false;
    } catch (error) {
        elements.list.setAttribute("aria-busy", "false");
        elements.resultCount.textContent = "Spell data unavailable";
        const message = document.createElement("p");
        message.className = "list-message";
        message.textContent = "Could not load the spell list. Open this tool through a local web server so it can read its JSON file.";
        elements.list.replaceChildren(message);
        console.error(error);
    }
}

for (const [name, options] of Object.entries({
    level: Array.from({ length: 10 }, (_, level) => [String(level), levelLabel(level)]),
    school: SPELL_SCHOOLS.map(name => [name, name]),
    casting_time: CASTING_TIMES.map(time => [time, time]),
    attack: [["none", "None"], ["ranged", "Ranged spell attack"], ["melee", "Melee spell attack"],
        ...Object.keys(ABILITY_ABBREVIATIONS).map(ability => [ability, `${titleCase(ability)} save`])],
    damage_type: [["", "None"], ...[...DAMAGE_ICONS].map(type => [type, titleCase(type)])],
    shape_type: [["", "None"], ...[...AREA_ICONS].map(shape => [shape, titleCase(shape)])]
})) {
    for (const [value, label] of options) customEditor.form.elements[name].add(new Option(label, value));
}
customEditor.form.elements.school.value = "Evocation";
customEditor.form.elements.school.querySelector('option[value="Evocation"]').defaultSelected = true;
customEditor.classSearch.addEventListener("focus", () => setClassPickerOpen(true));
customEditor.classSearch.addEventListener("click", () => setClassPickerOpen(true));
customEditor.classSearch.addEventListener("input", () => {
    renderClassPicker();
    setClassPickerOpen(true);
});
customEditor.classSearch.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        setClassPickerOpen(true);
        customEditor.classOptions.querySelector('[role="option"]')?.focus();
    } else if (event.key === "Escape" && !customEditor.classOptions.hidden) {
        event.preventDefault();
        event.stopPropagation();
        setClassPickerOpen(false);
    }
});
customEditor.dialog.addEventListener("focusin", event => {
    if (!event.target.closest(".class-picker")) setClassPickerOpen(false);
});
document.querySelector("#save-custom-json").addEventListener("click", saveCustomSpellsFile);
document.querySelector("#load-custom-json").addEventListener("click", () => document.querySelector("#custom-json-input").click());
document.querySelector("#custom-json-input").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        if (file.size > 5000000) throw new Error("Choose a JSON file smaller than 5 MB.");
        importCustomSpells(await file.text());
    } catch (error) {
        setCustomFileStatus(error instanceof SyntaxError ? "The file is not valid JSON." : error.message, true);
    } finally {
        event.target.value = "";
    }
});
customEditor.createButton.addEventListener("click", () => openCustomEditor());
for (const id of ["close-custom-card", "cancel-custom-card"]) {
    document.querySelector(`#${id}`).addEventListener("click", () => customEditor.dialog.close());
}
customEditor.form.addEventListener("input", updateCustomPreview);
customEditor.form.addEventListener("submit", event => {
    event.preventDefault();
    const spell = readCustomCard();
    if (!customEditor.form.elements.name.value.trim() || !spell.desc) {
        customEditor.error.textContent = "Enter a name and description.";
        customEditor.error.hidden = false;
        return;
    }
    spell.key = customEditor.key || `custom-${crypto.randomUUID()}`;
    const updated = state.customSpells.filter(item => item.key !== spell.key);
    updated.push(spell);
    if (!storeCustomCards(updated)) {
        customEditor.error.textContent = "Could not save the card. Browser storage is unavailable or full.";
        customEditor.error.hidden = false;
        return;
    }
    state.customSpells = updated;
    state.spells = state.spells.filter(item => item.key !== spell.key);
    state.spells.push(spell);
    state.selected.set(spell.key, spell);
    saveSelection();
    refreshCustomLibrary();
    customEditor.dialog.close();
});

for (const filter of [elements.search, elements.level, elements.school, elements.className, elements.source]) {
    filter.addEventListener(filter === elements.search ? "input" : "change", renderSpellList);
}

elements.selectVisible.addEventListener("click", () => {
    for (const spell of state.filtered) state.selected.set(spell.key, spell);
    saveSelection();
    renderSelectedCards();
});

elements.clearSelection.addEventListener("click", () => {
    state.selected.clear();
    saveSelection();
    renderSelectedCards();
});

for (const input of elements.cardSizeInputs) {
    input.addEventListener("change", () => {
        if (!input.checked) return;
        document.body.dataset.cardSize = input.value;
        renderSelectedCards();
    });
}

elements.printButton.addEventListener("click", async () => {
    renderPrintPages();
    await document.fonts.ready;
    await Promise.all([...elements.printRoot.querySelectorAll("img")].map(image => image.decode().catch(() => {})));
    window.print();
});

loadSpells();