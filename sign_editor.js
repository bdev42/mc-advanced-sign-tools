import {
    load_atlas_map,
    load_char_sizes,
    load_char_textures_map_and_atlas_list
} from "./common.js";

const sign_width = 96;
const sign_height = 48;
const sign_margin = 3;
const scalingFactor = 4;

const char_sizes = await load_char_sizes('./out/char_sizes_full.txt');
const [char_textures, atlas_list] = await load_char_textures_map_and_atlas_list('./font_mappings/default.json');
const atlas_map = await load_atlas_map(atlas_list);

const text = document.querySelector("textarea#mse-input");
const sign = document.querySelector("canvas#mse-output");
const background = document.querySelector("img#mse-bg");

const toggleBackground = document.querySelector("input#mse-enable-signbg");
const toggleOverlay = document.querySelector("input#mse-enable-overlay");
const toggleCentering = document.querySelector("input#mse-enable-centering");

const overlayLegend = document.querySelector("#overlay-legend");

toggleOverlay.addEventListener("input", () => {
    overlayLegend.classList.toggle("hidden", !toggleOverlay.checked);
});

[text, toggleBackground, toggleOverlay, toggleCentering].forEach(el => {
    el.addEventListener("input", run_tool);
})
/**
 * @type CanvasRenderingContext2D
 */
const ctx = sign.getContext('2d');
ctx.scale(scalingFactor, scalingFactor);
ctx.imageSmoothingEnabled = false;
ctx.lineWidth = 1;

function run_tool() {
    redraw_sign({
        layer_background: toggleBackground.checked,
        layer_overlay: toggleOverlay.checked,
        center_text: toggleCentering.checked,
        text_tint: "black",
    });
}
run_tool();


function redraw_sign({layer_background, layer_overlay, center_text, text_tint}) {
    if (!char_sizes.size) {
        ctx.fillText("Loading...", 10, 20);
        return;
    }

    const lines = [];
    for (const line of text.value.split("\n")) lines.push([...line]);
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
        if (center_text && cursor < sign_width - 2*sign_margin) line_start = Math.round(sign_width/2 - cursor/2);
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
    }
}
