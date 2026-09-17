"use strict";

/* =========================================================
CINEMAX ADMIN 2
MISMO SERVIDOR / MISMA SESIÓN / MISMOS DATOS QUE ADMIN 1
FAVORITOS + ANALÍTICAS + SERIES + EPISODIOS
========================================================= */

const API_URL = "";
const SESSION_KEY = "cinemax_session_id";

let sessionId = localStorage.getItem(SESSION_KEY) || "";
let currentUser = null;

let catalog = [];
let users = [];
let trash = [];

let analyticsData = [];
let analyticsSummary = {};
let favoritesData = [];

let editingSeriesId = null;
let editingSeries = null;
let editingSeasons = [];

let toastTimer = null;

/* =========================================================
HELPERS
========================================================= */

function $(id) {
return document.getElementById(id);
}

function getContentId(item) {


if (!item || typeof item !== "object") {
    return "";
}

const keys = [
    "id",
    "_id",
    "content_id",
    "contentId",
    "catalog_id",
    "catalogId",
    "uuid",
    "ID"
];

for (const key of keys) {

    if (
        item[key] !== undefined &&
        item[key] !== null &&
        String(item[key]) !== ""
    ) {
        return String(item[key]);
    }
}

return "";


}

function findCatalogItemById(id) {


const target = String(id ?? "");

return (
    catalog.find(
        item => getContentId(item) === target
    ) || null
);


}

function normalizeText(value) {


return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");


}

function escapeHtml(value) {


return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");


}

function jsEscape(value) {


return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");


}

function getValue(id) {
return $(id)?.value ?? "";
}

function setValue(id, value) {


if ($(id)) {
    $(id).value = value ?? "";
}


}

function setText(id, value) {


if ($(id)) {
    $(id).textContent = value ?? "";
}


}

/* =========================================================
CATÁLOGO
========================================================= */

function extractCatalogArray(response) {


if (!response) {
    return [];
}

if (Array.isArray(response)) {
    return response;
}

const keys = [
    "data",
    "catalog",
    "items",
    "content",
    "contents",
    "results",
    "movies",
    "series"
];

for (const key of keys) {

    if (Array.isArray(response[key])) {
        return response[key];
    }
}

if (
    response.data &&
    typeof response.data === "object"
) {

    for (const key of keys) {

        if (Array.isArray(response.data[key])) {
            return response.data[key];
        }
    }
}

return [];


}

function extractCatalogItem(response) {


if (!response) {
    return null;
}

if (
    response.item &&
    typeof response.item === "object"
) {
    return response.item;
}

if (
    response.content &&
    typeof response.content === "object" &&
    !Array.isArray(response.content)
) {
    return response.content;
}

if (
    response.data &&
    !Array.isArray(response.data) &&
    typeof response.data === "object"
) {
    return response.data;
}

return null;


}

/* =========================================================
GÉNEROS
========================================================= */

function getAllGenres(item) {


if (!item || typeof item !== "object") {
    return [];
}

const values = [];

const keys = [
    "genre",
    "genres",
    "genero",
    "generos",
    "tags",
    "categories",
    "categorias"
];

for (const key of keys) {

    const value = item[key];

    if (Array.isArray(value)) {

        value.forEach(v => {

            if (v && typeof v === "object") {

                values.push(
                    v.name ||
                    v.title ||
                    v.label ||
                    v.value ||
                    ""
                );

            } else {

                values.push(v);
            }
        });

    } else if (
        value &&
        typeof value === "object"
    ) {

        values.push(
            value.name ||
            value.title ||
            value.label ||
            value.value ||
            ""
        );

    } else if (
        value !== undefined &&
        value !== null
    ) {

        values.push(
            ...String(value).split(/[,|/;]+/)
        );
    }
}

return [
    ...new Set(
        values
            .map(normalizeText)
            .filter(Boolean)
    )
];


}

/* =========================================================
TERROR
========================================================= */

function isTerrorContent(item) {


if (!item || typeof item !== "object") {
    return false;
}

const directValues = [
    item.category,
    item.categoria,
    item.type,
    item.tipo,
    item.contentType,
    item.content_type,
    item.categoryType,
    item.category_type,
    item.mediaType,
    item.media_type
];

if (
    directValues.some(value => {

        const normalized = normalizeText(value);

        return (
            normalized === "terror" ||
            normalized === "horror"
        );
    })
) {
    return true;
}

if (
    item.terror === true ||
    item.horror === true
) {
    return true;
}

return getAllGenres(item).some(
    genre =>
        genre === "terror" ||
        genre === "horror" ||
        genre.includes("terror") ||
        genre.includes("horror")
);


}

/* =========================================================
SERIES
========================================================= */

function isSeriesContent(item) {


if (!item || typeof item !== "object") {
    return false;
}

const values = [

    item.category,
    item.categoria,

    item.type,
    item.tipo,

    item.contentType,
    item.content_type,

    item.categoryType,
    item.category_type,

    item.mediaType,
    item.media_type,

    item.kind,
    item.format,

    item.contentCategory,
    item.content_category,

    item.mediaCategory,
    item.media_category
];

for (const value of values) {

    if (
        value === undefined ||
        value === null
    ) {
        continue;
    }

    if (Array.isArray(value)) {

        const text = value
            .map(v => {

                if (
                    v &&
                    typeof v === "object"
                ) {

                    return (
                        v.name ||
                        v.title ||
                        v.label ||
                        v.value ||
                        ""
                    );
                }

                return String(v ?? "");
            })
            .join(" ");

        const normalized = normalizeText(text);

        if (
            normalized.includes("serie") ||
            normalized.includes("series") ||
            normalized === "tv" ||
            normalized.includes("tv show") ||
            normalized.includes("tvshow")
        ) {
            return true;
        }

    } else {

        const normalized = normalizeText(value);

        if (
            normalized === "serie" ||
            normalized === "series" ||
            normalized === "tv" ||
            normalized === "show" ||
            normalized === "tvshow" ||
            normalized === "tv show" ||
            normalized.includes("serie")
        ) {
            return true;
        }
    }
}

if (
    Array.isArray(item.seasons) ||
    Array.isArray(item.temporadas) ||
    Array.isArray(item.episodes) ||
    Array.isArray(item.episodios)
) {
    return true;
}

return false;


}

/* =========================================================
CATEGORÍAS
========================================================= */

function normalizeCategory(value) {


const text = normalizeText(value);

if (
    [
        "movie",
        "movies",
        "pelicula",
        "peliculas",
        "film",
        "films"
    ].includes(text)
) {
    return "pelicula";
}

if (
    [
        "tv",
        "show",
        "shows",
        "serie",
        "series",
        "tvshow",
        "tv show"
    ].includes(text)
) {
    return "serie";
}

if (
    [
        "horror",
        "terror"
    ].includes(text)
) {
    return "terror";
}

return text || "pelicula";


}

function getRealCategory(item) {


if (isSeriesContent(item)) {
    return "serie";
}

if (isTerrorContent(item)) {
    return "terror";
}

const raw =
    item?.category ??
    item?.categoria ??
    item?.type ??
    item?.tipo ??
    item?.contentType ??
    item?.content_type;

return normalizeCategory(raw) === "serie"
    ? "serie"
    : "pelicula";


}

function categoryLabel(category) {


if (category === "serie") {
    return "Serie";
}

if (category === "terror") {
    return "Terror";
}

return "Película";


}

function categoryBadge(category) {


return `
    <span class="badge badge-${escapeHtml(category)}">
        ${escapeHtml(categoryLabel(category))}
    </span>
`;


}

/* =========================================================
LOADING / TOAST
========================================================= */

function showLoading(text = "Cargando...") {


setText("loadingText", text);

if ($("loadingScreen")) {
    $("loadingScreen").style.display = "flex";
}


}

function hideLoading() {


if ($("loadingScreen")) {
    $("loadingScreen").style.display = "none";
}


}

function showToast(message, type = "success") {


const toast = $("toast");

if (!toast) {
    return;
}

toast.textContent = message || "";
toast.className = type;
toast.style.display = "block";

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {

    toast.style.display = "none";

}, 3500);


}

/* =========================================================
API
========================================================= */

async function api(endpoint, options = {}) {


const headers = {
    ...(options.headers || {})
};

if (
    !headers["Content-Type"] &&
    options.body !== undefined
) {
    headers["Content-Type"] = "application/json";
}

if (sessionId) {

    headers["X-Session-ID"] = sessionId;

    headers["Authorization"] =
        "Bearer " + sessionId;
}

let body = options.body;

if (
    body !== undefined &&
    typeof body === "string" &&
    headers["Content-Type"]?.includes("application/json")
) {

    try {

        const parsed = JSON.parse(body);

        if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed) &&
            !parsed.session_id
        ) {

            parsed.session_id = sessionId;

            body = JSON.stringify(parsed);
        }

    } catch (_) {}
}

