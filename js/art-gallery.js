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

const ipLabels = {
  "阿拉蕾": "Dr. Slump Arale",
  "版画": "Prints",
  "北条司": "Tsukasa Hojo",
  "东京喰种": "Tokyo Ghoul",
  "哆啦A梦": "Doraemon",
  "怪医黑杰克": "Black Jack",
  "灌篮高手": "Slam Dunk",
  "海报": "Posters",
  "航海王": "One Piece",
  "火影忍者": "Naruto",
  "极上生徒会": "Best Student Council",
  "精灵宝可梦": "Pokemon",
  "快餐厅之恋": "Pia Carrot",
  "蜡笔小新": "Crayon Shin-chan",
  "龙珠": "Dragon Ball",
  "美少女战士": "Sailor Moon",
  "名侦探柯南": "Detective Conan",
  "魔卡少女樱": "Cardcaptor Sakura",
  "森林大帝": "Jungle Emperor Leo",
  "死神": "Bleach",
  "松本零士": "Leiji Matsumoto",
  "天地无用": "Tenchi Muyo!",
  "铁臂阿童木": "Astro Boy",
  "樱花大战": "Sakura Wars",
  "樱桃小丸子": "Chibi Maruko-chan",
  "幽游白书": "Yu Yu Hakusho",
  "椎名高志": "Takashi Shiina",
  "佐藤好春": "Yoshiharu Sato",
};

const typeLabels = {
  "原画": "Original Art",
  "手稿": "Production Drawing",
  "赛璐珞": "Animation Cel",
  "版画": "Print",
  "海报": "Poster",
};

function displayIp(ip) {
  return ipLabels[ip] ?? ip;
}

function displayType(type) {
  return typeLabels[type] ?? type;
}

function displayTitle(artwork) {
  return [displayIp(artwork.ip), displayType(artwork.type), artwork.item].filter(Boolean).join(" · ");
}

function matchesSearch(artwork) {
  if (!state.search) return true;
  const haystack = `${artwork.ip} ${displayIp(artwork.ip)} ${artwork.type} ${displayType(artwork.type)} ${artwork.item} ${artwork.fileName} ${artwork.path}`.toLowerCase();
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
  const activeIpLabel = state.activeIp === "all" ? "All Artworks" : displayIp(state.activeIp);
  const activeTypeLabel = state.activeType === "all" ? "" : ` · ${displayType(state.activeType)}`;

  els.pageTitle.textContent = activeIpLabel;
  els.eyebrow.textContent = `${state.filtered.length} artworks${activeTypeLabel}`;
  els.visibleCount.textContent = state.filtered.length;
  els.emptyState.hidden = state.filtered.length > 0;

  document.querySelectorAll(".ip-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.ip === state.activeIp);
  });
}

function renderIpNav(ips) {
  const allButton = createIpButton("all", "All IP", state.artworks.length);
  const buttons = ips.map((ip) => createIpButton(ip.name, displayIp(ip.name), ip.count));
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
    new Option("All categories", "all"),
    ...types.sort((a, b) => collator.compare(displayType(a.name), displayType(b.name))).map((type) => new Option(`${displayType(type.name)} (${type.count})`, type.name)),
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

    card.querySelector("img").alt = displayTitle(artwork);
    card.querySelector("strong").textContent = displayTitle(artwork);
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
  els.viewerImage.alt = displayTitle(artwork);
  els.viewerTitle.textContent = displayTitle(artwork);
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
  els.emptyState.textContent = "Gallery data failed to load.";
});
