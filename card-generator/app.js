const DATA_URL = "./data/spells-2024-srd.json";

const elements = {
    search: document.querySelector("#search-input"),
    level: document.querySelector("#level-filter"),
    school: document.querySelector("#school-filter"),
    className: document.querySelector("#class-filter"),
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
    selected: new Map()
};

function cardSizeSettings() {
    const standard = document.body.dataset.cardSize === "standard";
    return {
        cardsPerPage: standard ? 9 : 16,
        maxTextLength: 700,
        inlineDescriptionLength: 700,
        inlineUpgradeLength: 200,
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
    const duration = rawDuration.charAt(0).toUpperCase() + rawDuration.slice(1);
    if (!spell.concentration) return duration;
    const limit = /^up to\b/i.test(rawDuration) ? rawDuration : `up to ${rawDuration}`;
    return `Concentration, ${limit}`;
}

function populateFilters() {
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
    return matchesSearch && matchesLevel && matchesSchool && matchesClass;
}

function spellDetails(spell) {
    const classes = (spell.classes || []).map(item => item.name).join(", ");
    return `${levelLabel(spell.level)} · ${spell.school?.name || "Unlisted"} · ${classes}`;
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

function getSpellCardParts(spell) {
    const size = cardSizeSettings();
    const description = normalizeDescription(spell.desc || "Description unavailable in this data source.");
    const descriptionParts = splitText(description);
    const parts = descriptionParts.map((text, index) => ({
        description: text,
        continuation: index > 0,
        upgrade: ""
    }));

    if (spell.higher_level) {
        if (parts.length === 1 && parts[0].description.length <= size.inlineDescriptionLength
            && spell.higher_level.length <= size.inlineUpgradeLength) {
            parts[0].upgrade = spell.higher_level;
        } else {
            const label = spell.level === 0 ? "Cantrip Upgrade:" : "Using a Higher-Level Spell Slot:";
            const upgradeParts = splitText(`${label} ${spell.higher_level}`);
            for (const text of upgradeParts) parts.push({ description: text, continuation: true, upgrade: "" });
        }
    }
    return parts;
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
        fragment.append(label);
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
    card.classList.toggle("has-upgrade", Boolean(part.upgrade));
    card.classList.toggle("is-dense", descriptionLength > 200);
    card.classList.toggle("is-very-dense", descriptionLength > 340);

    const setText = (field, value) => {
        card.querySelector(`[data-field="${field}"]`).textContent = value;
    };
    setText("name", part.continuation ? `${spell.name} (CONT.)` : spell.name);
    setText("badge", cantrip ? "C" : String(spell.level));
    setText("badge-prefix", cantrip ? "" : "lvl");
    setText("casting-time", formatCastingTime(spell.casting_time));
    setText("range", spell.range_text || "Special");
    setText("duration", displayDuration(spell));
    renderDescription(card.querySelector('[data-field="description"]'), part.description);
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

function toggleSpell(spell) {
    if (state.selected.has(spell.key)) state.selected.delete(spell.key);
    else state.selected.set(spell.key, spell);
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
        state.spells = spells
            .filter(spell => spell && spell.key && spell.name && Number.isInteger(spell.level))
            .sort((a, b) => a.name.localeCompare(b.name));
        populateFilters();
        renderSpellList();
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

for (const filter of [elements.search, elements.level, elements.school, elements.className]) {
    filter.addEventListener(filter === elements.search ? "input" : "change", renderSpellList);
}

elements.selectVisible.addEventListener("click", () => {
    for (const spell of state.filtered) state.selected.set(spell.key, spell);
    renderSelectedCards();
});

elements.clearSelection.addEventListener("click", () => {
    state.selected.clear();
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
    window.print();
});

loadSpells();