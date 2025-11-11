import {extract_bitmaps_from_font_mappings, fb_span, load_json} from "./common.js";

const fm_default = await load_json("./external/font_mappings/default.json");
const fm_classic = await load_json("./external/font_mappings/old.json");
let fm_file_content = null;

/** @type {(BitmapProvider[])} */
let bitmaps= [];
let outputMap = new Map();

const form = document.querySelector("#tool-cwc form");
const os_count = document.querySelector("#output-summary span");
const os_button = document.querySelector("#output-summary button");
const fm_file = document.querySelector("input#fm-upload-file");
const fm_fb = document.querySelector("#fm-feedback");
const sw_value = document.querySelector("input#sw-value");

os_button.addEventListener("click", download_output)
fm_file.addEventListener("change", read_uploaded_mappings)
form.onsubmit = (e) => e.preventDefault();
form.addEventListener("change", run_tool);

function run_tool() {
    process_inputs();
    redraw_bitmaps_list();
}
run_tool();


function process_inputs() {
    const space_width = document.querySelector('input[name="space_width"]:checked').value;
    if (space_width === "custom") {
        sw_value.disabled = false;
    } else {
        sw_value.disabled = true;
        sw_value.value = 4;
    }

    const font_mappings = document.querySelector('input[name="font_mappings"]:checked').value;
    let fm_parsed;

    try {
        if (font_mappings === "default") {
            if (!fm_default) {
                fm_fb.replaceChildren(fb_span("Loading data... please wait.", false));
                return;
            }
            fm_parsed = fm_default;
        } else if (font_mappings === "classic") {
            if (!fm_classic) {
                fm_fb.replaceChildren(fb_span("Loading data... please wait.", false));
                return;
            }
            fm_parsed = fm_classic;
        } else if (font_mappings === "upload" && fm_file_content) {
            fm_parsed = JSON.parse(fm_file_content);
        }

        bitmaps = extract_bitmaps_from_font_mappings(fm_parsed);

        fm_fb.replaceChildren(fb_span(`Found ${bitmaps.length} provider(s) in font mappings.`, false));
    }catch (e) {
        fm_fb.replaceChildren(fb_span("Failed to parse font mappings! "+e.message));
    }
}

function download_output() {
    const a = document.createElement("a");
    let txt = "";
    for (let [key, value] of outputMap) {
        txt += `${key}\t${value.width}\t${value.height}\t${value.ascent}\n`;
    }
    a.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(txt));
    a.setAttribute("download", "char_sizes.txt");
    a.style.display = "none";
    a.click();
    a.remove();
}

function read_uploaded_mappings() {
    fm_file_content = null;
    if (!fm_file.files.length) return;

    console.time("fm_file_read");
    const reader = new FileReader();

    reader.onload = (e) => {
        fm_file_content = e.target.result;
        console.timeEnd("fm_file_read");

        form.querySelector("input#fm-upload").checked = true;
        run_tool();
    }
    reader.readAsText(fm_file.files[0]);
}

function redraw_bitmaps_list() {
    const output = document.querySelector("#tool-cwc .output");
    output.innerHTML = "";

    for (let bitmap of bitmaps) {
        const d = document.createElement("details");

        const s = document.createElement("summary");
        s.innerText = "" + bitmap.file;
        const ao = atlas_override(bitmap, d);
        s.appendChild(ao);

        const i = document.createElement("img");
        i.src = "external/textures/" + bitmap.file;
        const t = document.createElement("table");
        const p = document.createElement("progress");
        d.append(s, i, t, p);

        d.addEventListener("toggle", (e) => process_bitmap(e, bitmap));
        output.appendChild(d);
    }
}

