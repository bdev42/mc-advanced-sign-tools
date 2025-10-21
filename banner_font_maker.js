
const form = document.querySelector("#tool-mse form");

form.onsubmit = (e) => e.preventDefault();

const navSignEditor = document.querySelector("#nav-mse");
const navBannerFontMaker = document.querySelector("#nav-mse-bfm");
const toolContainer = document.querySelector("#tool-bfm");

window.addEventListener("hashchange", check_tool_active);
window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    return "";
});

check_tool_active()

function check_tool_active() {
    const bfm = location.hash === "#banner-font-maker";

    navBannerFontMaker.classList.toggle("active", bfm);
    navSignEditor.classList.toggle("active", !bfm);
    toolContainer.classList.toggle("hidden", !bfm);
}