const response = await fetch(
    API_URL + endpoint,
    {
        ...options,
        headers,
        body,
        cache: "no-store"
    }
);

let data = {};

try {
    data = await response.json();
} catch (_) {}

if (response.status === 401) {

    clearSession();

    showAccessDenied(
        "Tu sesión ya no está activa."
    );

    throw new Error(
        "Sesión expirada."
    );
}

if (response.status === 403) {

    throw new Error(
        data.error ||
        data.message ||
        "Acceso denegado."
    );
}

if (!response.ok) {

    throw new Error(
        data.error ||
        data.message ||
        "Error del servidor."
    );
}

return data;


}

/* =========================================================
SESIÓN
========================================================= */

function clearSession() {


localStorage.removeItem(
    SESSION_KEY
);

sessionId = "";
currentUser = null;


}

function showAccessDenied(message = "") {


if ($("adminApp")) {
    $("adminApp").style.display = "none";
}

if ($("app")) {
    $("app").style.display = "none";
}

if ($("accessDenied")) {
    $("accessDenied").style.display = "flex";
}

if ($("loginScreen")) {
    $("loginScreen").style.display = "none";
}

if (message) {
    setText("accessDeniedMessage", message);
}


}

function showLogin(message = "") {


/*
   Compatibilidad con el Admin2 antiguo.
   El HTML nuevo no tiene loginScreen,
   porque utiliza la sesión compartida.
*/

if ($("loginScreen")) {

    $("loginScreen").style.display =
        "flex";

    if ($("loginError")) {

        $("loginError").textContent =
            message;

        $("loginError").style.display =
            message ? "block" : "none";
    }
}

showAccessDenied(message);


}

function showApp() {


if ($("accessDenied")) {
    $("accessDenied").style.display =
        "none";
}

if ($("loginScreen")) {
    $("loginScreen").style.display =
        "none";
}

if ($("adminApp")) {
    $("adminApp").style.display =
        "flex";
}

if ($("app")) {
    $("app").style.display =
        "flex";
}

updateAdminInfo();


}

function updateAdminInfo() {


const name =
    currentUser?.name ||
    currentUser?.username ||
    "Administrador";

const email =
    currentUser?.email ||
    "";

setText(
    "adminName",
    name
);

setText(
    "adminEmail",
    email
);

setText(
    "topUsername",
    name
);

setText(
    "topEmail",
    email
);

setText(
    "sidebarUsername",
    name
);

setText(
    "sidebarEmail",
    email
);

setText(
    "sidebarAvatar",
    name.charAt(0).toUpperCase()
);


}

/* =========================================================
CHECK SESSION
========================================================= */

async function checkSession() {


if (!sessionId) {
    return false;
}

try {

    const result =
        await api(
            "/api/users/session/" +
            encodeURIComponent(sessionId)
        );

    if (
        !result?.success ||
        !result.active
    ) {
        return false;
    }

    if (
        String(
            result.user?.role ||
            "user"
        ).toLowerCase() !== "admin"
    ) {
        return false;
    }

    currentUser =
        result.user;

    return true;

} catch (error) {

    console.error(
        "CINEMAX ADMIN 2 SESSION:",
        error
    );

    return false;
}


}

/* =========================================================
LOGOUT
========================================================= */

async function logout() {


try {

    if (sessionId) {

        await api(
            "/api/users/logout",
            {
                method: "POST",
                body: JSON.stringify({
                    session_id: sessionId
                })
            }
        );
    }

} catch (error) {

    console.error(error);
}

clearSession();

showAccessDenied(
    "Sesión cerrada correctamente."
);


}

function logoutAdmin2() {
logout();
}

/* =========================================================
NAVEGACIÓN
========================================================= */

function showSection(section, button = null) {


document
    .querySelectorAll(".section")
    .forEach(
        el =>
            el.classList.remove("active")
    );

const target =
    $("section-" + section);

if (target) {
    target.classList.add("active");
}

document
    .querySelectorAll(
        ".nav-item, .nav-btn"
    )
    .forEach(
        el =>
            el.classList.remove("active")
    );

if (button) {

    button.classList.add("active");

} else {

    const nav =
        document.querySelector(
            `.nav-item[data-section="${CSS.escape(section)}"], .nav-btn[data-section="${CSS.escape(section)}"]`
        );

    if (nav) {
        nav.classList.add("active");
    }
}

if (section === "dashboard") {
    loadDashboard();
}

if (
    section === "analytics"
) {
    loadAnalytics();
}

if (
    section === "content" ||
    section === "series"
) {
    loadAdvancedContent();
}

if (section === "users") {
    loadUsers();
}

if (section === "activity") {
    loadActivity();
}

if (section === "episodes") {
    loadEpisodesSeries();
}

if (section === "trash") {
    loadTrash();
}


}

/* =========================================================
CARGA GENERAL
========================================================= */

async function loadAll() {


await Promise.all([
    loadCatalog(),
    loadUsers(),
    loadTrash(),
    loadAnalytics(),
    loadFavorites()
]);

updateStats();
renderDashboard();
renderCatalog();
renderSeriesLibrary();
loadEpisodesSeries();
renderActivity();


}

/* =========================================================
CATÁLOGO
========================================================= */

async function loadCatalog() {


try {

    const response =
        await api("/api/catalog");

    catalog =
        extractCatalogArray(response);

    console.log(
        "CINEMAX ADMIN 2: catálogo sincronizado:",
        catalog.length
    );

    console.log(
        "CINEMAX ADMIN 2: películas:",
        catalog.filter(
            item => !isSeriesContent(item)
        ).length
    );

    console.log(
        "CINEMAX ADMIN 2: series:",
        catalog.filter(
            item => isSeriesContent(item)
        ).length
    );

    renderCatalog();
    renderSeriesLibrary();
    loadEpisodesSeries();
    updateStats();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}


}

/* =========================================================
PAPELERA
========================================================= */

async function loadTrash() {


try {

    const response =
        await api("/api/trash");

    if (Array.isArray(response)) {

        trash = response;

    } else if (
        Array.isArray(response?.data)
    ) {

        trash = response.data;

    } else if (
        Array.isArray(response?.trash)
    ) {

        trash = response.trash;

    } else {

        trash = [];
    }

    renderTrash();
    updateStats();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}


}

/* =========================================================
USUARIOS
========================================================= */

async function loadUsers() {


try {

    const response =
        await api("/api/users");

    if (Array.isArray(response)) {

        users = response;

    } else if (
        Array.isArray(response?.data)
    ) {

        users = response.data;

    } else if (
        Array.isArray(response?.users)
    ) {

        users = response.users;

    } else {

        users = [];
    }

    renderUsers();
    updateStats();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}


}

/* =========================================================
FAVORITOS
========================================================= */

function extractFavoritesArray(response) {


if (!response) {
    return [];
}

if (Array.isArray(response)) {
    return response;
}

const keys = [
    "favorites",
    "data",
    "items",
    "results"
];

for (const key of keys) {

    if (Array.isArray(response[key])) {
        return response[key];
    }
}

if (
    response.data &&
    typeof response.data === "object"
) {

    for (const key of keys) {

        if (Array.isArray(response.data[key])) {
            return response.data[key];
        }
    }
}

return [];


}

async function loadFavorites() {


try {

    const response =
        await api(
            "/api/admin/favorites"
        );

    favoritesData =
        extractFavoritesArray(response);

    console.log(
        "CINEMAX ADMIN 2: favoritos sincronizados:",
        favoritesData.length
    );

    renderFavorites();
    updateFavoriteStats();

} catch (error) {

    console.error(
        "CINEMAX ADMIN 2 FAVORITOS:",
        error
    );

    favoritesData = [];

    updateFavoriteStats();

    /*
       No bloqueamos todo el panel si la ruta
       de favoritos no está disponible.
    */

    setText(
        "analyticsFavorites",
        "0"
    );
}


}

function getFavoriteUser(item) {


return (
    item.username ||
    item.user_name ||
    item.name ||
    item.user?.username ||
    item.user?.name ||
    "Usuario"
);


}

function getFavoriteEmail(item) {


return (
    item.email ||
    item.user_email ||
    item.user?.email ||
    "—"
);


}

function getFavoriteContentId(item) {


return String(
    item.content_id ??
    item.contentId ??
    item.catalog_id ??
    item.catalogId ??
    item.id ??
    ""
);


}

function getFavoriteTitle(item) {


const id =
    getFavoriteContentId(item);

const catalogItem =
    findCatalogItemById(id);

return (
    item.title ||
    item.content_title ||
    item.name ||
    catalogItem?.title ||
    catalogItem?.name ||
    "Contenido eliminado"
);


}

