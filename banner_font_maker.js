import { download_file } from "./common.js";
import {get_lines, get_line_lengths, set_lines} from "./sign_editor.js";

const navSignEditor = document.querySelector("#nav-mse");
const navBannerFontMaker = document.querySelector("#nav-mse-bfm");
const toolContainer = document.querySelector("#tool-bfm");

window.addEventListener("hashchange", check_tool_active);
// window.addEventListener("beforeunload", (e) => {
//     e.preventDefault();
//     return "";
// });

function check_tool_active() {
    const bfm = location.hash === "#banner-font-maker";

    navBannerFontMaker.classList.toggle("active", bfm);
    navSignEditor.classList.toggle("active", !bfm);
    toolContainer.classList.toggle("hidden", !bfm);
}
check_tool_active();


const form = document.querySelector("#tool-bfm form");
const fontName = document.querySelector("input#bfm-font-name");
const fontAuthor = document.querySelector("input#bfm-font-author");
const btnLoad = document.querySelector("#bfm-btn-load");
const btnSave = document.querySelector("#bfm-btn-save");

const metricsContainer = document.querySelector("#bfm-out-metrics");

const btnLeft = document.querySelector("#bfm-btn-left");
const btnRight = document.querySelector("#bfm-btn-right");
const btnRemove = document.querySelector("#bfm-btn-remove");
const selCharacter = document.querySelector("select#bfm-sel-char");

/**
 * @type {Map<string, number>}
 */
let fontmetrics = new Map();
/**
 * @type {Map<string, {lines: string[], width: number, unbal: boolean}}
 */
let fontmap = new Map();

form.onsubmit = (e) => e.preventDefault();

selCharacter.addEventListener("input", run_tool);
btnLeft.addEventListener("click", font_to_editor);
btnRight.addEventListener("click", editor_to_font);
btnRemove.addEventListener("click", remove_character);

btnSave.addEventListener("click", export_font);


function run_tool() {
    update_select_options();
    update_metrics();
    update_disabled_buttons();
}
run_tool();

function export_font() {
    run_tool();
    if (fontmap.size < 1) {
        alert("There are no characters to export!");
        return;
    }

    let content = "MAST1\n";
    content += fontName.value + "\n";
    content += fontAuthor.value + "\n";
    // tags
    if (fontmetrics.get("Balanced") !== 1) content += "UNBAL ";
    if (fontmetrics.get("Monospace") === 1) content += "MONO ";
    if (fontmetrics.get("ASCII") === 1) content += "ASCII ";
    content += "\n";

    const fontMaxLines = Math.max(...Array.from(fontmap.values()).map(fontData => fontData.lines.length));
    content += fontMaxLines + " " + fontmap.size + "\n";

    for (const [char, data] of fontmap.entries()) {
        content += char + " " + data.width;
        if (data.lines.length < fontMaxLines) {
            content += " l" + data.lines.length;
            console.log(data.lines.length, fontMaxLines);
        }
        if (data.unbal) content += " ub";
        content += "\n";

        for (let l = 0; l < fontMaxLines; l++) {
            if (l < data.lines.length) content += data.lines[l].join("");
            content += "\n";
        }
    }

    const filename = (fontName.value || fontName.placeholder).toLowerCase().replaceAll(" ", "_") + ".mast";
    download_file(content, filename);
}

function font_to_editor() {
    const char = selCharacter.value;
    if (!fontmap.has(char)) return;

    set_lines(fontmap.get(char).lines);
}

function editor_to_font() {
    let char = selCharacter.value;
    if (char === "ADD_NEW") char = window.prompt("Assign design to character:");
    if (!char) return;

    if (fontmap.has(char)) {
        if (!window.confirm("Overwrite existing design for the '"+char+"' character?")) return;
    }
    if ([...char].length !== 1) {
        window.alert("Please only enter a single character!");
        return;
    }

    const editor_content = get_lines();
    const editor_lengths = get_line_lengths();

    fontmap.set(char, {
        lines: editor_content,
        width: Math.max(...editor_lengths),
        unbal: editor_lengths.some(ll => ll !== editor_lengths[0]),
    });

    run_tool();
}

function remove_character() {
    if(!fontmap.delete(selCharacter.value)) alert("Deletion failed!");
    selCharacter.selectedIndex++;
    run_tool();
}


