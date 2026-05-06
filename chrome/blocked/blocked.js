const siteName = document.getElementById("site-name");
const params = new URLSearchParams(window.location.search);
const site = params.get("site");

if (site) {
  siteName.textContent = site;
}