function getFavoriteType(item) {


const catalogItem =
    findCatalogItemById(
        getFavoriteContentId(item)
    );

if (
    isSeriesContent(item) ||
    isSeriesContent(catalogItem)
) {
    return "Serie";
}

return (
    item.type ||
    item.category ||
    catalogItem?.type ||
    catalogItem?.category ||
    "Película"
);


}

function getFavoriteSeason(item) {


return (
    item.season ??
    item.season_number ??
    item.seasonNumber ??
    "—"
);


}

function getFavoriteEpisode(item) {


return (
    item.episode ??
    item.episode_number ??
    item.episodeNumber ??
    "—"
);


}

function getDateParts(value) {


if (!value) {

    return {
        date: "—",
        time: "—"
    };
}

const date =
    new Date(value);

if (
    Number.isNaN(
        date.getTime()
    )
) {

    return {
        date: String(value),
        time: "—"
    };
}

return {

    date:
        date.toLocaleDateString(
            "es-CR",
            {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ),

    time:
        date.toLocaleTimeString(
            "es-CR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        )
};


}

function getFavoriteDate(item) {


return (
    item.created_at ||
    item.createdAt ||
    item.saved_at ||
    item.savedAt ||
    item.favorite_at ||
    item.favoriteAt ||
    item.date ||
    item.timestamp ||
    ""
);


}

function renderFavorites() {


/*
   El HTML actual no necesita un elemento especial.
   Creamos el panel detallado automáticamente dentro
   de Analíticas.
*/

const analyticsSection =
    $("analytics");

if (!analyticsSection) {
    return;
}

let panel =
    $("admin2FavoritesPanel");

if (!panel) {

    panel =
        document.createElement(
            "div"
        );

    panel.id =
        "admin2FavoritesPanel";

    panel.className =
        "panel admin2-favorites-panel";

    analyticsSection.appendChild(
        panel
    );
}

if (!favoritesData.length) {

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <h3>⭐ Favoritos guardados</h3>
                <p>No hay favoritos guardados todavía.</p>
            </div>

            <strong>
                0
            </strong>
        </div>
    `;

    return;
}

const rows =
    favoritesData
        .slice()
        .reverse()
        .map(item => {

            const title =
                getFavoriteTitle(item);

            const user =
                getFavoriteUser(item);

            const email =
                getFavoriteEmail(item);

            const type =
                getFavoriteType(item);

            const season =
                getFavoriteSeason(item);

            const episode =
                getFavoriteEpisode(item);

            const parts =
                getDateParts(
                    getFavoriteDate(item)
                );

            const id =
                getFavoriteContentId(item);

            const isSeries =
                String(type)
                    .toLowerCase()
                    .includes("serie");

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(user)}
                        </strong>
                        <small>
                            ${escapeHtml(email)}
                        </small>
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(title)}
                        </strong>

                        <small>
                            ID:
                            ${escapeHtml(id || "—")}
                        </small>
                    </td>

                    <td>
                        ${escapeHtml(type)}
                    </td>

                    <td>
                        ${
                            isSeries
                                ? escapeHtml(
                                    season === "—"
                                        ? "—"
                                        : "T" + season
                                )
                                : "—"
                        }
                    </td>

                    <td>
                        ${
                            isSeries
                                ? escapeHtml(
                                    episode === "—"
                                        ? "—"
                                        : "E" + episode
                                )
                                : "—"
                        }
                    </td>

                    <td>
                        ${escapeHtml(parts.date)}
                    </td>

                    <td>
                        ${escapeHtml(parts.time)}
                    </td>

                </tr>
            `;

        })
        .join("");

panel.innerHTML = `

    <div class="panel-header">

        <div>
            <h3>
                ⭐ Favoritos guardados
            </h3>

            <p>
                Favoritos almacenados en el
                servidor de CINEMAX.
            </p>
        </div>

        <div class="analytics-favorite-total">
            ${favoritesData.length}
        </div>

    </div>

    <div class="table-wrapper">

        <table class="data-table">

            <thead>

                <tr>
                    <th>Usuario</th>
                    <th>Contenido</th>
                    <th>Tipo</th>
                    <th>Temporada</th>
                    <th>Episodio</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                </tr>

            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>

    </div>
`;


}

function updateFavoriteStats() {


const total =
    favoritesData.length;

setText(
    "statFavorites",
    total
);

setText(
    "analyticsFavorites",
    total
);

setText(
    "favoriteCount",
    total
);

setText(
    "totalFavorites",
    total
);


}

/* =========================================================
ANALÍTICAS
========================================================= */

function extractAnalyticsArray(response) {


if (!response) {
    return [];
}

if (Array.isArray(response)) {
    return response;
}

if (Array.isArray(response.events)) {
    return response.events;
}

if (Array.isArray(response.analytics)) {
    return response.analytics;
}

if (Array.isArray(response.data)) {
    return response.data;
}

if (
    response.data &&
    typeof response.data === "object"
) {

    if (
        Array.isArray(
            response.data.events
        )
    ) {
        return response.data.events;
    }

    if (
        Array.isArray(
            response.data.analytics
        )
    ) {
        return response.data.analytics;
    }
}

return [];


}

async function loadAnalytics() {


try {

    const response =
        await api(
            "/api/analytics"
        );

    analyticsData =
        extractAnalyticsArray(response);

    analyticsSummary =
        response || {};

    console.log(
        "CINEMAX ADMIN 2: analíticas sincronizadas:",
        analyticsData.length
    );

    renderAnalytics();
    renderActivity();

} catch (error) {

    console.error(
        "CINEMAX ADMIN 2 ANALYTICS:",
        error
    );

    analyticsData = [];
    analyticsSummary = {};

    renderAnalytics();
}


}

function getAnalyticsUser(item) {


return (
    item.username ||
    item.user_name ||
    item.user?.username ||
    item.name ||
    "Usuario"
);


}

function getAnalyticsEmail(item) {


return (
    item.email ||
    item.user_email ||
    item.user?.email ||
    "—"
);


}

function getAnalyticsTitle(item) {


const id =
    String(
        item.content_id ??
        item.contentId ??
        item.id ??
        ""
    );

const catalogItem =
    findCatalogItemById(id);

return (
    item.title ||
    item.content_title ||
    item.name ||
    catalogItem?.title ||
    catalogItem?.name ||
    "Contenido"
);


}

function getAnalyticsType(item) {


const id =
    String(
        item.content_id ??
        item.contentId ??
        item.id ??
        ""
    );

const catalogItem =
    findCatalogItemById(id);

if (
    item.season !== undefined ||
    item.episode !== undefined
) {
    return "Serie";
}

if (
    isSeriesContent(item) ||
    isSeriesContent(catalogItem)
) {
    return "Serie";
}

return (
    item.type ||
    item.category ||
    catalogItem?.type ||
    "Película"
);


}

function getAnalyticsSeason(item) {


return (
    item.season ??
    item.season_number ??
    item.seasonNumber ??
    null
);


}

function getAnalyticsEpisode(item) {


return (
    item.episode ??
    item.episode_number ??
    item.episodeNumber ??
    null
);


}

function getAnalyticsDate(item) {


return (
    item.viewed_at ||
    item.viewedAt ||
    item.created_at ||
    item.createdAt ||
    item.timestamp ||
    item.date ||
    ""
);


}

function getAnalyticsContentId(item) {


return String(
    item.content_id ??
    item.contentId ??
    item.catalog_id ??
    item.catalogId ??
    item.id ??
    ""
);


}

function renderAnalytics() {


const totalViews =
    Number(
        analyticsSummary.total_views
    ) ||
    analyticsData.length;

const uniqueUsers =
    Number(
        analyticsSummary.unique_viewers
    ) ||
    new Set(
        analyticsData
            .map(
                item =>
                    item.user_id ||
                    item.userId ||
                    item.email ||
                    getAnalyticsUser(item)
            )
            .filter(Boolean)
    ).size;

const uniqueContent =
    Number(
        analyticsSummary.unique_content
    ) ||
    new Set(
        analyticsData
            .map(
                getAnalyticsContentId
            )
            .filter(Boolean)
    ).size;

setText(
    "analyticsViews",
    totalViews
);

setText(
    "analyticsUsers",
    uniqueUsers
);

setText(
    "analyticsContent",
    uniqueContent
);

updateFavoriteStats();

/*
   Tabla detallada de visualizaciones.
*/

const analyticsSection =
    $("analytics");

if (!analyticsSection) {
    return;
}

let panel =
    $("admin2AnalyticsDetails");

if (!panel) {

    panel =
        document.createElement(
            "div"
        );

    panel.id =
        "admin2AnalyticsDetails";

    panel.className =
        "panel admin2-analytics-details";

    analyticsSection.appendChild(
        panel
    );
}

if (!analyticsData.length) {

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <h3>📊 Visualizaciones</h3>
                <p>
                    Todavía no hay visualizaciones registradas.
                </p>
            </div>
        </div>
    `;

    return;
}

const rows =
    analyticsData
        .slice()
        .reverse()
        .map(item => {

            const parts =
                getDateParts(
                    getAnalyticsDate(item)
                );

            const season =
                getAnalyticsSeason(item);

            const episode =
                getAnalyticsEpisode(item);

            const title =
                getAnalyticsTitle(item);

            const type =
                getAnalyticsType(item);

            const contentId =
                getAnalyticsContentId(item);

            const user =
                getAnalyticsUser(item);

            const email =
                getAnalyticsEmail(item);

            return `
                <tr>

                    <td>
                        <strong>
                            ${escapeHtml(user)}
                        </strong>

                        <small>
                            ${escapeHtml(email)}
                        </small>
                    </td>

                    <td>
                        <strong>
                            ${escapeHtml(title)}
                        </strong>

                        <small>
                            ${escapeHtml(type)}
                        </small>
                    </td>

                    <td>
                        ${
                            season !== null
                                ? "T" +
                                  escapeHtml(season)
                                : "—"
                        }
                    </td>

                    <td>
                        ${
                            episode !== null
                                ? "E" +
                                  escapeHtml(episode)
                                : "—"
                        }
                    </td>

                    <td>
                        ${escapeHtml(parts.date)}
                    </td>

                    <td>
                        ${escapeHtml(parts.time)}
                    </td>

                    <td>
                        <code>
                            ${escapeHtml(
                                contentId ||
                                "—"
                            )}
                        </code>
                    </td>

                </tr>
            `;

        })
        .join("");

panel.innerHTML = `

    <div class="panel-header">

        <div>
            <h3>
                📊 Historial de visualizaciones
            </h3>

            <p>
                Registro real enviado por
                CINEMAX al servidor.
            </p>
        </div>

        <strong>
            ${analyticsData.length}
        </strong>

    </div>

    <div class="table-wrapper">

        <table class="data-table">

            <thead>

                <tr>
                    <th>Usuario</th>
                    <th>Contenido</th>
                    <th>Temporada</th>
                    <th>Episodio</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>ID</th>
                </tr>

            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>

    </div>
`;


}

/* =========================================================
ACTIVIDAD
========================================================= */

function renderActivity() {


const container =
    $("activityList") ||
    $("recentActivity");

if (!container) {
    return;
}

if (!analyticsData.length) {

    container.innerHTML = `
        <div class="empty">
            No hay actividad registrada todavía.
        </div>
    `;

    return;
}

const latest =
    analyticsData
        .slice()
        .reverse()
        .slice(0, 20);

container.innerHTML =
    latest.map(item => {

        const title =
            getAnalyticsTitle(item);

        const user =
            getAnalyticsUser(item);

        const date =
            getDateParts(
                getAnalyticsDate(item)
            );

        const season =
            getAnalyticsSeason(item);

        const episode =
            getAnalyticsEpisode(item);

        const episodeText =
            season !== null ||
            episode !== null
                ? ` · T${season ?? "—"} E${episode ?? "—"}`
                : "";

        return `
            <div class="activity-item">

                <div class="activity-icon">
                    ▶️
                </div>

                <div>

                    <strong>
                        ${escapeHtml(title)}
                    </strong>

                    <p>
                        ${escapeHtml(user)}
                        visualizó contenido
                        ${escapeHtml(
                            episodeText
                        )}
                    </p>

                    <small>
                        ${escapeHtml(date.date)}
                        ·
                        ${escapeHtml(date.time)}
                    </small>

                </div>

            </div>
        `;

    }).join("");


}

async function loadActivity() {
await loadAnalytics();
}

/* =========================================================
DASHBOARD
========================================================= */

function renderDashboard() {


const connected =
    users.filter(
        user =>
            user.connected === true
    ).length;

const container =
    $("recentActivity") ||
    $("dashboardRecent");

if (container) {

    const latest =
        analyticsData
            .slice()
            .reverse()
            .slice(0, 8);

    container.innerHTML = `

        <div class="panel dashboard-status">

            <h3>
                Estado de CINEMAX
            </h3>

            <p>
                El panel está conectado
                al mismo servidor que Admin1.
                Los datos de favoritos y
                visualizaciones se sincronizan
                automáticamente.
            </p>

        </div>

        <div class="dashboard-grid">

            <div class="panel">

                <span>
                    Contenido total
                </span>

                <strong>
                    ${catalog.length}
                </strong>

            </div>

            <div class="panel">

                <span>
                    En papelera
                </span>

                <strong>
                    ${trash.length}
                </strong>

            </div>

            <div class="panel">

                <span>
                    Usuarios conectados
                </span>

                <strong>
                    ${connected}
                </strong>

            </div>

            <div class="panel">

                <span>
                    Favoritos
                </span>

                <strong>
                    ${favoritesData.length}
                </strong>

            </div>

            <div class="panel">

                <span>
                    Visualizaciones
                </span>

                <strong>
                    ${analyticsData.length}
                </strong>

            </div>

        </div>

        ${
            latest.length
                ? `
                    <div class="panel">

                        <h3>
                            Actividad reciente
                        </h3>

                        ${latest.map(item => {

                            const date =
                                getDateParts(
                                    getAnalyticsDate(item)
                                );

                            return `
                                <div class="activity-item">

                                    <div>
                                        ▶️
                                    </div>

                                    <div>

                                        <strong>
                                            ${escapeHtml(
                                                getAnalyticsTitle(
                                                    item
                                                )
                                            )}
                                        </strong>

                                        <p>
                                            ${escapeHtml(
                                                getAnalyticsUser(
                                                    item
                                                )
                                            )}
                                        </p>

                                        <small>
                                            ${escapeHtml(
                                                date.date
                                            )}
                                            ·
                                            ${escapeHtml(
                                                date.time
                                            )}
                                        </small>

                                    </div>

                                </div>
                            `;

                        }).join("")}

                    </div>
                `
                : ""
        }
    `;
}


}

function loadDashboard() {


updateStats();
renderDashboard();


}

/* =========================================================
ESTADÍSTICAS
========================================================= */

function updateStats() {


const movies =
    catalog.filter(
        item =>
            !isSeriesContent(item)
    ).length;

const series =
    catalog.filter(
        item =>
            isSeriesContent(item)
    ).length;

const horror =
    catalog.filter(
        item =>
            isTerrorContent(item) &&
            !isSeriesContent(item)
    ).length;

setText(
    "statMovies",
    movies
);

setText(
    "statSeries",
    series
);

setText(
    "statTerror",
    horror
);

setText(
    "statHorror",
    horror
);

setText(
    "statUsers",
    users.length
);

updateFavoriteStats();

setText(
    "statViews",
    analyticsData.length
);

setText(
    "analyticsViews",
    analyticsData.length
);

setText(
    "analyticsUsers",
    new Set(
        analyticsData.map(
            item =>
                item.user_id ||
                item.userId ||
                item.email ||
                getAnalyticsUser(item)
        )
    ).size
);

setText(
    "analyticsContent",
    new Set(
        analyticsData
            .map(getAnalyticsContentId)
            .filter(Boolean)
    ).size
);

setText(
    "seriesCount",
    series
);

setText(
    "seriesTotal",
    series
);

setText(
    "totalSeries",
    series
);

console.log(
    "CINEMAX ADMIN 2 — ESTADÍSTICAS:",
    {
        peliculas: movies,
        series: series,
        terror: horror,
        usuarios: users.length,
        favoritos: favoritesData.length,
        visualizaciones:
            analyticsData.length,
        totalCatalogo:
            catalog.length
    }
);


}

/* =========================================================
CONTENIDO
========================================================= */

function getCatalogFilterMatch(
item,
filter
) {


if (
    !filter ||
    filter === "all"
) {
    return true;
}

if (filter === "serie") {
    return isSeriesContent(item);
}

if (filter === "terror") {

    return (
        isTerrorContent(item) &&
        !isSeriesContent(item)
    );
}

if (filter === "pelicula") {

    return !isSeriesContent(item);
}

return true;


}

function renderCatalog() {


const table =
    $("catalogTable");

const grid =
    $("contentGrid");

/*
   Si existe el sistema antiguo de tabla,
   lo mantenemos.
*/

if (table) {

    const search =
        getValue("catalogSearch")
            .trim()
            .toLowerCase();

    const filter =
        getValue("catalogFilter");

    const filtered =
        catalog.filter(item => {

            const title =
                String(
                    item.title ||
                    item.name ||
                    ""
                ).toLowerCase();

            const id =
                getContentId(item)
                    .toLowerCase();

            const genre =
                getAllGenres(item)
                    .join(" ");

            return (
                (
                    !search ||
                    title.includes(search) ||
                    id.includes(search) ||
                    genre.includes(search)
                ) &&
                getCatalogFilterMatch(
                    item,
                    filter
                )
            );
        });

    if (!filtered.length) {

        table.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty">
                        No hay contenido para mostrar.
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        filtered.map(item => {

            const id =
                getContentId(item);

            const title =
                escapeHtml(
                    item.title ||
                    item.name ||
                    "Sin título"
                );

            const category =
                getRealCategory(item);

            const year =
                escapeHtml(
                    item.year ||
                    item.releaseYear ||
                    "—"
                );

            return `
                <tr>

                    <td>
                        <strong>
                            ${title}
                        </strong>

                        <small>
                            ID: ${escapeHtml(id)}
                        </small>
                    </td>

                    <td>
                        ${categoryBadge(category)}
                    </td>

                    <td>
                        ${year}
                    </td>

                    <td>
                        ${escapeHtml(
                            getAllGenres(item)
                                .join(", ") ||
                            "Sin género"
                        )}
                    </td>

                    <td>

                        <div class="actions">

                            <button
                                class="btn btn-secondary btn-small"
                                onclick="editContent('${jsEscape(id)}')"
                            >
                                ✏️ Editar
                            </button>

                            ${
                                isSeriesContent(item)
                                    ? `
                                        <button
                                            class="btn btn-primary btn-small"
                                            onclick="manageEpisodes('${jsEscape(id)}')"
                                        >
                                            🎬 Episodios
                                        </button>
                                    `
                                    : ""
                            }

                            <button
                                class="btn btn-danger btn-small"
                                onclick="deleteContent('${jsEscape(id)}')"
                            >
                                🗑️
                            </button>

                        </div>

                    </td>

                </tr>
            `;

        }).join("");
}

/*
   Nuevo Admin2: tarjetas.
*/

if (grid) {

    const search =
        getValue("contentSearch")
            .trim()
            .toLowerCase();

    const category =
        getValue("contentCategory") ||
        "all";

    const filtered =
        catalog.filter(item => {

            const title =
                String(
                    item.title ||
                    item.name ||
                    ""
                ).toLowerCase();

            const id =
                getContentId(item)
                    .toLowerCase();

            const genres =
                getAllGenres(item)
                    .join(" ");

            let categoryMatch = true;

            if (
                category !== "all"
            ) {

                if (
                    category === "serie"
                ) {
                    categoryMatch =
                        isSeriesContent(item);
                }

                else if (
                    category === "pelicula"
                ) {
                    categoryMatch =
                        !isSeriesContent(item);
                }

                else if (
                    category === "terror"
                ) {
                    categoryMatch =
                        isTerrorContent(item);
                }
            }

            return (
                (
                    !search ||
                    title.includes(search) ||
                    id.includes(search) ||
                    genres.includes(search)
                ) &&
                categoryMatch
            );
        });

    setText(
        "contentCount",
        filtered.length
    );

    if (!filtered.length) {

        grid.innerHTML = `
            <div class="empty panel">
                No hay contenido para mostrar.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        filtered.map(item => {

            const id =
                getContentId(item);

            const title =
                escapeHtml(
                    item.title ||
                    item.name ||
                    "Sin título"
                );

            const image =
                escapeHtml(
                    item.image ||
                    item.poster ||
                    item.posterUrl ||
                    ""
                );

            const category =
                getRealCategory(item);

            return `
                <article
                    class="content-card"
                >

                    ${
                        image
                            ? `
                                <img
                                    src="${image}"
                                    alt="${title}"
                                    class="content-card-image"
                                    onerror="this.style.display='none'"
                                >
                            `
                            : `
                                <div class="content-card-image placeholder">
                                    🎬
                                </div>
                            `
                    }

                    <div class="content-card-body">

                        <span>
                            ${categoryBadge(category)}
                        </span>

                        <h3>
                            ${title}
                        </h3>

                        <p>
                            ${escapeHtml(
                                item.year ||
                                item.releaseYear ||
                                "—"
                            )}
                        </p>

                        <div class="actions">

                            <button
                                class="btn btn-secondary btn-small"
                                onclick="editContent('${jsEscape(id)}')"
                            >
                                ✏️
                            </button>

                            ${
                                isSeriesContent(item)
                                    ? `
                                        <button
                                            class="btn btn-primary btn-small"
                                            onclick="manageEpisodes('${jsEscape(id)}')"
                                        >
                                            🎬
                                        </button>
                                    `
                                    : ""
                            }

                            <button
                                class="btn btn-danger btn-small"
                                onclick="deleteContent('${jsEscape(id)}')"
                            >
                                🗑️
                            </button>

                        </div>

                    </div>

                </article>
            `;

        }).join("");
}


}

function loadAdvancedContent() {


renderCatalog();
renderSeriesLibrary();
loadEpisodesSeries();


}

/* =========================================================
SERIES
========================================================= */

function getSeriesFromCatalog() {


return catalog.filter(
    item =>
        isSeriesContent(item)
);


}

function getSeriesGenreMatch(
item,
selectedGenre
) {


if (
    !selectedGenre ||
    selectedGenre === "all" ||
    selectedGenre === "todos"
) {
    return true;
}

const genres =
    getAllGenres(item);

const target =
    normalizeText(
        selectedGenre
    );

return genres.some(
    genre =>
        genre === target ||
        genre.includes(target)
);


}

function renderSeriesLibrary() {


const series =
    getSeriesFromCatalog();

const searchElement =
    $("seriesSearch");

const genreElement =
    $("seriesGenre") ||
    $("seriesGenreFilter");

const search =
    searchElement
        ? String(
            searchElement.value || ""
          )
            .trim()
            .toLowerCase()
        : "";

const selectedGenre =
    genreElement
        ? genreElement.value
        : "all";

const filtered =
    series.filter(item => {

        const title =
            String(
                item.title ||
                item.name ||
                ""
            ).toLowerCase();

        const genres =
            getAllGenres(item)
                .join(" ");

        const id =
            getContentId(item)
                .toLowerCase();

        return (
            (
                !search ||
                title.includes(search) ||
                genres.includes(search) ||
                id.includes(search)
            ) &&
            getSeriesGenreMatch(
                item,
                selectedGenre
            )
        );
    });

setText(
    "seriesCount",
    filtered.length
);

const container =
    $("seriesGrid");

if (!container) {
    return;
}

if (!filtered.length) {

    container.innerHTML = `
        <div class="empty panel">
            <h3>No hay series disponibles</h3>
            <p>
                No se encontraron series
                en el catálogo.
            </p>
        </div>
    `;

    return;
}

container.innerHTML =
    filtered.map(series => {

        const id =
            getContentId(series);

        const title =
            escapeHtml(
                series.title ||
                series.name ||
                "Serie sin título"
            );

        const image =
            escapeHtml(
                series.image ||
                series.poster ||
                series.posterUrl ||
                ""
            );

        const seasons =
            Array.isArray(
                series.seasons
            )
                ? series.seasons
                : Array.isArray(
                    series.temporadas
                )
                    ? series.temporadas
                    : [];

        let episodeCount = 0;

        seasons.forEach(
            season => {

                const episodes =
                    Array.isArray(
                        season?.episodes
                    )
                        ? season.episodes
                        : Array.isArray(
                            season?.episodios
                        )
                            ? season.episodios
                            : [];

                episodeCount +=
                    episodes.length;
            }
        );

        return `
            <article
                class="series-card"
                data-series-id="${escapeHtml(id)}"
            >

                ${
                    image
                        ? `
                            <img
                                src="${image}"
                                alt="${title}"
                                onerror="this.style.display='none'"
                            >
                        `
                        : `
                            <div class="series-card-poster">
                                📺
                            </div>
                        `
                }

                <div class="series-card-body">

                    <h3>
                        ${title}
                    </h3>

                    <p>
                        ${seasons.length}
                        ${
                            seasons.length === 1
                                ? "temporada"
                                : "temporadas"
                        }
                        ·
                        ${episodeCount}
                        ${
                            episodeCount === 1
                                ? "episodio"
                                : "episodios"
                        }
                    </p>

                    <div class="actions">

                        <button
                            type="button"
                            class="btn btn-primary"
                            onclick="manageEpisodes('${jsEscape(id)}')"
                        >
                            🎬 Episodios
                        </button>

                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick="editContent('${jsEscape(id)}')"
                        >
                            ✏️ Editar
                        </button>

                    </div>

                </div>

            </article>
        `;

    }).join("");


}

/* =========================================================
EPISODIOS
========================================================= */

function loadEpisodesSeries() {


const container =
    $("episodesSeriesContainer");

if (!container) {
    return;
}

const search =
    getValue(
        "episodesSearch"
    )
        .trim()
        .toLowerCase();

const series =
    catalog
        .filter(
            item =>
                isSeriesContent(item)
        )
        .filter(item => {

            const title =
                String(
                    item.title ||
                    item.name ||
                    ""
                ).toLowerCase();

            return (
                !search ||
                title.includes(search) ||
                getContentId(item)
                    .toLowerCase()
                    .includes(search)
            );
        });

if (!series.length) {

    container.innerHTML = `
        <div class="empty panel">
            No hay series disponibles.
        </div>
    `;

    return;
}

container.innerHTML =
    series.map(series => {

        const seasons =
            Array.isArray(
                series.seasons
            )
                ? series.seasons
                : [];

        const episodeCount =
            seasons.reduce(
                (total, season) => {

                    return (
                        total +
                        (
                            Array.isArray(
                                season.episodes
                            )
                                ? season.episodes.length
                                : 0
                        )
                    );

                },
                0
            );

        return `
            <div class="series-card">

                <div class="series-card-body">

                    <h3>
                        ${escapeHtml(
                            series.title ||
                            series.name ||
                            "Serie"
                        )}
                    </h3>

                    <p>
                        ${seasons.length}
                        temporada(s)
                        ·
                        ${episodeCount}
                        episodio(s)
                    </p>

                    <button
                        class="btn btn-primary"
                        onclick="manageEpisodes('${jsEscape(getContentId(series))}')"
                    >
                        🎬 Administrar episodios
                    </button>

                </div>

            </div>
        `;

    }).join("");


}

function manageEpisodes(id) {


const series =
    findCatalogItemById(id);

if (!series) {

    showToast(
        "Serie no encontrada.",
        "error"
    );

    return;
}

if (!isSeriesContent(series)) {

    showToast(
        "Este contenido no es una serie.",
        "error"
    );

    return;
}

editingSeriesId =
    getContentId(series);

editingSeries =
    series;

editingSeasons =
    Array.isArray(series.seasons)
        ? JSON.parse(
            JSON.stringify(
                series.seasons
            )
        )
        : Array.isArray(
            series.temporadas
        )
            ? JSON.parse(
                JSON.stringify(
                    series.temporadas
                )
            )
            : [];

setText(
    "episodesSeriesTitle",
    series.title ||
    series.name ||
    "Serie"
);

renderSeasons();

$("episodesModal")
    ?.classList.add("show");


}

function renderSeasons() {


const container =
    $("seasonsContainer");

if (!container) {
    return;
}

if (!editingSeasons.length) {

    container.innerHTML = `
        <div class="empty panel">
            Esta serie todavía no tiene temporadas.
            <br><br>
            Pulsa "Nueva temporada".
        </div>
    `;

    return;
}

container.innerHTML =
    editingSeasons.map(
        (season, si) => {

            const number =
                Number(
                    season.number
                ) ||
                Number(
                    season.numero
                ) ||
                si + 1;

            const episodes =
                Array.isArray(
                    season.episodes
                )
                    ? season.episodes
                    : Array.isArray(
                        season.episodios
                    )
                        ? season.episodios
                        : [];

            return `
                <div class="season-panel">

                    <div class="season-header">

                        <div>

                            <h3>
                                Temporada ${number}
                            </h3>

                            <span>
                                ${episodes.length}
                                episodio(s)
                            </span>

                        </div>

                        <div class="actions">

                            <button
                                class="btn btn-primary btn-small"
                                onclick="addEpisode(${si})"
                            >
                                ➕ Episodio
                            </button>

                            <button
                                class="btn btn-danger btn-small"
                                onclick="removeSeason(${si})"
                            >
                                🗑️ Temporada
                            </button>

                        </div>

                    </div>

                    ${
                        episodes.length
                            ? episodes.map(
                                (ep, ei) => {

                                    const n =
                                        Number(
                                            ep.number
                                        ) ||
                                        Number(
                                            ep.numero
                                        ) ||
                                        ei + 1;

                                    return `
                                        <div class="episode-row">

                                            <div class="form-group">

                                                <label>
                                                    Episodio
                                                </label>

                                                <input
                                                    type="number"
                                                    min="1"
                                                    value="${n}"
                                                    onchange="updateEpisode(${si},${ei},'number',this.value)"
                                                >

                                            </div>

                                            <div class="form-group">

                                                <label>
                                                    Título
                                                </label>

                                                <input
                                                    value="${escapeHtml(
                                                        ep.title ||
                                                        ep.name ||
                                                        `Episodio ${n}`
                                                    )}"
                                                    onchange="updateEpisode(${si},${ei},'title',this.value)"
                                                >

                                            </div>

                                            <div class="form-group">

                                                <label>
                                                    URL del video
                                                </label>

                                                <input
                                                    value="${escapeHtml(
                                                        ep.video ||
                                                        ep.url ||
                                                        ep.videoUrl ||
                                                        ""
                                                    )}"
                                                    placeholder="https://..."
                                                    onchange="updateEpisode(${si},${ei},'video',this.value)"
                                                >

                                            </div>

                                            <div class="form-group">

                                                <label>
                                                    Thumbnail
                                                </label>

                                                <input
                                                    value="${escapeHtml(
                                                        ep.image ||
                                                        ep.thumbnail ||
                                                        ""
                                                    )}"
                                                    placeholder="https://..."
                                                    onchange="updateEpisode(${si},${ei},'image',this.value)"
                                                >

                                            </div>

                                            <button
                                                type="button"
                                                class="btn btn-danger btn-small"
                                                onclick="removeEpisode(${si},${ei})"
                                            >
                                                ❌
                                            </button>

                                        </div>
                                    `;
                                }
                            ).join("")
                            : `
                                <div class="empty">
                                    Esta temporada no tiene episodios.
                                </div>
                            `
                    }

                </div>
            `;
        }
    ).join("");


}

