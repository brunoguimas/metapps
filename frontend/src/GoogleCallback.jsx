import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { setAccessToken } from "./api"

export default function GoogleCallback() {
    const navigate = useNavigate()
    const processed = useRef(false)

    useEffect(() => {
        if (processed.current) return
        processed.current = true

        const params = new URLSearchParams(
            window.location.search
        )

        const token = params.get("token")

        if (!token) {
            navigate("/auth/login", {
                replace: true
            })
            return
        }

        setAccessToken(token)

        window.history.replaceState(
            {},
            "",
            "/auth/google/callback"
        )

        navigate("/home", {
            replace: true
        })

    }, [navigate])

    return <p>Entrando...</p>
}