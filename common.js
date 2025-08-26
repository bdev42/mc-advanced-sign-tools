
export function fb_span(message, isError = true) {
    const fb = document.createElement("span");
    fb.innerText = "" + message;
    fb.classList.add("fb");
    if (isError) fb.classList.add("error");
    return fb;
}

export async function load_json(url) {
    const res = await fetch(url);
    return await res.json();
}

/**
 * @param url image file url
 * @returns {Promise<Image>}
 */
export async function load_image(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            resolve(img);
        };

        img.onerror = (error) => {
            reject(new Error(`Failed to load image: ${url}. Error: ${error}`));
        };

        img.src = url;
    });
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

/**
 * @param url
 * @returns {Promise<Map<string, {width: number, height: number, ascent: number}>>}
 */
export async function load_char_sizes(url) {
    console.time("load_char_sizes");
    let char_sizes = new Map();

    const res = await fetch(url);
    const body = await res.text();

    for (const line of body.split('\n')) {
        const vals = line.split('\t');
        char_sizes.set(vals[0], {
            width: +vals[1],
            height: +vals[2],
            ascent: +vals[3],
        })
    }
    console.timeEnd("load_char_sizes");
    return char_sizes;
}

/**
 * @typedef {Map<string, {atlas: string, cx: number, cy: number}>} CharTexturesMap
 * @typedef {{name: string, width: number, height: number}[]} AtlasList
 */

/**
 *
 * @param url the url to the json file with the font mappings
 * @returns {Promise<[CharTexturesMap, AtlasList]>}
 */
export async function load_char_textures_map_and_atlas_list(url) {
    const bitmaps = extract_bitmaps_from_font_mappings(
        await load_json(url)
    );
    /** @type {CharTexturesMap} */
    const textures_map = new Map();
    /** @type {AtlasList} */
    const atlas_list = [];

    for (const bitmap of bitmaps) {
        for (let cy = 0; cy < bitmap.atlas_height; cy++) {
            for (let cx = 0; cx < bitmap.atlas_width && cx < bitmap.chars[cy].length; cx++) {
                textures_map.set(bitmap.chars[cy][cx], {
                    atlas: bitmap.file,
                    cx: cx,
                    cy: cy,
                    cache: undefined
                })
            }
        }

        atlas_list.push({
            name: bitmap.file,
            width: bitmap.atlas_width,
            height: bitmap.atlas_height,
        })
    }
    return [textures_map, atlas_list];
}

/**
 * @typedef {Map<string, {texture: Image, width: number, height: number}>} AtlasMap
 */

/**
 * @param atlases {AtlasList} The list of atlas files to load
 * @returns {Promise<AtlasMap>}
 */
export async function load_atlas_map(atlases) {
    /** @type {AtlasMap} */
    const atlas_map = new Map();

    for (const atlas of atlases) {
        const img = await load_image('textures/' + atlas.name);
        atlas_map.set(atlas.name, {
            texture: img,
            width: atlas.width,
            height: atlas.height,
        });
    }
    return atlas_map;
}