function addSeason() {


const next =
    editingSeasons.length
        ? Math.max(
            ...editingSeasons.map(
                season =>
                    Number(
                        season.number
                    ) || 0
            )
        ) + 1
        : 1;

editingSeasons.push({
    number: next,
    episodes: []
});

renderSeasons();


}

function removeSeason(index) {


const season =
    editingSeasons[index];

if (!season) {
    return;
}

if (
    !confirm(
        `¿Eliminar la Temporada ${
            season.number ||
            index + 1
        } y todos sus episodios?`
    )
) {
    return;
}

editingSeasons.splice(
    index,
    1
);

renderSeasons();


}

function addEpisode(seasonIndex) {


const season =
    editingSeasons[seasonIndex];

if (!season) {
    return;
}

if (
    !Array.isArray(
        season.episodes
    )
) {
    season.episodes = [];
}

const next =
    season.episodes.length
        ? Math.max(
            ...season.episodes.map(
                episode =>
                    Number(
                        episode.number
                    ) || 0
            )
        ) + 1
        : 1;

season.episodes.push({
    number: next,
    title:
        `Episodio ${next}`,
    video: "",
    image: ""
});

renderSeasons();


}

function updateEpisode(
seasonIndex,
episodeIndex,
field,
value
) {


const season =
    editingSeasons[
        seasonIndex
    ];

if (!season) {
    return;
}

const episode =
    season.episodes?.[
        episodeIndex
    ];

if (!episode) {
    return;
}

episode[field] =
    field === "number"
        ? Number(value) ||
          episodeIndex + 1
        : String(
            value || ""
        ).trim();


}