function update_disabled_buttons() {
    btnLeft.disabled = selCharacter.value === "HEADER" || selCharacter.value === "ADD_NEW";
    btnRight.disabled = selCharacter.value === "HEADER";
    btnRemove.disabled = selCharacter.value === "HEADER" || selCharacter.value === "ADD_NEW";
}

function update_select_options() {
    const prevSelection = selCharacter.value || "ADD_NEW";
    selCharacter.innerHTML = "";
    selCharacter.appendChild(create_option("HEADER", "Char | Unicode | W | H | Balanced"));

    for (const [char, data] of fontmap.entries()) {
        const tc = char.padStart(3, "\u00A0").padEnd(5, "\u00A0");
        const tu = char.codePointAt(0).toString(16).padStart(5, "0");
        const tw = data.width.toString().padStart(2, "\u00A0").padEnd(3);
        const th = data.lines.length.toString().padStart(2, "\u00A0").padEnd(3);
        const tb = (data.unbal ? "✘" : "✔").padStart(5, "\u00A0");

        selCharacter.appendChild(create_option(char, `${tc}| U+${tu} |${tw}|${th}|${tb}`));
    }

    selCharacter.appendChild(create_option("ADD_NEW", "✚ Add New Character ✚".padStart(27, "\u00A0")));
    selCharacter.value = prevSelection;
}

function create_option(value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.innerText = text;
    return option;
}

function update_metrics() {
    metricsContainer.innerHTML = "";

    metricsContainer.appendChild(create_metric("A-Z", sequential_charset_metric("A", "Z")));
    metricsContainer.appendChild(create_metric("a-z", sequential_charset_metric("a", "z")));
    metricsContainer.appendChild(create_metric("0-9", sequential_charset_metric("0", "9")));
    metricsContainer.appendChild(create_metric("ASCII", sequential_charset_metric("!", "~"), 0.32));

    metricsContainer.appendChild(create_metric("Balanced", () => {
        if (fontmap.size < 1) return undefined;

        if (Array.from(fontmap.values()).some(fontData => fontData.unbal)) {
            return 0;
        }
        // All characters should occupy the same number of lines for the font to work properly.
        let used_lines = undefined;
        for (const [char, data] of fontmap.entries()) {
            if (used_lines === undefined) {
                used_lines = data.lines.length;
            } else if (data.lines.length !== used_lines) {
                return 0.8;
            }
        }

        return 1;
    }));

    metricsContainer.appendChild(create_metric("Monospace", () => {
        if (fontmap.size < 1) return undefined;
        if (fontmetrics.get("Balanced") !== 1) return 0;

        const firstWidth = fontmap.values().next().value.width;
        if (Array.from(fontmap.values()).some(fontData => fontData.width !== firstWidth)) {
            return 0;
        }

        return 1;
    }));
}

/**
 * 
 * @param {string} name 
 * @param {() => number} evaluator 
 * @param {number} nearpass_threshold 
 * @returns {Element}
 */
function create_metric(name, evaluator, nearpass_threshold = 0.8) {
    const score = evaluator();
    fontmetrics.set(name, score);
    const metric = document.createElement("div");
    metric.classList.add("col");

    const metricVal = document.createElement("span");    
    if (score === undefined) {
        metricVal.innerText = "N/A";
        metric.style.color = "#888";
    } else if (score >= 1) {
        metricVal.innerText = "✔";
        metric.style.color = "#080";
    } else if (score >= nearpass_threshold) {
        metricVal.innerText = Math.round(score * 100) + "%";
        metric.style.color = "#f80";
    } else {
        metricVal.innerText = "✘";
        metric.style.color = "#f00";
    }

    const metricName = document.createElement("span");
    metricName.innerText = name;

    metric.append(metricVal, metricName);
    return metric;
}

function sequential_charset_metric(startChar, endChar) {
    return () => {
        const startCode = startChar.codePointAt(0);
        const endCode = endChar.codePointAt(0);

        let completeChars = 0;
        for(let i = startCode; i <= endCode; i++) {
            if (fontmap.has(String.fromCodePoint(i))) completeChars++;
        }

        return completeChars / (endCode - startCode + 1);
    }
}
