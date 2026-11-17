const EQUIPMENT_DATA_URL = "./data/equipment-2024-srd.json";
const EQUIPMENT_IMAGES = [
    "sword", "dagger", "axe", "hammer", "spear", "bow", "crossbow", "arrows",
    "armor", "shield", "potion", "ring", "book", "staff", "rope", "torch",
    "pack", "gem", "boots", "cloak", "tools", "weapon", "item"
];
const PAINTED_EQUIPMENT = new Set([
    "sword", "dagger", "axe", "hammer", "spear", "bow", "armor", "shield",
    "potion", "book", "staff", "pack", "gem", "tools"
]);
const EQUIPMENT_RARITIES = ["Mundane", "Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact", "Varies"];
const EQUIPMENT_ARTWORK = {
    "dagger": "weapons/dagger", "club": "weapons/club", "greataxe": "weapons/greataxe",
    "greatclub": "weapons/greatclub", "handaxe": "weapons/hand-axe", "javelin": "weapons/javelin",
    "light hammer": "weapons/light-hammer", "longbow": "weapons/longbow", "mace": "weapons/mace",
    "quarterstaff": "weapons/quarterstaff", "scimitar": "weapons/scimitar", "sickle": "weapons/sickle",
    "spear": "weapons/spear",
    "longsword": "weapons/longsword", "sword of xenu's glory": "weapons/longsword-relic",
    "chain mail": "armor/chain-mail", "chain shirt": "armor/chain-shirt",
    "leather armor": "armor/leather-armor", "shield": "armor/shield",
    "healer's kit": "adventuring-gear/healers-kit", "thieves' tools": "adventuring-gear/thieves-tools",
    "potion of healing": "adventuring-gear/potion-of-healing",
    "flute": "musical-instruments/flute"
};
let equipmentEditorKey = null;
let equipmentImageData = "";
let equipmentImagePending = false;
let equipmentImageRequest = 0;

function isEquipment(card) {
    return card?.kind === "weapon" || card?.kind === "item";
}

function equipmentImage(card) {
    if (card.image_data) return card.image_data;
    const name = card.name.toLowerCase().replaceAll("\u2019", "'");
    const artwork = Object.keys(EQUIPMENT_ARTWORK).find(key => name === key
        || name.startsWith(`${key},`) || name.startsWith(`${key} (+`) || name.endsWith(`(${key})`));
    if (artwork) return `./img/equipment/${EQUIPMENT_ARTWORK[artwork]}.png`;
    const key = EQUIPMENT_IMAGES.includes(card.image) ? card.image : "item";
    const fallback = { sword: "longsword", dagger: "dagger", axe: "handaxe", hammer: "light hammer", spear: "spear", bow: "longbow", staff: "quarterstaff" }[key];
    if (fallback) return `./img/equipment/${EQUIPMENT_ARTWORK[fallback]}.png`;
    if (/scroll/i.test(card.name) && key === "book") return "./img/equipment/art-scroll.png";
    return `./img/equipment/${PAINTED_EQUIPMENT.has(key) ? `art-${key}.png` : `${key}.svg`}`;
}

function equipmentCoin(cost) {
    const match = /^(\d[\d,]*(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)$/i.exec((cost || "").trim());
    if (!match) return { amount: "?", currency: "unknown", label: cost || "Not listed" };
    const unit = match[2].toLowerCase();
    const gold = Number(match[1].replaceAll(",", "")) * ({ cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 })[unit];
    const currency = ["cp", "sp"].includes(unit) || (gold > 0 && gold < 1) ? "sp" : "gp";
    const value = currency === "sp" ? gold * 10 : gold;
    const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
    return { amount, currency, label: `${amount} ${currency.toUpperCase()}` };
}

function equipmentRarity(card) {
    return EQUIPMENT_RARITIES.includes(card.rarity) ? card.rarity.toLowerCase().replaceAll(" ", "-") : "mundane";
}

function equipmentAbility(card) {
    if (/finesse/i.test(card.properties)) return "STR/DEX";
    return /ranged/i.test(card.weapon_type) || /\bammunition\b/i.test(card.properties) ? "DEX" : "STR";
}

function equipmentCategory(card) {
    if (card.kind === "weapon" && /^(simple|martial)$/i.test(card.weapon_type)) {
        return `${card.weapon_type} ${/\bammunition\b/i.test(card.properties) ? "Ranged" : "Melee"}`;
    }
    return card.weapon_type || card.category;
}

function equipmentStats(card) {
    return card.kind === "weapon"
        ? [
            ["DMG Type", card.damage_types.map(titleCase).join(", ") || "See text"],
            ["Ability", card.damage_roll ? equipmentAbility(card) : "See text"],
            ["DMG", card.damage_roll || "See text"],
            ["Properties", card.properties || "None"],
            ["Weight", card.weight || "Not listed"],
            ["Cost", card.cost || "Not listed"]
        ]
        : [
            ["Rarity", card.rarity],
            ["Attunement", card.attunement ? "Required" : "No"],
            ["Armor Class", card.armor_class || "N/A"],
            ["Properties", card.properties || card.category],
            ["Weight", card.weight || "Not listed"],
            ["Cost", card.cost || "Not listed"]
        ];
}

function equipmentTitle(card, part, title) {
    const name = `${card.name}${part.continuation ? " (CONT.)" : ""}`;
    title.textContent = name;
    title.style.fontSize = "";
}

function equipmentProperties(card, front = false) {
    const properties = card.properties.trim();
    if (/^(?:none|n\/a|-)?$/i.test(properties)) return "";
    const values = properties.split(/,\s*(?![^()]*\))/);
    if (front) return values.filter(value => !/^(?:Thrown|Ammunition)\b/i.test(value)).join("\n");
    return values.map(value => value.replace(/\b(Thrown|Ammunition)\s*\((?:\s*Range\s+)?([^)]*)\)/gi, (_, property, range) => {
        const details = range.trim().replace(/^(\d+(?:\/\d+)?)(?:\s*(?:ft\.?|feet))?/i, "$1 ft");
        return `${property} (${details})`;
    }))
        .join(", ").replace(/, (?=(?:Thrown|Ammunition)\b)/gi, ",\n");
}