function removeEpisode(
seasonIndex,
episodeIndex
) {


const season =
    editingSeasons[
        seasonIndex
    ];

const episode =
    season?.episodes?.[
        episodeIndex
    ];

if (!episode) {
    return;
}

if (
    !confirm(
        `¿Eliminar "${
            episode.title ||
            "este episodio"
        }"?`
    )
) {
    return;
}

season.episodes.splice(
    episodeIndex,
    1
);

renderSeasons();


}

async function saveEpisodes() {


if (!editingSeriesId) {

    showToast(
        "No hay ninguna serie seleccionada.",
        "error"
    );

    return;
}

for (
    const season
    of editingSeasons
) {

    for (
        const episode
        of (
            Array.isArray(
                season.episodes
            )
                ? season.episodes
                : []
        )
    ) {

        if (
            !String(
                episode.video ||
                episode.url ||
                episode.videoUrl ||
                ""
            ).trim()
        ) {

            showToast(
                `La Temporada ${season.number} — Episodio ${episode.number} no tiene URL de video.`,
                "error"
            );

            return;
        }
    }
}

try {

    const updated = {
        ...editingSeries,
        seasons:
            JSON.parse(
                JSON.stringify(
                    editingSeasons
                )
            ),
        category: "serie",
        type: "serie"
    };

    await api(
        "/api/catalog/" +
        encodeURIComponent(
            editingSeriesId
        ),
        {
            method: "PUT",
            body:
                JSON.stringify(updated)
        }
    );

    showToast(
        "Temporadas y episodios guardados correctamente.",
        "success"
    );

    closeModal(
        "episodesModal"
    );

    editingSeriesId = null;
    editingSeries = null;
    editingSeasons = [];

    await loadCatalog();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}


}

