const SPELL_DATA_URLS = ["./data/spells-2024-srd.json", "./data/spells-2024-phb-supplement.json"];
const SELECTION_STORAGE_KEY = "card-generator.selected-spells";
const CUSTOM_CARDS_STORAGE_KEY = "card-generator.custom-cards";
const CUSTOM_CARDS_DATA_URL = "./data/custom-spells.json";
const SPELL_CLASSES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SPELL_SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const CASTING_TIMES = ["Action", "Bonus Action", "Reaction", "1 minute", "10 minutes", "1 hour", "8 hours", "12 hours", "24 hours", "Special"];
const ICON_URL = "./img/icons/";
const DAMAGE_ICONS = new Set([
    "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
    "piercing", "poison", "psychic", "radiant", "slashing", "thunder"
]);
const CONDITION_ICONS = [
    "blinded", "charmed", "deafened", "exhaustion", "frightened", "invisible",
    "paralyzed", "petrified", "poisoned", "prone", "restrained", "unconscious"
];
const AREA_ICONS = new Set(["cone", "cube", "cylinder", "emanation", "sphere", "square", "line"]);
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
    cardSizeInputs: [...document.querySelectorAll('input[name="card-size"]')],
    backInputs: [...document.querySelectorAll('input[name="card-backs"]')],
    backTemplate: document.querySelector("#spell-back-template"),
    printHelp: document.querySelector("#print-help"),
    printError: document.querySelector("#print-error")
};

const state = {
    spells: [],
    filtered: [],
    customSpells: [],
    selected: new Map(),
    activeTab: "spells"
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
    const columns = standard ? 3 : 4;
    const rows = standard ? 3 : 4;
    const mode = document.querySelector('input[name="card-backs"]:checked').value;
    const pairsPerRow = Math.floor(columns / 2);
    return {
        columns,
        rows,
        mode,
        pairsPerRow,
        cardsPerPage: mode === "fold" ? pairsPerRow * rows : columns * rows,
        maxTextLength: 900,
        label: standard ? "Standard" : "Half size",
        dimensions: standard ? "63.5 x 88.9 mm" : "44.5 x 63.5 mm"
    };
}

function spellArea(spell) {
    let type = String(spell.shape_type || "").toLowerCase();
    let size = Number(spell.shape_size);
    const opening = String(spell.desc || "").split(/[.!?](?:\s|$)/)[0];
    // Some SRD entries omit area metadata, notably Emanations and Cylinders.
    const inferred = opening.match(/(\d+)[- ]foot(?:[- ](radius|diameter|wide|high|tall))?[- ]+(emanation|sphere|cube|cylinder|cone|square|line)\b/i);
    if (!type && inferred) {
        type = inferred[3].toLowerCase();
        size = Number(inferred[1]);
    }
    if (!AREA_ICONS.has(type) || !Number.isFinite(size) || !(size > 0)) return null;
    const unit = spell.shape_size_unit || "feet";
    const radius = opening.match(/(\d+)[- ]foot[- ]radius/i);
    const diameter = opening.match(/(\d+)[- ]foot[- ]diameter/i);
    const length = opening.match(/(\d+)[- ]foot[- ]long/i);
    if (["sphere", "cylinder"].includes(type) && radius) size = Number(radius[1]);
    if (["sphere", "cylinder"].includes(type) && diameter) size = Number(diameter[1]) / 2;
    return { type, size, unit, length: type === "line" && length ? Number(length[1]) : null };
}

