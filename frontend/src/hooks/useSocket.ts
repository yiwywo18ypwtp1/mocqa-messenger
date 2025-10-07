import { useEffect, useRef, useState } from "react";

type UseSocketOpts = {
    getToken?: () => string | null;
    wsBase?: string;
};

export const useSocket = (chatId: number | string, opts?: UseSocketOpts) => {
    const wsRef = useRef<WebSocket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const wsBase = opts?.wsBase || process.env.REACT_APP_WS_URL || "ws://localhost:5050";
        const token = opts?.getToken ? opts.getToken() : localStorage.getItem("accessToken");
        const tokenPart = token ? `?token=${encodeURIComponent(token)}` : "";
        const url = `${wsBase}/ws/chat/${chatId}${tokenPart}`;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = (e) => {
            console.error("WebSocket error", e);
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [chatId, opts?.getToken, opts?.wsBase]);

    const sendMessage = (payload: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
        } else {
            console.warn("Socket is not open");
        }
    };

    return { socket: wsRef.current, connected, sendMessage };
};