function atlas_override(bitmap, parent_details) {
    const ao = document.createElement("div");
    ao.className = "atlas-override";

    const ao_checkbox = document.createElement("input");
    ao_checkbox.type = "checkbox";
    ao_checkbox.id = "ao-" + bitmap.file;

    const ao_label = document.createElement("label");
    ao_label.for = ao_checkbox.id;
    const ao_file = document.createElement("input");
    ao_file.type = "file";
    ao_file.accept = "image/png";
    ao_label.append("Replace: ", ao_file);

    ao_checkbox.addEventListener("change", () => {
        const img = parent_details.querySelector("img");

        img.src = "external/textures/" + bitmap.file;
        if (ao_checkbox.checked) {
            if (!ao_file.files.length) return;
            img.src = URL.createObjectURL(ao_file.files[0]);
        }

        if (!parent_details.open) return;
        parent_details.open = false;
        img.onload = () => {
            parent_details.open = true;
            img.onload = null;
        }
    })

    ao.append(ao_checkbox, ao_label);
    return ao;
}


async function process_bitmap(toggle_event, bitmap) {
    const details = toggle_event.target;
    if (!details.open) return;
    details.querySelectorAll(".fb").forEach(e => e.remove());

    const img = details.querySelector("img");
    if (!img.complete || img.naturalWidth === 0) {
        img.after(fb_span("Failed to find and load atlas: " + img.src));
        return;
    }

    console.debug("\n");
    console.time("proc_bitmap");
    const table = details.querySelector("table");
    table.innerHTML = "<tr><th>unicode</th><th>char</th><th>img</th><th>width</th></tr>";

    // Find the number of rows and columns of characters in the atlas
    const {atlas_width, atlas_height} = bitmap;
    console.debug(`Atlas layout: ${atlas_width} x ${atlas_height} characters`)

    // Set progressbar target
    const progress = details.querySelector("progress");
    progress.max = atlas_height * atlas_width;
    progress.value = 0;

    // Setup atlas on canvas for analysis
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", {willReadFrequently: true});
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    console.debug(`Atlas dimensions: ${img.width} x ${img.height} pixels`)

    const tex_width = Math.floor(img.width / atlas_width);
    const tex_height = Math.floor(img.height / atlas_height);
    console.debug(`Character texture dimensions: ${tex_width} x ${tex_height} pixels`)

    // Analyze texture of all non-"null" characters
    for (let cy = 0; cy < atlas_height; cy++) {
        for (let cx = 0; cx < atlas_width && cx < bitmap.chars[cy].length; cx++) {
            const char = bitmap.chars[cy][cx];
            if (char === "\u0000") { continue; }

            // extract real character width
            const img_data = ctx.getImageData(cx * tex_width, cy * tex_height, tex_width, tex_height);
            const real_char_width = char === " " ? sw_value.value : analyze_character_width(img_data);

            // extract individual glyph images
            const glyph = document.createElement("canvas");
            glyph.width = real_char_width;
            glyph.height = img_data.height;
            glyph.getContext("2d").putImageData(img_data, 0, 0);

            // display result
            outputMap.set(char, {width: real_char_width, height: bitmap.height ?? 8, ascent: bitmap.ascent});
            os_count.innerText = outputMap.size;
            const res = document.createElement("tr");
            res.innerHTML = `<td>U+${char.codePointAt(0).toString(16).padStart(4, '0')}</td><td>${char}</td><td><img alt="Broken ${char} glyph" src="${glyph.toDataURL("image/png")}"></td><td>${real_char_width}</td>`
            table.appendChild(res);

            progress.value = cy * atlas_width + cx;
            progress.scrollIntoView(false);

            await new Promise(requestAnimationFrame);
        }
    }

    progress.value = progress.max;
    console.timeEnd("proc_bitmap");
}

function analyze_character_width(img_data) {
    for (let px = img_data.width-1; px >= 0; px--) {
        for (let py = 0; py < img_data.height; py++) {
            const i = 4 * (py * img_data.width + px);
            const alpha = img_data.data[i+3];

            if (alpha > 0) {
                return px + 1;
            }
        }
    }

    return 0;
}
