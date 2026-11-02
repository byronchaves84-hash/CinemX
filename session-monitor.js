
/* ============================================================
   CINEMAX - SESSION MONITOR
   Protección de sesión y prevención de desconexiones falsas
   ============================================================ */

(function () {
    "use strict";

    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const SESSION_KEY = "cinemax_session_id";
    const USER_KEY = "cinemax_current_user";

    // Comprobar cada 30 segundos.
    const CHECK_INTERVAL = 30000;

    // Respuestas inválidas consecutivas necesarias.
    const MAX_INVALID_CHECKS = 3;

    // Tiempo máximo de espera del servidor.
    const REQUEST_TIMEOUT = 10000;

    const LOGIN_PAGE = "/login.html";

    const EXCLUDED_PAGES = [
        "admin2.html",
        "admin.html",
        "login.html"
    ];

    let checkingSession = false;
    let redirecting = false;
    let invalidSessionChecks = 0;
    let monitorStarted = false;
    let monitorTimer = null;

    // Evita aplicar respuestas de una sesión anterior.
    let sessionGeneration = 0;

    /* ========================================================
       OBTENER SESIÓN
       ======================================================== */

    function getSessionId() {
        try {
            return localStorage.getItem(SESSION_KEY);
        } catch (error) {
            console.error("CINEMAX: no se pudo leer la sesión.", error);
            return null;
        }
    }

    /* ========================================================
       OBTENER PÁGINA ACTUAL
       ======================================================== */

    function getCurrentPage() {
        return window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();
    }

    function isExcludedPage() {
        return EXCLUDED_PAGES.includes(getCurrentPage());
    }

    /* ========================================================
       LIMPIAR SESIÓN LOCAL
       ======================================================== */

    function clearLocalSession() {
        try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(SESSION_KEY);

            sessionGeneration++;
            invalidSessionChecks = 0;

        } catch (error) {
            console.error(
                "CINEMAX: error limpiando sesión.",
                error
            );
        }
    }

    /* ========================================================
       REINICIAR CONTADOR
       ======================================================== */

    function resetInvalidChecks() {
        if (invalidSessionChecks > 0) {
            console.log(
                "CINEMAX: sesión recuperada."
            );
        }

        invalidSessionChecks = 0;
    }

    /* ========================================================
       FORZAR CIERRE DE SESIÓN
       ======================================================== */

    function forceLogout(reason) {

        if (isExcludedPage()) {
            console.log(
                "CINEMAX: página excluida:",
                getCurrentPage()
            );
            return;
        }

        if (redirecting) {
            return;
        }

        redirecting = true;

        console.warn(
            "CINEMAX: sesión cerrada.",
            reason || ""
        );

        clearLocalSession();

        if (getCurrentPage() !== "login.html") {
            window.location.replace(LOGIN_PAGE);
        }
    }

    /* ========================================================
       REGISTRAR RESPUESTA INVÁLIDA
       ======================================================== */

    function registerInvalidSession(reason) {

        invalidSessionChecks++;

        console.warn(
            "CINEMAX: sesión inválida:",
            invalidSessionChecks + "/" + MAX_INVALID_CHECKS,
            reason || ""
        );

        if (invalidSessionChecks >= MAX_INVALID_CHECKS) {
            forceLogout(
                reason || "El servidor confirmó que la sesión no está activa."
            );
        }
    }

    /* ========================================================
       COMPROBAR SESIÓN CONTRA EL SERVIDOR
       ======================================================== */

    async function checkSession() {

        if (isExcludedPage()) {
            return;
        }

        if (checkingSession || redirecting) {
            return;
        }

        const sessionId = getSessionId();

        // Si no existe sesión local, no inventamos una.
        if (!sessionId) {
            return;
        }

        const currentGeneration = sessionGeneration;

        checkingSession = true;

        const controller = new AbortController();

        const timeout = setTimeout(function () {
            controller.abort();
        }, REQUEST_TIMEOUT);

        try {

            const response = await fetch(
                "/api/users/session/" +
                encodeURIComponent(sessionId),

                {
                    method: "GET",

                    headers: {
                        "X-Session-ID": sessionId
                    },

                    credentials: "include",

                    cache: "no-store",

                    signal: controller.signal
                }
            );

            // La sesión pudo cambiar mientras esperábamos.
            if (
                currentGeneration !== sessionGeneration ||
                getSessionId() !== sessionId
            ) {
                return;
            }

            /* ================================================
               SESIÓN NO AUTORIZADA
               ================================================ */

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                registerInvalidSession(
                    "HTTP " + response.status
                );

                return;
            }

            /* ================================================
               RESPUESTA CORRECTA
               ================================================ */

            if (response.ok) {

                let data;

                try {
                    data = await response.json();
                } catch (error) {

                    console.warn(
                        "CINEMAX: respuesta JSON inválida. No se desconecta."
                    );

                    return;
                }

                // Comprobar nuevamente que seguimos usando la misma sesión.
                if (
                    currentGeneration !== sessionGeneration ||
                    getSessionId() !== sessionId
                ) {
                    return;
                }

                /*
                 * El servidor confirmó explícitamente
                 * que la sesión está inactiva.
                 */

                if (data && data.active === false) {

                    registerInvalidSession(
                        data.error ||
                        data.code ||
                        "Sesión inactiva."
                    );

                    return;
                }

                /*
                 * Sesión confirmada como válida.
                 */

                if (
                    data &&
                    data.success === true &&
                    data.active === true
                ) {

                    resetInvalidChecks();

                    console.log(
                        "CINEMAX: sesión válida."
                    );

                    return;
                }

                /*
                 * Respuesta inesperada:
                 * nunca expulsar por falta de campos.
                 */

                console.warn(
                    "CINEMAX: respuesta inesperada. Se mantiene la sesión.",
                    data
                );

                return;
            }

            /* ================================================
               OTROS ERRORES HTTP
               ================================================ */

            console.warn(
                "CINEMAX: error HTTP temporal:",
                response.status,
                "No se desconecta al usuario."
            );

        } catch (error) {

            /*
             * Errores de red y timeout no son
             * confirmación de sesión cerrada.
             */

            if (error.name === "AbortError") {

                console.warn(
                    "CINEMAX: tiempo de espera agotado. Se mantiene la sesión."
                );

            } else {

                console.warn(
                    "CINEMAX: error de conexión. Se mantiene la sesión.",
                    error
                );
            }

        } finally {

            clearTimeout(timeout);
            checkingSession = false;
        }
    }

    /* ========================================================
       DETECTAR CAMBIO DE SESIÓN
       ======================================================== */

    window.addEventListener("storage", function (event) {

        if (event.key === SESSION_KEY) {

            sessionGeneration++;
            invalidSessionChecks = 0;

            console.log(
                "CINEMAX: cambio de sesión detectado."
            );
        }
    });

    /* ========================================================
       CONTROL DE VISIBILIDAD
       ======================================================== */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (
                document.visibilityState === "visible" &&
                !isExcludedPage()
            ) {
                checkSession();
            }
        }
    );

    /* ========================================================
       INICIAR MONITOR
       ======================================================== */

    function startSessionMonitor() {

        if (monitorStarted || isExcludedPage()) {
            return;
        }

        monitorStarted = true;

        console.log(
            "CINEMAX: monitor de sesión iniciado."
        );

        // Primera comprobación.
        checkSession();

        // Comprobaciones periódicas.
        monitorTimer = setInterval(
            checkSession,
            CHECK_INTERVAL
        );
    }

    /* ========================================================
       API GLOBAL
       ======================================================== */

    window.CinemaXSessionMonitor = {

        check: checkSession,

        logout: forceLogout,

        clear: clearLocalSession,

        reset: resetInvalidChecks,

        getSessionId: getSessionId,

        stop: function () {

            if (monitorTimer !== null) {
                clearInterval(monitorTimer);
                monitorTimer = null;
            }

            monitorStarted = false;

            console.log(
                "CINEMAX: monitor detenido."
            );
        },

        start: startSessionMonitor
    };

    /* ========================================================
       ARRANQUE
       ======================================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            startSessionMonitor,
            { once: true }
        );

    } else {

        startSessionMonitor();
    }

})();
