const state = {
  artworks: [],
  filtered: [],
  activeIp: "all",
  activeType: "all",
  search: "",
  viewerIndex: 0,
};

const els = {
  ipNav: document.querySelector("#ipNav"),
  ipTotal: document.querySelector("#ipTotal"),
  typeSelect: document.querySelector("#typeSelect"),
  searchInput: document.querySelector("#searchInput"),
  gallery: document.querySelector("#gallery"),
  visibleCount: document.querySelector("#visibleCount"),
  totalCount: document.querySelector("#totalCount"),
  pageTitle: document.querySelector("#pageTitle"),
  eyebrow: document.querySelector("#eyebrow"),
  emptyState: document.querySelector("#emptyState"),
  viewer: document.querySelector("#viewer"),
  viewerImage: document.querySelector("#viewerImage"),
  viewerTitle: document.querySelector("#viewerTitle"),
  viewerMeta: document.querySelector("#viewerMeta"),
  viewerClose: document.querySelector(".viewer-close"),
  viewerPrev: document.querySelector(".viewer-prev"),
  viewerNext: document.querySelector(".viewer-next"),
};

const collator = new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" });

function matchesSearch(artwork) {
  if (!state.search) return true;
  const haystack = `${artwork.ip} ${artwork.type} ${artwork.item} ${artwork.fileName} ${artwork.path}`.toLowerCase();
  return haystack.includes(state.search);
}

function applyFilters() {
  state.filtered = state.artworks.filter((artwork) => {
    const ipMatch = state.activeIp === "all" || artwork.ip === state.activeIp;
    const typeMatch = state.activeType === "all" || artwork.type === state.activeType;
    return ipMatch && typeMatch && matchesSearch(artwork);
  });

  renderGallery();
  updateSummary();
}

function updateSummary() {
  const activeIpLabel = state.activeIp === "all" ? "全部作品" : state.activeIp;
  const activeTypeLabel = state.activeType === "all" ? "" : ` · ${state.activeType}`;

  els.pageTitle.textContent = activeIpLabel;
  els.eyebrow.textContent = `${state.filtered.length} 件${activeTypeLabel}`;
  els.visibleCount.textContent = state.filtered.length;
  els.emptyState.hidden = state.filtered.length > 0;

  document.querySelectorAll(".ip-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.ip === state.activeIp);
  });
}

function renderIpNav(ips) {
  const allButton = createIpButton("all", "全部 IP", state.artworks.length);
  const buttons = ips.map((ip) => createIpButton(ip.name, ip.name, ip.count));
  els.ipNav.replaceChildren(allButton, ...buttons);
  els.ipTotal.textContent = ips.length;
}

function createIpButton(value, label, count) {
  const button = document.createElement("button");
  button.className = "ip-button";
  button.type = "button";
  button.dataset.ip = value;
  button.innerHTML = `<span></span><span></span>`;
  button.children[0].textContent = label;
  button.children[1].textContent = count;
  button.addEventListener("click", () => {
    state.activeIp = value;
    applyFilters();
  });
  return button;
}

function renderTypes(types) {
  const options = [
    new Option("全部类型", "all"),
    ...types.sort((a, b) => collator.compare(a.name, b.name)).map((type) => new Option(`${type.name} (${type.count})`, type.name)),
  ];
  els.typeSelect.replaceChildren(...options);
}

function renderGallery() {
  const fragment = document.createDocumentFragment();

  state.filtered.forEach((artwork, index) => {
    const card = document.createElement("figure");
    card.className = "art-card";
    card.dataset.index = index;
    card.innerHTML = `
      <img loading="lazy" src="${artwork.src}" alt="">
      <figcaption>
        <strong></strong>
        <span></span>
      </figcaption>
    `;

    card.querySelector("img").alt = artwork.title;
    card.querySelector("strong").textContent = artwork.title;
    card.querySelector("span").textContent = artwork.fileName;
    card.addEventListener("click", () => openViewer(index));
    fragment.append(card);
  });

  els.gallery.replaceChildren(fragment);
}

function openViewer(index) {
  state.viewerIndex = index;
  renderViewer();
  els.viewer.showModal();
}

function renderViewer() {
  const artwork = state.filtered[state.viewerIndex];
  if (!artwork) return;

  els.viewerImage.src = artwork.src;
  els.viewerImage.alt = artwork.title;
  els.viewerTitle.textContent = artwork.title;
  els.viewerMeta.textContent = `${artwork.fileName} · ${state.viewerIndex + 1}/${state.filtered.length}`;
}

function moveViewer(direction) {
  if (!state.filtered.length) return;
  state.viewerIndex = (state.viewerIndex + direction + state.filtered.length) % state.filtered.length;
  renderViewer();
}

async function init() {
  const response = await fetch("data/art-gallery.json");
  const manifest = await response.json();

  state.artworks = manifest.artworks;
  state.filtered = [...state.artworks];

  els.totalCount.textContent = manifest.total;
  renderTypes(manifest.types);
  renderIpNav(manifest.ips);
  applyFilters();
}

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  applyFilters();
});

els.typeSelect.addEventListener("change", (event) => {
  state.activeType = event.target.value;
  applyFilters();
});

els.viewerClose.addEventListener("click", () => els.viewer.close());
els.viewerPrev.addEventListener("click", () => moveViewer(-1));
els.viewerNext.addEventListener("click", () => moveViewer(1));
els.viewer.addEventListener("click", (event) => {
  if (event.target === els.viewer) els.viewer.close();
});

document.addEventListener("keydown", (event) => {
  if (!els.viewer.open) return;
  if (event.key === "ArrowLeft") moveViewer(-1);
  if (event.key === "ArrowRight") moveViewer(1);
});

init().catch((error) => {
  console.error(error);
  els.emptyState.hidden = false;
  els.emptyState.textContent = "画库数据加载失败。";
});