function appendEquipmentStats(root, card) {
    for (const [label, text] of equipmentStats(card)) {
        const item = document.createElement("div");
        item.className = "keyword-item";
        const heading = document.createElement("strong");
        heading.textContent = label;
        const value = document.createElement("span");
        value.dataset.field = label.toLowerCase().replaceAll(" ", "-");
        value.textContent = label === "Properties"
            ? text.length > 110 ? "See description" : equipmentProperties(card) || "None"
            : text;
        if (label === "Properties") item.className += " equipment-properties-stat";
        item.append(heading, value);
        root.append(item);
    }
}

function equipmentDescription(card, part) {
    if (!card.mastery || part.continuation || part.description.toLowerCase().includes(`mastery`)) return part.description;
    return `**Mastery: ${card.mastery}.**\n\n${part.description}`;
}

function buildEquipmentCard(card, part) {
    const element = document.querySelector("#equipment-card-template").content.firstElementChild.cloneNode(true);
    element.dataset.cardKind = card.kind;
    element.dataset.rarity = equipmentRarity(card);
    equipmentTitle(card, part, element.querySelector(".card-title"));
    element.classList.toggle("is-long-title", card.name.length > 19);
    element.classList.toggle("is-equipment-continuation", part.continuation);
    const image = element.querySelector(".equipment-illustration");
    image.src = equipmentImage(card);
    image.alt = `${card.name} (representative artwork)`;
    const weight = element.querySelector(".equipment-weight");
    weight.querySelector("span").textContent = (card.weight || "?").replace(/\s+/g, "");
    weight.setAttribute("aria-label", `Weight: ${card.weight || "Not listed"}`);
    const coin = equipmentCoin(card.cost);
    const price = element.querySelector(".equipment-coin");
    price.dataset.currency = coin.currency;
    price.dataset.digits = String(coin.amount.length);
    price.setAttribute("aria-label", `Cost: ${coin.label}`);
    price.title = coin.label;
    element.querySelector(".equipment-coin-amount").textContent = coin.amount;
    element.querySelector(".equipment-coin-unit").textContent = coin.currency === "unknown" ? "" : coin.currency[0].toUpperCase();
    const damage = element.querySelector(".equipment-damage");
    damage.querySelector("span").textContent = card.kind === "weapon" ? card.damage_types.map(titleCase).join(" / ") || "Damage" : card.armor_class ? "Armor Class" : card.rarity;
    damage.querySelector("strong").textContent = card.kind === "weapon"
        ? card.damage_roll ? `${card.damage_roll} +${equipmentAbility(card)}` : "See text"
        : card.armor_class || (card.attunement ? "Attunement" : card.category);
    if (card.kind !== "weapon" && card.armor_class) {
        damage.classList.add("equipment-armor-class");
        damage.setAttribute("aria-label", `Armor Class: ${card.armor_class}`);
        const dexterity = /^(\d+)\s*\+\s*Dex modifier(?:\s*\(max\s+(\d+)\))?$/i.exec(card.armor_class);
        if (dexterity) {
            damage.querySelector("strong").textContent = `${dexterity[1]}+DEX`;
            if (dexterity[2]) {
                const limit = document.createElement("small");
                limit.textContent = `(MAX ${dexterity[2]})`;
                damage.append(limit);
            }
        }
    }
    const feature = element.querySelector(".equipment-feature");
    feature.querySelector("span").textContent = equipmentProperties(card, true);
    feature.hidden = !feature.querySelector("span").textContent;
    const range = element.querySelector(".equipment-range");
    range.querySelector("span").textContent = card.range_text
        || /\bThrown\s*\((?:Range\s+)?([^)]*)\)/i.exec(card.properties)?.[1] || "See text";
    range.hidden = !/\bThrown\b/i.test(card.properties);
    renderDescription(element.querySelector(".card-description"), part.description);
    element.querySelector(".equipment-footer strong").textContent = card.kind === "weapon" ? "WEAPON" : "ITEM";
    element.querySelector(".equipment-category").textContent = equipmentCategory(card);
    return element;
}

