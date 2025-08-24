const sign_width = 96;
const sign_height = 48;
const sign_margin = 3;
const scalingFactor = 4;

console.time("load_char_sizes");
let char_sizes = new Map();
fetch('./out/char_sizes_full.txt').then((res) => {
    res.text().then((res) => {
        for (const line of res.split('\n')) {
            const vals = line.split('\t');
            char_sizes.set(vals[0], {
                width: +vals[1],
                height: +vals[2],
                ascent: +vals[3],
            })
        }
        console.timeEnd("load_char_sizes");
        run_tool();
    })
})

const text = document.querySelector("textarea#mse-input");
const sign = document.querySelector("canvas#mse-output");
const background = document.querySelector("img#mse-bg");

const toggleBackground = document.querySelector("input#mse-enable-signbg");
const toggleOverlay = document.querySelector("input#mse-enable-overlay");
const toggleCentering = document.querySelector("input#mse-enable-centering");

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
        center_text: toggleCentering.checked
    });
}

function redraw_sign({layer_background, layer_overlay, center_text}) {
    if (!char_sizes.size) {
        ctx.fillText("Loading...", 10, 20);
        return;
    }

    const lines = text.value.split("\n");
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
        if (layer_overlay) {
            // draw baseline markings
            ctx.fillStyle = "#ffffff80";
            ctx.fillRect(0, baseline, sign_margin+2, 1);
            ctx.fillRect(sign_width-(sign_margin+2), baseline, sign_margin+2, 1);
        }

        let cursor = sign_margin;
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
                    ctx.fillStyle = "#00ff0020";
                    ctx.fillRect(cursor, baseline-char_size.ascent, char_size.width, char_size.height);
                }
                cursor += char_size.width;
                continue;
            }

            if (layer_overlay) {
                // draw ascent
                ctx.fillStyle = "#0000ff20";
                ctx.fillRect(cursor, baseline-char_size.ascent, char_size.width, char_size.ascent);
                // draw descent
                ctx.fillStyle = "#00ffff20";
                ctx.fillRect(cursor, baseline, char_size.width, char_size.height-char_size.ascent);
                // draw gap
                ctx.fillStyle = "#ffff0040";
                ctx.fillRect(cursor+char_size.width, baseline-char_size.ascent, 1, char_size.height);
            }
            cursor += char_size.width+1;
        }
    }
}
