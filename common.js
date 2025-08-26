
export function fb_span(message, isError = true) {
    const fb = document.createElement("span");
    fb.innerText = "" + message;
    fb.classList.add("fb");
    if (isError) fb.classList.add("error");
    return fb;
}

/**
 * @typedef {{file: string, ascent: number, height?: number, chars: string[], atlas_height: number, atlas_width: number}} BitmapProvider
 */

/**
 * Extract a list of bitmap providers from font mappings.
 * @param font_mappings The object parsed from the font mappings json file.
 * @returns {BitmapProvider[]}
 */
export function extract_bitmaps_from_font_mappings(font_mappings) {
    if (!("providers" in font_mappings)) throw TypeError("Missing providers field.");

    const bitmaps = [];

    for (let i = 0; i < font_mappings.providers.length; i++) {
        if (font_mappings.providers[i].type !== "bitmap") {
            console.warn("Unsupported provider type: ", font_mappings.providers[i].type);
            continue;
        }

        // spread code units to code points & find expected atlas dimensions
        let atlas_height = font_mappings.providers[i].chars.length;
        let atlas_width = 0;

        let chars = new Array(atlas_height);
        for (let l = 0; l < atlas_height; l++) {
            chars[l] = [...font_mappings.providers[i].chars[l]];

            if (chars[l].length > atlas_width) atlas_width = chars[l].length;
        }

        bitmaps.push({
            file: font_mappings.providers[i].file.replace("minecraft:font/", ""),
            ascent: font_mappings.providers[i].ascent,
            chars: chars,
            height: font_mappings.providers[i].height,
            atlas_height: atlas_height,
            atlas_width: atlas_width,
        })
    }

    return bitmaps;
}