/* =========================================================
CONTENIDO: AGREGAR / EDITAR
========================================================= */

function openAddModal() {


$("contentForm")?.reset();

setValue(
    "contentCategory",
    "pelicula"
);

$("addModal")
    ?.classList.add("show");


}

function openAdvancedContentAdd() {
openAddModal();
}

function closeContentModal() {
closeModal("contentModal");
closeModal("addModal");
}

function editContent(id) {


const item =
    findCatalogItemById(id);

if (!item) {

    showToast(
        "Contenido no encontrado.",
        "error"
    );

    return;
}

setValue(
    "editContentId",
    getContentId(item)
);

setValue(
    "editTitle",
    item.title ||
    item.name ||
    ""
);

setValue(
    "editCategory",
    isSeriesContent(item)
        ? "serie"
        : isTerrorContent(item)
            ? "terror"
            : "pelicula"
);

setValue(
    "editYear",
    item.year ||
    item.releaseYear ||
    ""
);

setValue(
    "editDuration",
    item.duration ||
    ""
);

setValue(
    "editImage",
    item.image ||
    item.poster ||
    item.posterUrl ||
    ""
);

setValue(
    "editVideo",
    item.video ||
    item.url ||
    item.videoUrl ||
    ""
);

setValue(
    "editGenre",
    Array.isArray(item.genre)
        ? item.genre.join(", ")
        : item.genre ||
          item.genero ||
          ""
);

setValue(
    "editRating",
    item.rating ||
    ""
);

if ($("editFeatured")) {

    $("editFeatured").checked =
        item.featured === true;
}

setValue(
    "editDescription",
    item.description ||
    ""
);

$("contentModal")
    ?.classList.add("show");
```

}

function collectContentForm(prefix) {

```
return {

    title:
        getValue(
            prefix + "Title"
        ).trim(),

    category:
        getValue(
            prefix + "Category"
        ) || "pelicula",

    year:
        getValue(
            prefix + "Year"
        ).trim(),

    duration:
        getValue(
            prefix + "Duration"
        ).trim(),

    image:
        getValue(
            prefix + "Image"
        ).trim(),

    video:
        getValue(
            prefix + "Video"
        ).trim(),

    genre:
        getValue(
            prefix + "Genre"
        ).trim(),

    rating:
        getValue(
            prefix + "Rating"
        ).trim(),

    featured:
        $(
            prefix + "Featured"
        )?.checked === true,

    description:
        getValue(
            prefix + "Description"
        ).trim()
};
```

}

async function saveContent(event) {

```
event.preventDefault();

const item =
    collectContentForm(
        "content"
    );

if (!item.title) {

    showToast(
        "El título es obligatorio.",
        "error"
    );

    return;
}

if (
    item.category === "serie"
) {

    item.type = "serie";
    item.category = "serie";

} else {

    item.type = "pelicula";
}

if (
    item.category === "terror"
) {

    item.genre =
        item.genre ||
        "Terror";

    item.terror = true;
}

try {

    await api(
        "/api/catalog",
        {
            method: "POST",
            body:
                JSON.stringify(item)
        }
    );

    closeModal("addModal");

    showToast(
        "Contenido agregado correctamente.",
        "success"
    );

    await loadCatalog();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}
```

}

async function updateContent(event) {

```
event.preventDefault();

const id =
    getValue(
        "editContentId"
    );

const original =
    findCatalogItemById(id);

if (!original) {

    showToast(
        "Contenido no encontrado.",
        "error"
    );

    return;
}

const updated = {
    ...original,
    ...collectContentForm(
        "edit"
    )
};

const category =
    getValue(
        "editCategory"
    );

if (
    category === "serie"
) {

    updated.type = "serie";
    updated.category = "serie";

} else {

    updated.type = "pelicula";

    updated.category =
        category === "terror"
            ? original.category
            : "pelicula";
}

if (
    category === "terror"
) {

    updated.terror = true;

    updated.genre =
        updated.genre ||
        "Terror";

} else if (
    updated.terror !== undefined
) {

    delete updated.terror;
}

try {

    await api(
        "/api/catalog/" +
        encodeURIComponent(id),
        {
            method: "PUT",
            body:
                JSON.stringify(
                    updated
                )
        }
    );

    closeModal(
        "contentModal"
    );

    showToast(
        "Contenido actualizado.",
        "success"
    );

    await loadCatalog();

} catch (error) {

    console.error(error);

    showToast(
        error.message,
        "error"
    );
}
```

}

async function deleteContent(id) {

```
const item =
    findCatalogItemById(id);

const title =
    item?.title ||
    item?.name ||
    id;

if (
    !confirm(
        `¿Enviar "${title}" a la papelera?`
    )
) {
    return;
}

try {

    await api(
        "/api/catalog/" +
        encodeURIComponent(
            getContentId(item) ||
            id
        ),
        {
            method: "DELETE",
            body:
                JSON.stringify({})
        }
    );

    showToast(
        "Contenido enviado a la papelera.",
        "success"
    );

    await loadCatalog();
    await loadTrash();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}
```

}

/* =========================================================
PAPELERA
========================================================= */

function renderTrash() {

```
const table =
    $("trashTable");

if (!table) {
    return;
}

if (!trash.length) {

    table.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="empty">
                    La papelera está vacía.
                </div>
            </td>
        </tr>
    `;

    return;
}

table.innerHTML =
    trash.map(item => {

        const id =
            getContentId(item);

        const title =
            escapeHtml(
                item.title ||
                item.name ||
                "Sin título"
            );

        const category =
            getRealCategory(item);

        return `
            <tr>

                <td>
                    <strong>
                        ${title}
                    </strong>
                </td>

                <td>
                    ${categoryBadge(category)}
                </td>

                <td>
                    <code>
                        ${escapeHtml(id)}
                    </code>
                </td>

                <td>

                    <div class="actions">

                        <button
                            class="btn btn-success btn-small"
                            onclick="restoreContent('${jsEscape(id)}')"
                        >
                            ♻️ Restaurar
                        </button>

                        <button
                            class="btn btn-danger btn-small"
                            onclick="permanentDelete('${jsEscape(id)}')"
                        >
                            ❌ Eliminar
                        </button>

                    </div>

                </td>

            </tr>
        `;

    }).join("");
```

}

async function restoreContent(id) {

```
const item =
    trash.find(
        e =>
            getContentId(e) ===
            String(id)
    );

const title =
    item?.title ||
    item?.name ||
    id;

if (
    !confirm(
        `¿Restaurar "${title}"?`
    )
) {
    return;
}

try {

    await api(
        "/api/trash/" +
        encodeURIComponent(id) +
        "/restore",
        {
            method: "POST",
            body:
                JSON.stringify({})
        }
    );

    showToast(
        "Contenido restaurado.",
        "success"
    );

    await loadCatalog();
    await loadTrash();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}
```

}

async function permanentDelete(id) {

```
const item =
    trash.find(
        e =>
            getContentId(e) ===
            String(id)
    );

const title =
    item?.title ||
    item?.name ||
    id;

if (
    !confirm(
        `⚠️ ¿Eliminar DEFINITIVAMENTE "${title}"?\n\nEsta acción no se puede deshacer.`
    )
) {
    return;
}

try {

    await api(
        "/api/trash/" +
        encodeURIComponent(id),
        {
            method: "DELETE",
            body:
                JSON.stringify({})
        }
    );

    showToast(
        "Contenido eliminado definitivamente.",
        "success"
    );

    await loadTrash();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}
```

}

/* =========================================================
USUARIOS
========================================================= */

function renderUsers() {

```
const table =
    $("usersTable");

if (!table) {
    return;
}

const search =
    getValue("userSearch")
        .trim()
        .toLowerCase();

const filtered =
    users.filter(user => {

        const username =
            String(
                user.username ||
                user.name ||
                ""
            ).toLowerCase();

        const email =
            String(
                user.email ||
                ""
            ).toLowerCase();

        return (
            !search ||
            username.includes(search) ||
            email.includes(search)
        );
    });

if (!filtered.length) {

    table.innerHTML = `
        <tr>
            <td colspan="4">
                <div class="empty">
                    No hay usuarios.
                </div>
            </td>
        </tr>
    `;

    return;
}

table.innerHTML =
    filtered.map(user => {

        const id =
            jsEscape(
                user.id
            );

        const connected =
            user.connected === true;

        return `
            <tr>

                <td>
                    <strong>
                        ${escapeHtml(
                            user.username ||
                            user.name ||
                            "Sin usuario"
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        user.email || ""
                    )}
                </td>

                <td>

                    ${
                        connected
                            ? `
                                <span class="badge badge-online">
                                    ● Conectado
                                </span>
                            `
                            : `
                                <span class="badge badge-offline">
                                    ● Desconectado
                                </span>
                            `
                    }

                </td>

                <td>

                    <div class="actions">

                        <button
                            class="btn btn-secondary btn-small"
                            onclick="editUser('${id}')"
                        >
                            ✏️
                        </button>

                        ${
                            connected
                                ? `
                                    <button
                                        class="btn btn-warning btn-small"
                                        onclick="disconnectUser('${id}')"
                                    >
                                        🔌
                                    </button>
                                `
                                : ""
                        }

                        <button
                            class="btn btn-danger btn-small"
                            onclick="deleteUser('${id}')"
                        >
                            🗑️
                        </button>

                    </div>

                </td>

            </tr>
        `;

    }).join("");


}

function editUser(id) {


const user =
    users.find(
        e =>
            String(e.id) ===
            String(id)
    );

if (!user) {

    showToast(
        "Usuario no encontrado.",
        "error"
    );

    return;
}

setValue(
    "editUserId",
    user.id
);

setValue(
    "editUsername",
    user.username || ""
);

setValue(
    "editEmail",
    user.email || ""
);

setValue(
    "editPassword",
    ""
);

setValue(
    "editRole",
    user.role || "user"
);

$("userModal")
    ?.classList.add("show");


}

async function updateUser(event) {


event.preventDefault();

const id =
    getValue(
        "editUserId"
    );

const data = {

    username:
        getValue(
            "editUsername"
        ).trim(),

    email:
        getValue(
            "editEmail"
        ).trim(),

    role:
        getValue(
            "editRole"
        )
};

const password =
    getValue(
        "editPassword"
    );

if (password) {
    data.password =
        password;
}

try {

    await api(
        "/api/users/" +
        encodeURIComponent(id),
        {
            method: "PUT",
            body:
                JSON.stringify(data)
        }
    );

    closeModal(
        "userModal"
    );

    showToast(
        "Usuario actualizado.",
        "success"
    );

    await loadUsers();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}


}

async function disconnectUser(id) {


const user =
    users.find(
        e =>
            String(e.id) ===
            String(id)
    );

if (!user) {
    return;
}

if (
    !confirm(
        `¿Desconectar a ${user.username}?`
    )
) {
    return;
}

try {

    await api(
        "/api/users/" +
        encodeURIComponent(id) +
        "/disconnect",
        {
            method: "POST",
            body:
                JSON.stringify({})
        }
    );

    showToast(
        "Usuario desconectado.",
        "success"
    );

    await loadUsers();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}


}

async function deleteUser(id) {


const user =
    users.find(
        e =>
            String(e.id) ===
            String(id)
    );

if (!user) {
    return;
}

if (
    !confirm(
        `⚠️ ¿Eliminar la cuenta de ${user.username}?\n\nTambién se cerrarán sus sesiones.`
    )
) {
    return;
}

try {

    await api(
        "/api/users/" +
        encodeURIComponent(id),
        {
            method: "DELETE",
            body:
                JSON.stringify({})
        }
    );

    showToast(
        "Usuario eliminado.",
        "success"
    );

    await loadUsers();
    await loadFavorites();

} catch (error) {

    showToast(
        error.message,
        "error"
    );
}


}

/* =========================================================
MODALES
========================================================= */

function closeModal(id) {


const modal =
    $(id);

if (modal) {
    modal.classList.remove(
        "show"
    );
}


}

/* =========================================================
SERVER STATUS
========================================================= */

async function checkServerStatus() {


try {

    const response =
        await fetch(
            API_URL +
            "/api/catalog",
            {
                cache: "no-store"
            }
        );

    if (!response.ok) {
        throw new Error();
    }

    setText(
        "statusText",
        "Servidor conectado"
    );

    if ($("statusDot")) {
        $("statusDot")
            .classList.add("online");
    }

} catch (_) {

    setText(
        "statusText",
        "Servidor desconectado"
    );

    if ($("statusDot")) {

        $("statusDot")
            .classList.remove(
                "online"
            );
    }
}


}

/* =========================================================
REFRESH ADMIN
========================================================= */

async function refreshAdminData() {


await syncAll();

showToast(
    "Datos actualizados.",
    "success"
);


}

/* =========================================================
SINCRONIZACIÓN
========================================================= */

async function syncAll() {


if (!sessionId) {
    return;
}

try {

    await Promise.all([
        loadCatalog(),
        loadUsers(),
        loadTrash(),
        loadAnalytics(),
        loadFavorites()
    ]);

    updateStats();
    renderDashboard();
    renderActivity();

    console.log(
        "CINEMAX ADMIN 2: datos sincronizados con Admin1"
    );

} catch (error) {

    console.error(
        "CINEMAX ADMIN 2 SYNC:",
        error
    );
}


}

/* =========================================================
EVENTOS
========================================================= */

document.addEventListener(
"DOMContentLoaded",
() => {


    $("loginForm")
        ?.addEventListener(
            "submit",
            handleLogin
        );

    $("editContentForm")
        ?.addEventListener(
            "submit",
            updateContent
        );

    $("contentForm")
        ?.addEventListener(
            "submit",
            saveContent
        );

    $("userForm")
        ?.addEventListener(
            "submit",
            updateUser
        );

    $("catalogSearch")
        ?.addEventListener(
            "input",
            renderCatalog
        );

    $("catalogFilter")
        ?.addEventListener(
            "change",
            renderCatalog
        );

    $("contentSearch")
        ?.addEventListener(
            "input",
            renderCatalog
        );

    $("contentCategory")
        ?.addEventListener(
            "change",
            renderCatalog
        );

    $("episodesSearch")
        ?.addEventListener(
            "input",
            loadEpisodesSeries
        );

    $("userSearch")
        ?.addEventListener(
            "input",
            renderUsers
        );

    $("seriesSearch")
        ?.addEventListener(
            "input",
            renderSeriesLibrary
        );

    $("seriesGenre")
        ?.addEventListener(
            "change",
            renderSeriesLibrary
        );

    $("seriesGenreFilter")
        ?.addEventListener(
            "change",
            renderSeriesLibrary
        );

    document
        .querySelectorAll(".modal")
        .forEach(
            modal => {

                modal.addEventListener(
                    "click",
                    event => {

                        if (
                            event.target ===
                            modal
                        ) {

                            modal.classList.remove(
                                "show"
                            );
                        }
                    }
                );
            }
        );

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                document
                    .querySelectorAll(
                        ".modal.show"
                    )
                    .forEach(
                        modal =>
                            modal.classList.remove(
                                "show"
                            )
                    );
            }
        }
    );

    (async () => {

        showLoading(
            "Verificando sesión..."
        );

        const valid =
            await checkSession();

        if (valid) {

            showApp();

            await loadAll();

            await checkServerStatus();

        } else {

            clearSession();

            showAccessDenied(
                "Necesitas una sesión de administrador para acceder."
            );
        }

        hideLoading();

    })();
}


);

/* =========================================================
VIGILANCIA DE SESIÓN
========================================================= */

setInterval(
async () => {


    if (!sessionId) {
        return;
    }

    try {

        const response =
            await fetch(
                API_URL +
                "/api/users/session/" +
                encodeURIComponent(
                    sessionId
                ),
                {
                    headers: {
                        "Content-Type":
                            "application/json",

                        "X-Session-ID":
                            sessionId,

                        "Authorization":
                            "Bearer " +
                            sessionId
                    },

                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        if (
            !data.success ||
            !data.active ||
            String(
                data.user?.role ||
                "user"
            ).toLowerCase() !==
                "admin"
        ) {

            clearSession();

            showAccessDenied(
                "Tu sesión de administrador ya no está activa."
            );

        } else {

            currentUser =
                data.user;

            updateAdminInfo();
        }

    } catch (_) {}

},
5000


);

/* =========================================================
AUTO SYNC
========================================================= */

setInterval(
syncAll,
30000
);
