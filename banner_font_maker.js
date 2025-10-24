import {get_lines, get_line_lengths} from "./sign_editor.js";

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
const btnLoad = document.querySelector("#bfm-btn-load");
const btnSave = document.querySelector("#bfm-btn-save");

const metricsContainer = document.querySelector("#bfm-out-metrics");

const btnLeft = document.querySelector("#bfm-btn-left");
const btnRight = document.querySelector("#bfm-btn-right");
const btnRemove = document.querySelector("#bfm-btn-remove");
const selCharacter = document.querySelector("select#bfm-sel-char");

/**
 * @type {Map<string, {lines: string[], width: number, unbal: boolean}}
 */
let fontmap = new Map();

form.onsubmit = (e) => e.preventDefault();

selCharacter.addEventListener("input", run_tool);
btnRight.addEventListener("click", editor_to_font);

function run_tool() {
    update_select_options();
    update_metrics();
    update_disabled_buttons();
}
run_tool();


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
        selCharacter.appendChild(
            create_option(char, 
                ` ${char} | U+${char.codePointAt(0).toString(16).padStart(4, "0")} | ${data.width} | ${data.lines.length} | ${data.unbal ? "✘" : "✔"}`
            )
        )
    }

    selCharacter.appendChild(create_option("ADD_NEW", "+ Add New Character +"));
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

    metricsContainer.appendChild(create_metric("Monospace", () => undefined));
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
