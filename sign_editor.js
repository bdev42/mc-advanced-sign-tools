import {
    fb_span,
    load_atlas_map,
    load_char_sizes,
    load_char_textures_map_and_atlas_list
} from "./common.js";

const sign_width = 96;
const sign_height = 48;
const sign_margin = 3;
const sign_textarea = sign_width - 2*sign_margin;
const scalingFactor = 4;

const char_sizes = await load_char_sizes("./out/char_sizes_full.txt");
const [char_textures, atlas_list] = await load_char_textures_map_and_atlas_list("./font_mappings/default.json");
const atlas_map = await load_atlas_map(atlas_list);

const form = document.querySelector("#tool-mse form");
const text = document.querySelector("textarea#mse-input");
const sign = document.querySelector("canvas#mse-output");
const background = document.querySelector("img#mse-bg");

const toggleBackground = document.querySelector("input#mse-enable-signbg");
const toggleOverlay = document.querySelector("input#mse-enable-overlay");
const toggleCentering = document.querySelector("input#mse-enable-centering");

const overlayLegend = document.querySelector("#overlay-legend");

const lineCopyContainer = document.querySelector("#mse-line-copy");
const lineLengthsContainer = document.querySelector("#mse-line-length");

const btnTruncate = document.querySelector("#mse-btn-truncate");
const btnBalance = document.querySelector("#mse-btn-balance");
const selBalance = document.querySelector("#mse-sel-balance");
const selTextTint = document.querySelector("#mse-sel-texttint");

/**
 * @type number[]
 */
let line_lengths = [];

toggleOverlay.addEventListener("input", () => {
    overlayLegend.classList.toggle("hidden", !toggleOverlay.checked);
});

[...lineCopyContainer.children].forEach((btn, idx) => {
    btn.addEventListener("click", () => {
        const line = text.value.split("\n")[idx];
        if(line) navigator.clipboard.writeText(line);
    });
});

[text, toggleBackground, toggleOverlay, toggleCentering, selTextTint].forEach(el => {
    el.addEventListener("input", run_tool);
})

form.onsubmit = (e) => e.preventDefault();
btnTruncate.addEventListener("click", utils_truncate);
btnBalance.addEventListener("click", utils_balance);

/**
 * @type CanvasRenderingContext2D
 */
const ctx = sign.getContext("2d");
ctx.scale(scalingFactor, scalingFactor);
ctx.imageSmoothingEnabled = false;
ctx.lineWidth = 1;

function run_tool() {
    line_lengths = redraw_sign({
        ctx,
        layer_background: toggleBackground.checked,
        layer_overlay: toggleOverlay.checked,
        center_text: toggleCentering.checked,
        text_tint: selTextTint.value,
    });

    display_line_lengths(line_lengths);
}
run_tool();

export function get_line_lengths() {
    return line_lengths;
}

export function get_lines() {
    const lines = [];
    for (const line of text.value.split("\n")) lines.push([...line]);
    return lines;
}

export function set_lines(lines) {
    text.value = lines.map(l => l.join("")).join("\n");
}