function areaLabel(area) {
    const unit = area.unit === "feet" ? "ft" : area.unit;
    const size = area.length ? `${area.length} x ${area.size}` : area.size;
    const radius = ["sphere", "emanation", "cylinder"].includes(area.type) ? " radius" : "";
    return `${size} ${unit}${radius} ${titleCase(area.type)}`;
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
    const library = state.spells.filter(card => state.activeTab === "spells"
        ? !isEquipment(card) : card.kind === (state.activeTab === "weapons" ? "weapon" : "item"));
    const previousValues = [elements.level.value, elements.school.value, elements.className.value];
    for (const filter of [elements.level, elements.school, elements.className]) {
        filter.replaceChildren(filter.firstElementChild);
    }
    const levels = [...new Set(library.map(spell => spell.level))].filter(Number.isInteger).sort((a, b) => a - b);
    const schools = [...new Set(library.map(spell => spell.school?.name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const classes = [...new Set(library.flatMap(spell => spell.classes || []).map(item => item.name))]
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
    const category = document.querySelector("#category-filter");
    const previousCategory = category.value;
    category.replaceChildren(new Option("All categories", ""));
    for (const name of [...new Set(library.map(card => card.category).filter(Boolean))].sort()) {
        category.add(new Option(name, name));
    }
    category.value = [...category.options].some(option => option.value === previousCategory) ? previousCategory : "";
}

function matchesFilters(spell) {
    const equipment = isEquipment(spell);
    if (state.activeTab === "spells" ? equipment : spell.kind !== (state.activeTab === "weapons" ? "weapon" : "item")) return false;
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
    if (equipment) {
        const category = document.querySelector("#category-filter").value;
        const rarity = document.querySelector("#rarity-filter").value;
        return matchesSearch && matchesSource && (!category || spell.category === category) && (!rarity || spell.rarity === rarity);
    }
    return matchesSearch && matchesLevel && matchesSchool && matchesClass && matchesSource;
}

function spellDetails(spell) {
    if (isEquipment(spell)) return [spell.category, spell.rarity, spell.attunement ? "Attunement" : "", spell.damage_roll].filter(Boolean).join(" · ");
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
    if (icons.length > 1 && icons.every(icon => CONDITION_ICONS.includes(icon))) {
        const conditions = document.createElement("span");
        conditions.className = "keyword-conditions";
        for (const icon of icons) {
            const condition = document.createElement("span");
            condition.className = "keyword-condition";
            const label = document.createElement("span");
            label.textContent = titleCase(icon);
            condition.append(createKeywordIcon(icon), label);
            conditions.append(condition);
        }
        value.replaceChildren(conditions);
        return;
    }
    const label = document.createElement("span");
    label.className = "keyword-text";
    label.textContent = text || "None";
    value.replaceChildren(...icons.map(createKeywordIcon), label);
}

function formatRangeArea(spell) {
    const range = String(spell.range_text || "Special").replace(/\bfeet\b/gi, "ft").replace(/\bfoot\b/gi, "ft");
    const area = spellArea(spell);
    if (area) {
        return {
            text: range,
            area: {
                size: `${area.length ? `${area.length} x ` : ""}${area.size} ${area.unit === "feet" ? "ft" : area.unit}`,
                icon: area.type,
                label: titleCase(area.type)
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
    const lowerContent = isEquipment(spell) ? null
        : part.upgrade ? upgrade : card.querySelector(spell.material_specified ? ".card-material-note" : ".card-footer");
    const fits = description.scrollHeight <= description.clientHeight
        && (!lowerContent || description.getBoundingClientRect().bottom <= lowerContent.getBoundingClientRect().top)
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
        const compactPart = { ...part, compact: true };
        if (!isEquipment(spell) && part.description.length > 340 && descriptionFits(spell, compactPart)) {
            fittedParts.push(compactPart);
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

    const customProperties = isEquipment(spell) && spell.key.startsWith("custom-") && spell.properties
        ? `\n\n**Properties / charges.** ${spell.properties}` : "";
    const description = normalizeDescription((spell.desc || "Description unavailable in this data source.") + customProperties);
    const parts = [{
        description,
        continuation: false,
        upgrade: ""
    }];

    const fittedParts = fitCardParts(spell, parts);
    if (spell.higher_level) {
        const lastPart = fittedParts[fittedParts.length - 1];
        const upgradedPart = { ...lastPart, upgrade: spell.higher_level };
        if (descriptionFits(spell, upgradedPart)) {
            fittedParts[fittedParts.length - 1] = upgradedPart;
        } else {
            const label = spell.level === 0 ? "Cantrip Upgrade:" : "Using a Higher-Level Spell Slot:";
            const upgradeParts = [{ description: `${label} ${spell.higher_level}`, continuation: true, upgrade: "" }];
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
    const libraryCount = state.spells.filter(card => state.activeTab === "spells" ? !isEquipment(card)
        : card.kind === (state.activeTab === "weapons" ? "weapon" : "item")).length;
    elements.resultCount.textContent = `${state.filtered.length} of ${libraryCount} ${state.activeTab}`;

    if (state.filtered.length === 0) {
        const message = document.createElement("p");
        message.className = "list-message";
        message.textContent = "No cards match these filters.";
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
        const custom = state.customSpells.some(custom => custom.key === spell.key);
        if (custom || isEquipment(spell)) {
            if (custom) details.textContent += " · Custom";
            const row = document.createElement("div");
            row.className = "spell-entry";
            const actions = document.createElement("div");
            actions.className = "custom-card-actions";
            const rowActions = custom ? [
                ["\u270e", "Edit", () => openCustomEditor(spell)],
                ["\u00d7", "Delete", () => deleteCustomCard(spell)]
            ] : [["\u270e", "Customize", () => openEquipmentEditor(spell)]];
            for (const [symbol, action, handler] of rowActions) {
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
    if (isEquipment(spell)) return buildEquipmentCard(spell, part);
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const cantrip = spell.level === 0;
    const descriptionLength = part.description.length;
    card.classList.toggle("is-cantrip", cantrip);
    card.classList.toggle("is-long-title", spell.name.length > 19);
    card.classList.toggle("is-continuation", part.continuation);
    card.classList.toggle("is-custom", spell.key.startsWith("custom-"));
    card.classList.toggle("has-upgrade", Boolean(part.upgrade));
    card.classList.toggle("has-material-note", Boolean(spell.material_specified));
    card.classList.toggle("has-no-lower-content", !part.upgrade && !spell.material_specified);
    card.classList.toggle("is-dense", descriptionLength > 200);
    card.classList.toggle("is-very-dense", descriptionLength > 340);
    card.classList.toggle("is-compact", Boolean(part.compact));

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

function areaGridUnit(area) {
    const circular = ["sphere", "emanation", "cylinder"].includes(area.type);
    const extent = area.length || (circular ? area.size * 2 : area.size);
    return area.unit === "feet" ? 5 * Math.max(1, Math.ceil(extent / 30)) : Math.max(1, Math.ceil(extent / 6));
}

function buildAreaDiagram(area) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 600 540");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", areaLabel(area));
    const add = (tag, attributes, parent = svg) => {
        const node = document.createElementNS(svg.namespaceURI, tag);
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
        parent.append(node);
        return node;
    };
    const defs = add("defs", {});
    const pattern = add("pattern", { id: "area-wave", width: 40, height: 32, patternUnits: "userSpaceOnUse" }, defs);
    add("rect", { width: 40, height: 32, fill: "#3f8aa6" }, pattern);
    add("path", { d: "M-10 8 L10 24 L30 8 L50 24", fill: "none", stroke: "#7fbad2", "stroke-width": 7 }, pattern);
    // A local ID keeps multiple inline diagrams independent on the same sheet.
    const patternId = `area-wave-${crypto.randomUUID()}`;
    pattern.id = patternId;
    const circular = ["sphere", "emanation", "cylinder"].includes(area.type);
    const extent = area.length || (circular ? area.size * 2 : area.size);
    const gridUnit = areaGridUnit(area);
    const grid = 400 / 7;
    const scale = grid / gridUnit;
    const span = extent * scale;
    const radius = span / 2;
    const left = 300 - radius;
    const top = 260 - radius;
    const origin = { x: area.type === "cone" || area.type === "line" ? left : 300, y: 260 };
    const fillId = `area-fill-${crypto.randomUUID()}`;
    const fill = add("pattern", { id: fillId, width: grid, height: grid, x: 300, y: 260, patternUnits: "userSpaceOnUse" }, defs);
    add("rect", { width: grid, height: grid, fill: `url(#${patternId})` }, fill);
    add("path", { d: `M0 ${grid} V0 H${grid}`, fill: "none", stroke: "#d4e4ea", "stroke-width": 3 }, fill);
    const lines = add("g", { stroke: "#b9b7b4", "stroke-width": 2 });
    for (let index = 0; index < 7; index++) {
        const x = 300 + (index - 3) * grid;
        const y = 260 + (index - 3) * grid;
        add("line", { x1: x, y1: 60, x2: x, y2: 460 }, lines);
        add("line", { x1: 100, y1: y, x2: 500, y2: y }, lines);
    }
    const attributes = { fill: `url(#${fillId})`, stroke: "#2b2526", "stroke-width": 5, "stroke-linejoin": "round" };
    if (circular) {
        if (area.type === "cylinder") {
            add("path", { ...attributes, d: `M${left} ${260 - radius / 2} V${260 + radius / 2} A${radius} ${radius / 2} 0 0 0 ${300 + radius} ${260 + radius / 2} V${260 - radius / 2} Z` });
            add("ellipse", { ...attributes, cx: 300, cy: 260 - radius / 2, rx: radius, ry: radius / 2 });
            origin.y = 260 - radius / 2;
        } else add("circle", { ...attributes, cx: 300, cy: 260, r: radius });
    } else if (area.type === "cone") {
        const curve = span / 16;
        add("path", { ...attributes, d: `M${left} 260 L${300 + radius - curve} ${top} Q${300 + radius + curve} 260 ${300 + radius - curve} ${260 + radius} Z` });
    } else if (area.type === "line") {
        const width = area.size * scale;
        add("rect", { ...attributes, x: left, y: 260 - width / 2, width: span, height: width });
    } else {
        add("rect", { ...attributes, x: left, y: top, width: span, height: span });
        if (area.type === "cube") origin.x = left;
    }
    add("circle", { cx: origin.x, cy: origin.y, r: 9, fill: "#fff", stroke: "#0a5c73", "stroke-width": 3 });
    const label = add("text", { x: origin.x + 14, y: origin.y - 16, fill: "#202622", stroke: "#f8f6ee", "stroke-width": 5, "paint-order": "stroke", "font-size": 23, "font-family": "sans-serif" });
    label.textContent = area.type === "emanation" ? "You / Origin" : "Point of Origin";
    const heading = add("text", { x: 300, y: 40, "text-anchor": "middle", fill: "#2b2526", stroke: "#f6f4ee", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round", "font-size": 23, "font-family": "Molengo, 'Trebuchet MS', sans-serif", "font-weight": "bold" });
    heading.textContent = areaLabel(area);
    return svg;
}

function areaImage(area) {
    if (area.unit !== "feet") return null;
    if (area.type === "sphere" && [5, 10].includes(area.size)) return `aoe-sphere-${area.size * 2}.svg`;
    if (area.type === "cube" && [15, 20].includes(area.size)) return `aoe-cube-${area.size}.svg`;
    if (area.type === "cone" && area.size === 15) return "aoe-cone.svg";
    if (area.type === "square" && area.size === 10) return "aoe-square.svg";
    return null;
}

function backTargetCount(spell) {
    if (/^self$/i.test(spell.range_text || "")) return "Self";
    const count = String(spell.desc || "").match(/\bup to (a|one|two|three|four|five|six|seven|eight|nine|ten|\d+) (?:creatures|objects|targets)\b/i);
    const numbers = ["a", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    if (count) {
        const wordIndex = numbers.indexOf(count[1].toLowerCase());
        return String(wordIndex >= 0 ? Math.max(1, wordIndex) : Number(count[1]));
    }
    return String(spell.target_count || 1);
}

function backKeywordText(keyword) {
    let text = keyword.text;
    for (const icon of keyword.icons) {
        const label = titleCase(icon.replaceAll("_", " "));
        text = text.replace(new RegExp(`\\b${label}\\b`, "gi"), "");
    }
    return text.replace(/^[,\s]+|[,\s]+$/g, "")
        .replace(/\s*,\s*(?=,|$)/g, "")
        .trim()
        .replace(/ Save$/, " sv")
        .replace(/^Instantaneous$/i, "Instant")
        .replace(/\bminutes?\b/gi, "min");
}

function buildBack(spell, part) {
    if (isEquipment(spell)) return buildEquipmentBack(spell, part);
    const card = elements.backTemplate.content.firstElementChild.cloneNode(true);
    const name = `${spell.name}${part.continuation ? " (CONT.)" : ""}`;
    card.classList.toggle("is-long-title", name.length > 18);
    const title = card.querySelector('[data-field="name"]');
    title.textContent = name;
    if (name.length > 25) title.style.fontSize = `${Math.max(5, 200 / name.length)}cqw`;
    card.querySelector('[data-field="level"]').textContent = spell.level === 0 ? "Cantrip" : `Level ${spell.level}`;
    const area = spellArea(spell);
    const art = card.querySelector('[data-field="art"]');
    const legend = card.querySelector('[data-field="grid-legend"]');
    legend.hidden = !area;
    if (area) legend.textContent = `Grid: ${areaGridUnit(area)} ${area.unit} / square${area.type === "cylinder" ? " (radius shown above)" : ""}`;
    const existingDiagram = area && areaImage(area);
    if (area && !existingDiagram) {
        art.append(buildAreaDiagram(area));
    } else {
        const image = document.createElement("img");
        const range = spell.range_text || "";
        const emblem = /^self$/i.test(range) ? "self" : /touch/i.test(range) ? "touch" : "ranged";
        image.src = existingDiagram ? `./img/${existingDiagram}?v=html-grid-legend` : `./img/emblem-${emblem}.png`;
        image.alt = area ? areaLabel(area) : `${titleCase(emblem)} spell`;
        art.append(image);
    }
    const rangeBox = card.querySelector('[data-field="range"]');
    const addRange = (label, value) => {
        const item = document.createElement("div");
        const heading = document.createElement("span");
        heading.textContent = label;
        const text = document.createElement("strong");
        text.textContent = value;
        item.append(heading, text);
        rangeBox.append(item);
    };
    const self = /^self$/i.test(spell.range_text || "");
    if (!self || area) addRange("Range", spell.range_text || "Special");
    if (area) rangeBox.classList.add("has-area");
    addRange(area ? "Area" : "Targets", area ? areaLabel(area) : backTargetCount(spell));
    const keywords = spellKeywords(spell);
    const keywordRoot = card.querySelector('[data-field="keywords"]');
    const fields = [
        ["casting-time", "time.png"],
        ...(keywords["attack-save"].text === "None" ? [] : [["attack-save", "heart.png"]]),
        ["effect", "effect.png"],
        ["duration", "duration.png"]
    ];
    for (const [field, icon] of fields) {
        const item = document.createElement("div");
        const image = document.createElement("img");
        image.src = `${ICON_URL}${icon}`;
        image.alt = { "casting-time": "Casting time", "attack-save": "Attack/Save", effect: "Effect", duration: "Duration" }[field];
        const text = document.createElement("span");
        text.textContent = backKeywordText(keywords[field]);
        const value = document.createElement("span");
        value.className = "back-keyword-value";
        value.setAttribute("aria-label", keywords[field].text);
        value.classList.toggle("has-many-icons", keywords[field].icons.length > 2);
        if (keywords[field].icons.length) {
            const icons = document.createElement("span");
            icons.className = "back-keyword-icons";
            icons.style.setProperty("--keyword-icon-count", keywords[field].icons.length);
            icons.append(...keywords[field].icons.map(createKeywordIcon));
            value.append(icons);
        }
        if (text.textContent) value.append(text);
        item.append(image, value);
        keywordRoot.append(item);
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
    const spellLabel = spellCount === 1 ? "entry" : "entries";
    const cardLabel = cardCount === 1 ? "card" : "cards";
    elements.selectionSummary.textContent = `${spellCount} ${spellLabel} selected · ${cardCount} ${cardLabel}`;
    elements.selectionNote.textContent = `${size.label} · ${size.dimensions} · up to ${size.cardsPerPage} ${size.mode === "fold" ? "card pairs" : "cards"} per A4 ${size.mode === "duplex" ? "sheet (2 pages)" : "page"}`;
    const instructions = {
        none: "",
        fold: " Cut around each front/back pair, fold along the shared edge, then glue. Print single-sided.",
        duplex: " Print double-sided, flipping on the long edge. Each front page is followed by its mirrored back page. Test one sheet first."
    };
    elements.printHelp.textContent = `Print A4 at 100% / actual size with backgrounds enabled and headers/footers off.${instructions[size.mode]}`;
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
        message.textContent = "Your selected cards will appear here. You can mix spells, weapons, and items.";
        empty.append(mark, message);
        elements.selectedCards.append(empty);
    } else {
        const fragment = document.createDocumentFragment();
        for (const spell of selected) {
            for (const part of getSpellCardParts(spell)) {
                fragment.append(buildCard(spell, part));
                if (cardSizeSettings().mode !== "none") fragment.append(buildBack(spell, part));
            }
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
    if (isEquipment(spell) || (!spell && state.activeTab !== "spells")) {
        openEquipmentEditor(spell);
        return;
    }
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
            if (!(isCustomSpell(spell) || isCustomEquipment(spell)) || seen.has(spell.key)) return false;
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
    if (!Array.isArray(imported) || !imported.every(card => isCustomSpell(card) || isCustomEquipment(card))) {
        throw new Error("The file must contain an array of valid custom spell, weapon, or item cards.");
    }
    const keys = new Set(imported.map(spell => spell.key));
    if (keys.size !== imported.length) throw new Error("The file contains duplicate card IDs.");
    const existingKeys = new Set(state.customSpells.map(spell => spell.key));
    const replacements = imported.filter(spell => existingKeys.has(spell.key)).length;
    if (replacements && !window.confirm(`Replace ${replacements} existing custom card(s) with the versions in this file?`)) return;
    const merged = [...state.customSpells.filter(spell => !keys.has(spell.key)), ...imported];
    if (!storeCustomCards(merged)) throw new Error("Could not save imported cards. Browser storage is unavailable or full.");
    const oldCustomKeys = new Set(state.customSpells.map(spell => spell.key));
    state.spells = [...state.spells.filter(spell => !oldCustomKeys.has(spell.key)), ...merged];
    state.customSpells = merged;
    for (const spell of imported) {
        if (state.selected.has(spell.key)) state.selected.set(spell.key, spell);
    }
    refreshCustomLibrary();
    setCustomFileStatus(`Loaded ${imported.length} custom card(s).`);
}

async function saveCustomSpellsFile() {
    const json = `${JSON.stringify(state.customSpells, null, 2)}\n`;
    try {
        if ("showSaveFilePicker" in window) {
            if (!customSpellsFileHandle) {
                customSpellsFileHandle = await window.showSaveFilePicker({
                    suggestedName: "custom-cards.json",
                    types: [{ description: "JSON cards", accept: { "application/json": [".json"] } }]
                });
            }
            const writer = await customSpellsFileHandle.createWritable();
            await writer.write(json);
            await writer.close();
        } else {
            const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "custom-cards.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        setCustomFileStatus(`Saved ${state.customSpells.length} custom card(s) to JSON.`);
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
    const { cardsPerPage, columns, mode, pairsPerRow } = cardSizeSettings();
    const selected = [...state.selected.values()].flatMap(spell =>
        getSpellCardParts(spell).map(part => ({ spell, part })));
    for (let start = 0; start < selected.length; start += cardsPerPage) {
        const page = document.createElement("section");
        page.className = "print-page";
        page.setAttribute("aria-label", `Print page ${Math.floor(start / cardsPerPage) + 1}`);
        page.classList.toggle("print-page-fold", mode === "fold");
        const batch = selected.slice(start, start + cardsPerPage);
        batch.forEach(({ spell, part }, index) => {
            if (mode === "fold") {
                const pair = document.createElement("div");
                pair.className = "print-card-pair";
                pair.style.gridColumn = String(index % pairsPerRow + 1);
                pair.style.gridRow = String(Math.floor(index / pairsPerRow) + 1);
                pair.append(buildCard(spell, part), buildBack(spell, part));
                page.append(pair);
            } else {
                page.append(buildCard(spell, part));
            }
        });
        elements.printRoot.append(page);
        if (mode === "duplex") {
            const backPage = document.createElement("section");
            backPage.className = "print-page print-page-backs";
            backPage.setAttribute("aria-label", `Backs for ${page.getAttribute("aria-label")}`);
            batch.forEach(({ spell, part }, index) => {
                const back = buildBack(spell, part);
                back.style.gridColumn = String(columns - index % columns);
                back.style.gridRow = String(Math.floor(index / columns) + 1);
                backPage.append(back);
            });
            elements.printRoot.append(backPage);
        }
    }
}

async function loadSpellLibrary() {
    const libraries = await Promise.all(SPELL_DATA_URLS.map(async url => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Data request failed (${response.status}): ${url}`);
        const spells = await response.json();
        if (!Array.isArray(spells)) throw new Error(`The spell data must be a JSON array: ${url}`);
        return spells.filter(spell => spell && spell.key && spell.name && Number.isInteger(spell.level));
    }));
    return libraries.flat();
}

async function loadSpells() {
    try {
        state.spells = await loadSpellLibrary();
        state.spells.push(...await loadEquipment());
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
        elements.resultCount.textContent = "Card data unavailable";
        const message = document.createElement("p");
        message.className = "list-message";
        message.textContent = `Could not load the card library: ${error.message} Open this tool through a local web server and reload.`;
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

for (const filter of [elements.search, elements.level, elements.school, elements.className, elements.source,
    document.querySelector("#category-filter"), document.querySelector("#rarity-filter")]) {
    filter.addEventListener(filter === elements.search ? "input" : "change", renderSpellList);
}

for (const tab of document.querySelectorAll('[role="tab"]')) {
    tab.addEventListener("click", () => {
        state.activeTab = tab.dataset.library;
        for (const other of document.querySelectorAll('[role="tab"]')) {
            other.setAttribute("aria-selected", String(other === tab));
            other.tabIndex = other === tab ? 0 : -1;
        }
        const equipment = state.activeTab !== "spells";
        document.querySelectorAll("[data-spell-filter]").forEach(label => { label.hidden = equipment; });
        document.querySelectorAll("[data-equipment-filter]").forEach(label => { label.hidden = !equipment; });
        document.querySelector("#library-eyebrow").textContent = `${state.activeTab.toUpperCase()} LIBRARY`;
        document.querySelector("#library-panel").setAttribute("aria-labelledby", tab.id);
        elements.search.placeholder = equipment ? "Equipment name or description" : "Spell name or description";
        elements.search.value = "";
        for (const filter of [elements.level, elements.school, elements.className, elements.source,
            document.querySelector("#category-filter"), document.querySelector("#rarity-filter")]) filter.value = "";
        populateFilters();
        renderSpellList();
    });
    tab.addEventListener("keydown", event => {
        const tabs = [...document.querySelectorAll('[role="tab"]')];
        const index = tabs.indexOf(tab);
        const next = event.key === "ArrowRight" ? tabs[(index + 1) % tabs.length]
            : event.key === "ArrowLeft" ? tabs[(index + tabs.length - 1) % tabs.length]
            : event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1] : null;
        if (next) { event.preventDefault(); next.focus(); next.click(); }
    });
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

for (const input of elements.backInputs) {
    input.addEventListener("change", renderSelectedCards);
}

window.addEventListener("beforeprint", renderPrintPages);

elements.printButton.addEventListener("click", async () => {
    elements.printError.hidden = true;
    try {
        renderPrintPages();
        await document.fonts.ready;
        await Promise.all([...elements.printRoot.querySelectorAll("img")].map(async image => {
            try {
                await image.decode();
            } catch (error) {
                throw new Error(`Could not load the print image: ${image.getAttribute("src")}`, { cause: error });
            }
        }));
        window.print();
    } catch (error) {
        console.error("Could not prepare the print sheet.", error);
        elements.printError.textContent = `${error.message}. Please reload and try again.`;
        elements.printError.hidden = false;
    }
});

initializeEquipmentEditor();
loadSpells();