function buildEquipmentBack(card, part) {
    const element = document.querySelector("#equipment-back-template").content.firstElementChild.cloneNode(true);
    element.dataset.cardKind = card.kind;
    element.dataset.rarity = equipmentRarity(card);
    equipmentTitle(card, part, element.querySelector(".equipment-back-title"));
    element.classList.toggle("is-long-title", card.name.length > 19);
    element.classList.toggle("is-equipment-continuation", part.continuation);
    element.classList.toggle("is-continuation", part.continuation);
    element.classList.toggle("is-dense", part.description.length > 200);
    element.classList.toggle("is-very-dense", part.description.length > 340);
    appendEquipmentStats(element.querySelector(".equipment-back-stats"), card);
    renderDescription(element.querySelector(".card-description"), equipmentDescription(card, part));
    element.querySelector(".equipment-back-footer strong").textContent = card.kind === "weapon" ? "Weapon" : "Item";
    element.querySelector(".equipment-back-footer span").textContent = equipmentCategory(card);
    return element;
}

function isCustomEquipment(card) {
    return isEquipment(card) && typeof card.key === "string" && card.key.startsWith("custom-")
        && ["name", "desc", "category", "rarity", "cost", "weight", "damage_roll", "range_text",
            "properties", "mastery", "armor_class", "weapon_type", "image"].every(field => typeof card[field] === "string")
        && card.name.trim().length > 0 && card.name.length <= 80
        && card.desc.trim().length > 0 && card.desc.length <= 20000
        && ["category", "cost", "weight", "damage_roll", "range_text", "properties", "mastery", "armor_class", "weapon_type"]
            .every(field => card[field].length <= 300)
        && EQUIPMENT_RARITIES.includes(card.rarity)
        && typeof card.magic === "boolean" && typeof card.attunement === "boolean"
        && Array.isArray(card.damage_types) && card.damage_types.every(type => DAMAGE_ICONS.has(type))
        && EQUIPMENT_IMAGES.includes(card.image)
        && (!card.image_data || (typeof card.image_data === "string" && card.image_data.length <= 2800000
            && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(card.image_data)));
}

async function loadEquipment() {
    const response = await fetch(EQUIPMENT_DATA_URL);
    if (!response.ok) throw new Error(`Equipment data request failed (${response.status}).`);
    const cards = await response.json();
    if (!Array.isArray(cards) || !cards.length || !cards.every(card =>
        isCustomEquipment({ ...card, key: `custom-${card.key}` }) && card.source?.license === "CC BY 4.0")) {
        throw new Error("The built-in equipment data is invalid.");
    }
    const longsword = cards.find(card => card.key === "equipment-srd-2024_longsword");
    if (!longsword) throw new Error("The base longsword for Sword of Xenu's glory is missing.");
    return [...cards, {
        ...longsword,
        key: "equipment-homebrew_sword-of-xenus-glory",
        name: "Sword of Xenu's glory",
        rarity: "Artifact",
        magic: true,
        desc: `${longsword.desc}\n\n**Xenu's Glory.** This relic constantly emits bright light in a 10-foot radius and dim light for an additional 10 feet.`,
        source: { ...longsword.source, name: "Homebrew (SRD 5.2 base)" }
    }];
}

function openEquipmentEditor(card = null) {
    const dialog = document.querySelector("#equipment-dialog");
    const form = document.querySelector("#equipment-form");
    form.reset();
    equipmentImageRequest++;
    equipmentImagePending = false;
    equipmentEditorKey = card?.key.startsWith("custom-") ? card.key : null;
    equipmentImageData = card?.image_data || "";
    document.querySelector("#equipment-image-status").textContent = equipmentImageData ? "Saved custom illustration" : "";
    document.querySelector("#equipment-error").hidden = true;
    document.querySelector("#equipment-dialog-title").textContent = card
        ? `${equipmentEditorKey ? "Edit" : "Customize"} ${card.name}` : "New custom equipment";
    if (card) {
        for (const name of ["name", "kind", "category", "rarity", "cost", "weight", "damage_roll",
            "range_text", "properties", "mastery", "armor_class", "weapon_type", "desc", "image"]) {
            form.elements[name].value = card[name];
        }
        form.elements.damage_type.value = card.damage_types[0] || "";
        form.elements.attunement.checked = card.attunement;
    } else {
        form.elements.kind.value = state.activeTab === "weapons" ? "weapon" : "item";
        form.elements.category.value = state.activeTab === "weapons" ? "Weapon" : "Adventuring Gear";
        form.elements.image.value = state.activeTab === "weapons" ? "sword" : "item";
    }
    dialog.showModal();
    updateEquipmentPreview();
    form.elements.name.focus();
}

