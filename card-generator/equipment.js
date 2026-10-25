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
let equipmentEditorKey = null;
let equipmentImageData = "";
let equipmentImagePending = false;
let equipmentImageRequest = 0;

function isEquipment(card) {
    return card?.kind === "weapon" || card?.kind === "item";
}

function equipmentImage(card) {
    if (card.image_data) return card.image_data;
    const key = EQUIPMENT_IMAGES.includes(card.image) ? card.image : "item";
    if (/scroll/i.test(card.name) && key === "book") return "./img/equipment/art-scroll.png";
    return `./img/equipment/${PAINTED_EQUIPMENT.has(key) ? `art-${key}.png` : `${key}.svg`}`;
}

function equipmentStats(card) {
    return card.kind === "weapon"
        ? [
            ["Damage", [card.damage_roll, ...card.damage_types.map(titleCase)].filter(Boolean).join(" ") || "See text"],
            ["Range", card.range_text || "See text"],
            ["Mastery", card.mastery || "None"],
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
    title.style.fontSize = `${Math.max(4, Math.min(name.length > 18 ? 7 : 9, 190 / name.length))}cqw`;
}

function appendEquipmentStats(root, card, back = false) {
    for (const [label, text] of equipmentStats(card)) {
        const item = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = label;
        const value = document.createElement("span");
        if (label === "Damage" && card.damage_types.length) {
            value.setAttribute("aria-label", text);
            value.append(...card.damage_types.filter(type => DAMAGE_ICONS.has(type)).map(createKeywordIcon));
            value.append(document.createTextNode(card.damage_roll || "See text"));
        } else {
            value.textContent = text;
        }
        if (back && label === "Properties" && text.length > 70) value.textContent = "See front";
        item.append(heading, value);
        root.append(item);
    }
}

function buildEquipmentCard(card, part) {
    const element = document.querySelector("#equipment-card-template").content.firstElementChild.cloneNode(true);
    element.dataset.cardKind = card.kind;
    equipmentTitle(card, part, element.querySelector(".card-title"));
    element.classList.toggle("is-equipment-continuation", part.continuation);
    const image = element.querySelector(".equipment-illustration");
    image.src = equipmentImage(card);
    image.alt = `${card.name} (representative artwork)`;
    appendEquipmentStats(element.querySelector(".equipment-stats"), card);
    renderDescription(element.querySelector(".card-description"), part.description);
    element.querySelector(".equipment-category").textContent = [card.category, card.weapon_type, card.magic ? card.rarity : ""].filter(Boolean).join(" / ");
    element.querySelector(".equipment-source").textContent = card.key.startsWith("custom-") ? "Custom" : "SRD 5.2";
    return element;
}

function buildEquipmentBack(card, part) {
    const element = elements.backTemplate.content.firstElementChild.cloneNode(true);
    element.dataset.cardKind = card.kind;
    element.classList.add("equipment-back");
    equipmentTitle(card, part, element.querySelector(".back-title"));
    const image = document.createElement("img");
    image.src = equipmentImage(card);
    image.alt = `${card.name} (representative artwork)`;
    element.querySelector(".back-art").append(image);
    const summary = element.querySelector(".back-summary");
    summary.className = "equipment-back-stats";
    summary.replaceChildren();
    appendEquipmentStats(summary, card, true);
    element.querySelector(".back-footer strong").textContent = card.kind === "weapon" ? "WEAPON" : "ITEM";
    element.querySelector('[data-field="level"]').textContent = [card.rarity, card.attunement ? "Attunement" : ""].filter(Boolean).join(" / ");
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
    return cards;
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
