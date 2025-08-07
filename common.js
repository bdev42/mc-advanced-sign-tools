
export function fb_span(message, isError = true) {
    const fb = document.createElement("span");
    fb.innerText = "" + message;
    fb.classList.add("fb");
    if (isError) fb.classList.add("error");
    return fb;
}
