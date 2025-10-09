import axios, { AxiosInstance, AxiosHeaders } from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5050";

let tokenGetter: () => string | null = () => localStorage.getItem("accessToken");
export const setTokenGetter = (fn: () => string | null) => {
    tokenGetter = fn;
};

const privateApi: AxiosInstance = axios.create({
    baseURL: BASE_URL,
});

const publicApi: AxiosInstance = axios.create({
    baseURL: BASE_URL,
});

privateApi.interceptors.request.use((config) => {
    const token = tokenGetter?.();
    if (token) {
        const headers = new AxiosHeaders(config.headers);
        headers.set("Authorization", `Bearer ${token}`);
        config.headers = headers;
    }
    return config;
});

// messages
export const fetchMessages = (chatId: number) =>
    privateApi.get("/messages", { params: { chat_id: chatId } }).then((r) => r.data.messages);

export const postMessage = (formData: FormData) =>
    privateApi.post("/messages", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const deleteMessage = (messageId: number) => privateApi.delete(`/messages/${messageId}`);

export const patchMessage = (messageId: number, new_content: string) =>
    privateApi.patch(`/messages/${messageId}`, { new_content });


// users
export const registerUser = (username: string, displayName: string, email: string, password: string) =>
    publicApi.post("/register", { username, display_name: displayName, email, password });

export const loginUser = (username: string, password: string) =>
    publicApi.post("/login", { username, password });


export { publicApi, privateApi };