function redraw_sign({ctx, layer_background, layer_overlay, center_text, text_tint}) {
    if (!char_sizes.size) {
        ctx.fillText("Loading...", 10, 20);
        return;
    }
    const line_lengths = [];

    const lines = get_lines();
    // clear canvas
    if (layer_background) ctx.drawImage(background, 0, 0, sign_width, sign_height);
    else ctx.clearRect(0, 0, sign_width, sign_height);

    if (layer_overlay) {
        // draw margins
        ctx.fillStyle = "#ff000040"
        ctx.fillRect(0, 0, sign_margin, sign_height);
        ctx.fillRect(sign_width-sign_margin, 0, sign_margin, sign_height);
    }

    for (let l = 0; l < lines.length; l++) {
        const baseline = 1 + (l+1) * 10;
        const lineCanvas = new OffscreenCanvas(sign_width-sign_margin, sign_height);
        const lineCtx = lineCanvas.getContext('2d');
        lineCtx.imageSmoothingEnabled = false;
        let lineOverlayCanvas, lineOverlayCtx;
        if (layer_overlay) {
            // draw baseline markings
            ctx.fillStyle = "#ffffff80";
            ctx.fillRect(0, baseline, sign_margin+2, 1);
            ctx.fillRect(sign_width-(sign_margin+2), baseline, sign_margin+2, 1);
            lineOverlayCanvas = new OffscreenCanvas(lineCanvas.width, lineCanvas.height);
            lineOverlayCtx = lineOverlayCanvas.getContext('2d');
        }

        let cursor = 0;
        for (let c = 0; c < lines[l].length; c++) {
            const char = lines[l][c];
            if (!char_sizes.has(char)) {
                console.warn("Skipped unmapped character: "+char);
                continue;
            }
            const char_size = char_sizes.get(char);

            if (char === " ") {
                if (layer_overlay) {
                    // draw space
                    lineOverlayCtx.fillStyle = "#00ff0020";
                    lineOverlayCtx.fillRect(cursor, baseline-char_size.ascent, char_size.width, char_size.height);
                }
                cursor += char_size.width;
                continue;
            }
            // render character texture
            if (char_textures.has(char)) {
                const {atlas, cx, cy} = char_textures.get(char);

                if (atlas_map.has(atlas)) {
                    const {texture, width: atlas_width, height: atlas_height} = atlas_map.get(atlas);

                    const tex_width = Math.floor(texture.width / atlas_width);
                    const tex_height = Math.floor(texture.height / atlas_height);

                    lineCtx.drawImage(texture,
                        cx * tex_width, cy * tex_height, tex_width, tex_height,
                        cursor, baseline-char_size.ascent, tex_width, tex_height
                    );
                }
            }

            if (layer_overlay) {
                // draw ascent
                lineOverlayCtx.fillStyle = "#0000ff20";
                lineOverlayCtx.fillRect(cursor, baseline-char_size.ascent, char_size.width, char_size.ascent);
                // draw descent
                lineOverlayCtx.fillStyle = "#00ffff20";
                lineOverlayCtx.fillRect(cursor, baseline, char_size.width, char_size.height-char_size.ascent);
                // draw gap
                lineOverlayCtx.fillStyle = "#ffff0040";
                lineOverlayCtx.fillRect(cursor+char_size.width, baseline-char_size.ascent, 1, char_size.height);
            }
            cursor += char_size.width+1;
        }
        // tint the line color
        lineCtx.globalCompositeOperation = "source-atop";
        lineCtx.fillStyle = text_tint;
        lineCtx.fillRect(0, 0, lineCanvas.width, lineCanvas.height);
        lineCtx.globalCompositeOperation = "source-over";
        // draw line onto output canvas & center if needed
        let line_start = sign_margin;
        if (center_text && cursor < sign_textarea) line_start = Math.round(sign_width/2 - cursor/2);
        ctx.drawImage(lineCanvas,
            0, 0, sign_width-sign_margin, sign_height,
            line_start, 0, sign_width-sign_margin, sign_height
        );
        if (layer_overlay) {
            ctx.drawImage(lineOverlayCanvas,
                0, 0, sign_width-sign_margin, sign_height,
                line_start, 0, sign_width-sign_margin, sign_height
            );
        }
        line_lengths.push(cursor);
    }
    return line_lengths;
}

function display_line_lengths(line_lengths) {
    lineLengthsContainer.innerHTML = "";
    for (let l = 0; l < 4; l++) {
        if (l > line_lengths.length-1) {
            lineLengthsContainer.appendChild(fb_span("-", false));
        } else if (line_lengths[l] <= sign_textarea) {
            lineLengthsContainer.appendChild(fb_span(`${line_lengths[l]}/${sign_textarea}`, false));
        } else {
            lineLengthsContainer.appendChild(fb_span(`${line_lengths[l] - sign_textarea} >`, true));
        }
    }
}

function utils_truncate() {
    let truncated = get_lines().slice(0, 4);
    
    for (let l = 0; l < truncated.length; l++) {
        let cursor = 0;
        for (let c = 0; c < truncated[l].length; c++) {
            const char = truncated[l][c];
            if (!char_sizes.has(char)) continue;

            cursor += char_sizes.get(char).width + (char === " " ? 0 : 1);

            if (cursor > sign_textarea) {
                truncated[l] = truncated[l].slice(0, c);
                break;
            }
        }
    }

    set_lines(truncated);
    run_tool();
}

function utils_balance() {
    if (line_lengths.length < 2) return;

    let balanced = get_lines();
    let target_len = 0;
    let second_longest_len = 0;
    for (const len of line_lengths) {
        if (len > target_len) {
            second_longest_len = target_len;
            target_len = len;
        } else if (len > second_longest_len && len < target_len) {
            second_longest_len = len;
        }
    }

    if (selBalance.value === "SO") {
        for (const [l, len] of line_lengths.entries()) {
            const gap = target_len - len;
            const spaces = Math.floor((gap+1)/4);

            for (let s = 0; s < spaces; s++) {
                balanced[l].push(" ");
            }
        }
    } else if (selBalance.value === "SAD-a" || selBalance.value === "SAD-b") {
        const charmap = new Map([
            [5, "`."],
            [4, " "],
            [3, "`"],
            [2, "."],
        ])

        if (target_len - second_longest_len == 1) target_len += 2;

        for (const [l, len] of line_lengths.entries()) {
            const gap = target_len - len;
            if (gap < 2) continue;

            const spaces = Math.floor((gap - 2) / 4);
            const remainder = gap - (4 * spaces);

            if (selBalance.value === "SAD-b") balanced[l].push(charmap.get(remainder));

            for (let s = 0; s < spaces; s++) {
                balanced[l].push(" ");
            }

            if (selBalance.value === "SAD-a") balanced[l].push(charmap.get(remainder));
        }
    }

    set_lines(balanced);
    run_tool();
}
