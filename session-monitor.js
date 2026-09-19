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

    /*
     * Comprobación cada 5 segundos.
     */
    const CHECK_INTERVAL =
        5000;

    /*
     * Cantidad de comprobaciones inválidas consecutivas
     * necesarias antes de expulsar al usuario.
     *
     * 3 intentos = aproximadamente 15 segundos.
     */
    const MAX_INVALID_CHECKS =
        3;


    /*
     * Login principal del sistema.
     */
    const LOGIN_PAGE =
        "/login.html";


    /*
     * ========================================================
       PÁGINAS EXCLUIDAS
       ========================================================
    */

    const EXCLUDED_PAGES = [

        "admin2.html",

        "admin.html",

        "login.html"

    ];


    let checkingSession =
        false;


    let redirecting =
        false;


    /*
     * Contador de respuestas inválidas consecutivas.
     *
     * IMPORTANTE:
     * Un error aislado NO desconecta al usuario.
     */
    let invalidSessionChecks =
        0;


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
       REINICIAR CONTADOR DE ERRORES
       ======================================================== */

    function resetInvalidChecks() {

        if (
            invalidSessionChecks !== 0
        ) {

            console.log(
                "✅ CINEMAX: sesión confirmada nuevamente."
            );

        }

        invalidSessionChecks =
            0;

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
         * Las páginas excluidas jamás
         * serán redirigidas por este monitor.
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


        if (
            redirecting
        ) {

            return;

        }


        redirecting =
            true;


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
           ADMIN
           ====================================================
           
           Admin2 y Admin1 no son expulsados por este monitor.
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

        if (
            !sessionId
        ) {

            return;

        }


        /*
         * No comprobamos desde login.
         */

        if (
            getCurrentPage() ===
            "login.html"
        ) {

            return;

        }


        checkingSession =
            true;


        try {


            /*
             * Endpoint de sesión.
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
               RESPUESTA 401 / 403
               ================================================= */

            if (
                response.status ===
                    401 ||
                response.status ===
                    403
            ) {


                invalidSessionChecks++;


                console.warn(

                    "⚠️ CINEMAX: comprobación de sesión inválida:",

                    invalidSessionChecks +
                    "/" +
                    MAX_INVALID_CHECKS

                );


                /*
                 * NO expulsamos inmediatamente.
                 *
                 * Esperamos varias confirmaciones.
                 */

                if (
                    invalidSessionChecks <
                    MAX_INVALID_CHECKS
                ) {

                    return;

                }


                /*
                 * La sesión ha sido confirmada
                 * como inválida varias veces.
                 */

                let data =
                    null;


                try {

                    data =
                        await response.json();

                } catch (
                    jsonError
                ) {

                    data =
                        null;

                }


                forceLogout(

                    data?.error ||
                    data?.code ||
                    "El servidor confirmó que la sesión ya no es válida."

                );


                return;

            }


            /* =================================================
               RESPUESTA CORRECTA
               ================================================= */

            if (
                response.ok
            ) {


                let data =
                    null;


                try {

                    data =
                        await response.json();

                } catch (
                    jsonError
                ) {

                    data =
                        null;

                }


                /*
                 * Si el servidor dice explícitamente
                 * active:false, contamos como inválido.
                 */

                if (
                    data &&
                    data.active === false
                ) {


                    invalidSessionChecks++;


                    console.warn(

                        "⚠️ CINEMAX: servidor indica sesión inactiva:",

                        invalidSessionChecks +
                        "/" +
                        MAX_INVALID_CHECKS

                    );


                    if (
                        invalidSessionChecks >=
                        MAX_INVALID_CHECKS
                    ) {

                        forceLogout(

                            data.error ||
                            data.code ||
                            "La sesión ya no está activa."

                        );

                    }


                    return;

                }


                /*
                 * Sesión válida.
                 *
                 * Reiniciamos inmediatamente
                 * el contador de errores.
                 */

                if (
                    data &&
                    data.success === true &&
                    data.active === true
                ) {

                    resetInvalidChecks();

                    console.log(
                        "🔐 CINEMAX: sesión válida."
                    );

                    return;

                }


                /*
                 * Si HTTP es correcto pero la
                 * respuesta no tiene la estructura
                 * esperada, NO expulsamos.
                 */

                console.warn(

                    "⚠️ CINEMAX: respuesta de sesión inesperada. No se desconecta.",

                    data

                );


                return;

            }


            /*
             * Otros códigos HTTP.
             *
             * NO desconectamos automáticamente.
             */

            console.warn(

                "⚠️ CINEMAX: respuesta HTTP inesperada:",

                response.status

            );


        } catch (error) {


            /*
             * MUY IMPORTANTE:
             *
             * Un error de red NO desconecta.
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
         * Admin2/Admin1/login quedan completamente
         * fuera del monitor.
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
         * Primera comprobación.
         */

        checkSession();


        /*
         * Comprobación periódica.
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
