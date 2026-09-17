/* ============================================================
CINEMAX - SESSION MONITOR
Desconexión global de usuarios
============================================================ */

(function () {

"use strict";


/* ========================================================
   CONFIGURACIÓN
   ======================================================== */

const SESSION_KEY =
    "cinemax_session_id";

const USER_KEY =
    "cinemax_current_user";

const CHECK_INTERVAL =
    5000;

/*
 * Login principal del sistema.
 * Usamos ruta absoluta para que funcione
 * aunque la página esté dentro de carpetas.
 */
const LOGIN_PAGE =
    "/login.html";


/*
 * ========================================================
   PÁGINAS QUE NUNCA DEBEN SER EXPULSADAS
   ========================================================
   
   Admin2 es el panel administrativo.
   El monitor puede estar cargado accidentalmente
   en esta página, pero JAMÁS debe cerrar Admin2.
*/

const EXCLUDED_PAGES = [
    "admin2.html",
    "admin.html",
    "login.html"
];


let checkingSession = false;

let redirecting = false;


/* ========================================================
   OBTENER ID DE SESIÓN
   ======================================================== */

function getSessionId() {

    return localStorage.getItem(
        SESSION_KEY
    );

}


/* ========================================================
   LIMPIAR SESIÓN LOCAL
   ======================================================== */

function clearLocalSession() {

    try {

        localStorage.removeItem(
            SESSION_KEY
        );

        localStorage.removeItem(
            USER_KEY
        );

        sessionStorage.removeItem(
            SESSION_KEY
        );

    } catch (error) {

        console.error(
            "CINEMAX: error limpiando sesión local.",
            error
        );

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


/* ========================================================
   COMPROBAR SI LA PÁGINA ESTÁ EXCLUIDA
   ======================================================== */

function isExcludedPage() {

    const currentPage =
        getCurrentPage();

    return EXCLUDED_PAGES.includes(
        currentPage
    );

}


/* ========================================================
   FORZAR LOGOUT
   ======================================================== */

function forceLogout(
    reason
) {

    /*
     * SEGURIDAD:
     *
     * Admin2 y las demás páginas excluidas
     * jamás serán redirigidas por este monitor.
     */

    if (
        isExcludedPage()
    ) {

        console.log(
            "🛡️ CINEMAX: página excluida del monitor:",
            getCurrentPage()
        );

        return;

    }


    if (redirecting) {

        return;

    }


    redirecting = true;


    console.warn(
        "🔌 CINEMAX: sesión desconectada.",
        reason || ""
    );


    clearLocalSession();


    /*
     * Si ya estamos en login.html,
     * no hacemos otra redirección.
     */

    if (
        getCurrentPage() ===
        "login.html"
    ) {

        return;

    }


    /*
     * Redirección al login.
     */

    window.location.href =
        LOGIN_PAGE;

}


/* ========================================================
   COMPROBAR SESIÓN CONTRA EL SERVIDOR
   ======================================================== */

async function checkSession() {


    /*
     * ====================================================
       MUY IMPORTANTE
       ====================================================
       
       Si estamos en Admin2, NO hacemos ninguna
       comprobación de sesión.

       Esto evita que Admin2 se cierre cuando
       administra/desconecta a otros usuarios.
     */

    if (
        isExcludedPage()
    ) {

        return;

    }


    if (
        checkingSession
    ) {

        return;

    }


    const sessionId =
        getSessionId();


    /*
     * No hay sesión.
     */

    if (!sessionId) {

        return;

    }


    /*
     * No comprobamos desde el login.
     */

    if (
        getCurrentPage() ===
        "login.html"
    ) {

        return;

    }


    checkingSession = true;


    try {


        /*
         * El servidor ya tiene este endpoint:
         *
         * /api/users/session/<session_id>
         */

        const response =
            await fetch(

                "/api/users/session/" +
                encodeURIComponent(
                    sessionId
                ),

                {

                    method:
                        "GET",

                    headers: {

                        "X-Session-ID":
                            sessionId

                    },

                    credentials:
                        "include",

                    cache:
                        "no-store"

                }

            );


        /* =================================================
           SESIÓN NO VÁLIDA
           ================================================= */

        if (
            response.status ===
                401 ||
            response.status ===
                403
        ) {


            let data = null;


            try {

                data =
                    await response.json();

            } catch (
                jsonError
            ) {

                data = null;

            }


            forceLogout(

                data?.error ||
                data?.code ||
                "El servidor invalidó la sesión."

            );


            return;

        }


        /* =================================================
           RESPUESTA DEL SERVIDOR
           ================================================= */

        if (
            response.ok
        ) {


            let data = null;


            try {

                data =
                    await response.json();

            } catch (
                jsonError
            ) {

                data = null;

            }


            /*
             * Aunque HTTP sea 200,
             * comprobamos igualmente
             * el campo active.
             */

            if (
                data &&
                data.active === false
            ) {


                forceLogout(

                    data.error ||
                    data.code ||
                    "La sesión ya no está activa."

                );


                return;

            }


            /*
             * Sesión válida.
             */

            if (
                data &&
                data.success === true &&
                data.active === true
            ) {

                return;

            }

        }


    } catch (error) {


        /*
         * MUY IMPORTANTE:
         *
         * Si el servidor está apagado,
         * hay un problema de red,
         * o temporalmente no responde,
         * NO expulsamos al usuario.
         *
         * Solamente expulsamos cuando
         * el servidor confirma que la sesión
         * ya no es válida.
         */

        console.warn(

            "⚠️ CINEMAX: no se pudo comprobar la sesión.",

            error

        );


    } finally {


        checkingSession =
            false;

    }

}


/* ========================================================
   INICIAR MONITOR
   ======================================================== */

function startSessionMonitor() {


    /*
     * Admin2 puede tener el archivo cargado
     * accidentalmente, pero simplemente lo ignoramos.
     */

    if (
        isExcludedPage()
    ) {

        console.log(
            "🛡️ CINEMAX: monitor ignorado en:",
            getCurrentPage()
        );

        return;

    }


    console.log(
        "🔐 CINEMAX: monitor de sesión iniciado."
    );


    /*
     * Primera comprobación inmediata.
     */

    checkSession();


    /*
     * Comprobación cada 5 segundos.
     */

    setInterval(
        checkSession,
        CHECK_INTERVAL
    );

}


/* ========================================================
   API GLOBAL
   ======================================================== */

window.CinemaXSessionMonitor = {

    check:
        checkSession,

    logout:
        forceLogout,

    clear:
        clearLocalSession

};


/* ========================================================
   ARRANQUE
   ======================================================== */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        startSessionMonitor

    );

} else {

    startSessionMonitor();

}


})();