function readEquipmentForm() {
    const form = document.querySelector("#equipment-form");
    const fields = form.elements;
    const card = { key: equipmentEditorKey || "custom-preview", image_data: equipmentImageData };
    for (const name of ["name", "kind", "category", "rarity", "cost", "weight", "damage_roll",
        "range_text", "properties", "mastery", "armor_class", "weapon_type", "desc", "image"]) {
        card[name] = fields[name].value.trim();
    }
    card.magic = card.rarity !== "Mundane";
    card.attunement = fields.attunement.checked;
    card.damage_types = fields.damage_type.value ? [fields.damage_type.value] : [];
    return card;
}

function updateEquipmentPreview() {
    const card = readEquipmentForm();
    if (!card.name) card.name = "Custom equipment";
    if (!card.desc) card.desc = "Your item description.";
    const root = document.querySelector("#equipment-preview");
    root.replaceChildren(buildEquipmentCard(card, { description: card.desc, continuation: false }));
    document.querySelector("#equipment-form").querySelectorAll("[data-weapon-field]").forEach(label => {
        label.hidden = card.kind !== "weapon";
    });
}

function initializeEquipmentEditor() {
    const form = document.querySelector("#equipment-form");
    for (const rarity of EQUIPMENT_RARITIES) form.elements.rarity.add(new Option(rarity, rarity));
    for (const image of EQUIPMENT_IMAGES) form.elements.image.add(new Option(titleCase(image), image));
    for (const type of DAMAGE_ICONS) form.elements.damage_type.add(new Option(titleCase(type), type));
    form.addEventListener("input", updateEquipmentPreview);
    for (const id of ["equipment-close", "equipment-cancel"]) {
        document.querySelector(`#${id}`).addEventListener("click", () => document.querySelector("#equipment-dialog").close());
    }
    document.querySelector("#equipment-remove-image").addEventListener("click", () => {
        equipmentImageRequest++;
        equipmentImagePending = false;
        equipmentImageData = "";
        form.elements.illustration.value = "";
        document.querySelector("#equipment-image-status").textContent = "Using library artwork";
        updateEquipmentPreview();
    });
    form.elements.illustration.addEventListener("change", async event => {
        const file = event.target.files[0];
        if (!file) return;
        const request = ++equipmentImageRequest;
        const errorRoot = document.querySelector("#equipment-error");
        errorRoot.hidden = true;
        equipmentImagePending = true;
        try {
            if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2000000) {
                throw new Error("Choose a PNG, JPEG, or WebP image smaller than 2 MB.");
            }
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Could not read the illustration."));
                reader.readAsDataURL(file);
            });
            const bitmap = await createImageBitmap(file);
            bitmap.close();
            if (request !== equipmentImageRequest) return;
            equipmentImageData = data;
            document.querySelector("#equipment-image-status").textContent = file.name;
            updateEquipmentPreview();
        } catch (error) {
            if (request !== equipmentImageRequest) return;
            console.error("Could not load the equipment illustration.", error);
            errorRoot.textContent = error.message;
            errorRoot.hidden = false;
            event.target.value = "";
        } finally {
            if (request === equipmentImageRequest) equipmentImagePending = false;
        }
    });
    form.addEventListener("submit", event => {
        event.preventDefault();
        const card = readEquipmentForm();
        card.key = equipmentEditorKey || `custom-${crypto.randomUUID()}`;
        const errorRoot = document.querySelector("#equipment-error");
        if (equipmentImagePending || !isCustomEquipment(card)) {
            errorRoot.textContent = equipmentImagePending ? "Please wait for the image to finish loading." : "Enter a valid name, description, and equipment details.";
            errorRoot.hidden = false;
            return;
        }
        const updated = [...state.customSpells.filter(item => item.key !== card.key), card];
        if (!storeCustomCards(updated)) {
            errorRoot.textContent = "Could not save the card. Browser storage is unavailable or full. Try a smaller image.";
            errorRoot.hidden = false;
            return;
        }
        state.customSpells = updated;
        state.spells = [...state.spells.filter(item => item.key !== card.key), card];
        state.selected.set(card.key, card);
        saveSelection();
        refreshCustomLibrary();
        document.querySelector("#equipment-dialog").close();
    });
}
