import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { setAccessToken } from "./api"

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────

// O backend atualmente redireciona para:
// /auth/google/callback?token=<jwt>
//
// IMPORTANTE:
// Token em query string não é o mecanismo ideal de segurança, pois
// pode aparecer no histórico, logs, ferramentas de monitoramento etc.
//
// Por enquanto, mantemos esse formato por compatibilidade com o backend.
// Futuramente, esta função pode ser substituída por outro mecanismo,
// como:
// - troca de código de uso único por access_token;
// - cookie HttpOnly + endpoint de troca;
// - postMessage em um fluxo controlado.
//
// O restante do componente não precisa ser alterado.
function getOAuthToken() {
    const params = new URLSearchParams(window.location.search)

    return {
        token: params.get("token"),
        error: params.get("error")
    }
}

// ─── VALIDAÇÃO MÍNIMA DO JWT ─────────────────────────────────

function isValidJwtFormat(token) {
    if (!token || typeof token !== "string") {
        return false
    }

    const parts = token.split(".")

    // JWT possui exatamente:
    // header.payload.signature
    if (parts.length !== 3) {
        return false
    }

    // Cada parte precisa possuir conteúdo.
    if (parts.some(part => !part)) {
        return false
    }

    // JWT usa Base64URL.
    // Essa validação não verifica assinatura ou expiração.
    // Quem realmente valida o token continua sendo o backend.
    const base64UrlPattern = /^[A-Za-z0-9_-]+$/

    if (!parts.every(part => base64UrlPattern.test(part))) {
        return false
    }

    return true
}

// ─── MAPEAMENTO DOS ERROS DO GOOGLE OAUTH ────────────────────

function mapGoogleError(error) {
    const normalized = String(error || "").toLowerCase().trim()

    if (
        normalized === "access_denied" ||
        normalized.includes("access denied") ||
        normalized.includes("cancel")
    ) {
        return "Você cancelou o login com o Google."
    }

    if (
        normalized === "invalid_token" ||
        normalized.includes("invalid id token") ||
        normalized.includes("missing id token") ||
        normalized.includes("invalid token")
    ) {
        return "Não foi possível validar sua autenticação com o Google."
    }

    if (
        normalized === "invalid_request" ||
        normalized === "unauthorized_client" ||
        normalized === "invalid_client"
    ) {
        return "Não foi possível iniciar o login com o Google."
    }

    return "Não foi possível entrar com o Google. Tente novamente."
}

// ─── LIMPA OS DADOS SENSÍVEIS DA URL ─────────────────────────

function clearCallbackUrl() {
    window.history.replaceState(
        {},
        "",
        "/auth/google/callback"
    )
}

// ─── COMPONENTE ──────────────────────────────────────────────

export default function GoogleCallback() {
    const navigate = useNavigate()
    const processed = useRef(false)

    useEffect(() => {
        if (processed.current) return

        processed.current = true

        const { token, error } = getOAuthToken()

        // ─── ERRO DEVOLVIDO PELO BACKEND / GOOGLE ─────────────

        if (error) {
            clearCallbackUrl()

            navigate(
                `/auth/login?error=google_auth_failed&reason=${encodeURIComponent(
                    mapGoogleError(error)
                )}`,
                {
                    replace: true
                }
            )

            return
        }

        // ─── TOKEN AUSENTE ───────────────────────────────────

        if (!token) {
            clearCallbackUrl()

            navigate(
                "/auth/login?error=google_auth_failed",
                {
                    replace: true
                }
            )

            return
        }

        // ─── VALIDAÇÃO MÍNIMA DO TOKEN ───────────────────────

        if (!isValidJwtFormat(token)) {
            clearCallbackUrl()

            navigate(
                "/auth/login?error=google_auth_failed",
                {
                    replace: true
                }
            )

            return
        }

        // ─── ARMAZENA ACCESS TOKEN ───────────────────────────

        setAccessToken(token)

        // Remove o token da barra de endereço e do histórico
        // assim que ele for lido.
        clearCallbackUrl()

        // ─── LOGIN CONCLUÍDO ─────────────────────────────────

        navigate("/home", {
            replace: true
        })

    }, [navigate])

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1a1a2e",
                color: "#f5f4ff",
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                WebkitFontSmoothing: "antialiased"
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 14
                }}
            >
                <div
                    style={{
                        width: 32,
                        height: 32,
                        border: "3px solid rgba(245,244,255,0.18)",
                        borderTopColor: "#6382ff",
                        borderRadius: "50%",
                        animation: "googleCallbackSpin .7s linear infinite"
                    }}
                />

                <p
                    style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: "rgba(245,244,255,0.85)"
                    }}
                >
                    Entrando...
                </p>
            </div>

            <style>{`
                @keyframes googleCallbackSpin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    )
}