
export function fb_span(message, isError = true) {
    const fb = document.createElement("span");
    fb.innerText = "" + message;
    if (isError) fb.classList.add("error");
    return fb;
}
