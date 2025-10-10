import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import Loader from "./Loader";
import { fetchMessages, postMessage, deleteMessage as apiDeleteMessage, patchMessage } from "../api/api";
import { useSocket } from "../hooks/useSocket";
import { useAlert } from "../context/AlertContext";

type ChatProps = {
    chatId: number;
    userId: number;
    username: string;
    displayName: string;
    resetSelect: () => void;
};

type Message = {
    id: number;
    chat_id: number;
    content: string;
    sent_time: string;
    image_url?: string;
    reply_content?: string;
    sender: {
        id: number;
        username: string;
        display_name?: string;
    };
};

const ChatWindow = ({ chat }: { chat: ChatProps }) => {
    const { addAlert } = useAlert();

    const [messageContent, setMessageContent] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [oldMessageContent, setOldMessageContent] = useState<string | null>(null);
    const [editMessageId, setEditMessageId] = useState<number | null>(null);

    const [isReplying, setIsReplying] = useState<boolean>(false);
    const [replyedMessageContent, setReplyedMessageContent] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const { socket } = useSocket(chat.chatId);

    useEffect(() => {
        let isMounted = true;
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const fetch = async () => {
            setLoading(true);
            await new Promise((r) => setTimeout(r, 300));
            try {
                const msgs = await fetchMessages(chat.chatId);
                if (isMounted) setMessages(msgs);
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetch();

        return () => {
            isMounted = false;
        };
    }, [chat.chatId]);

    useEffect(() => {
        if (!socket) return;

        const handler = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);

                if (data.action === "delete_message") {
                    setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
                    return;
                }

                if (data.action === "edit_message") {
                    setMessages((prev) =>
                        prev.map((m) => (m.id === data.message_id ? { ...m, content: data.new_content } : m))
                    );
                    return;
                }

                setMessages((prev) => [
                    ...prev,
                    {
                        ...data,
                        sender: {
                            id: data.sender_id,
                            username: data.sender_username,
                            display_name: data.sender_displayName,
                        },
                    } as unknown as Message,
                ]);
            } catch (e) {
                console.error("Failed to parse ws message", e);
            }
        };

        socket.addEventListener("message", handler);
        return () => socket.removeEventListener("message", handler);
    }, [socket]);

    const handleSend = async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        if (isEditing) return;

        const formData = new FormData();
        formData.append("chat_id", chat.chatId.toString());
        if (messageContent) formData.append("content", messageContent);
        if (selectedFile) formData.append("image", selectedFile);
        if (replyedMessageContent) formData.append("reply_content", replyedMessageContent);

        try {
            await postMessage(formData);
        } catch (err) {
            console.error(err);
        }

        setMessageContent("");
        setSelectedFile(null);
        setIsReplying(false);
        setReplyedMessageContent(null);
    };

    const handleDelete = async (messageId: number) => {
        try {
            await apiDeleteMessage(messageId);
            addAlert("Message deleted", "success", 1000);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = async (messageId: number | null, oldContent: string | null) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;
        if (!isEditing || messageId === null || oldContent === null) return;

        setOldMessageContent(oldContent);

        try {
            await patchMessage(messageId, messageContent || "");
            setEditMessageId(null);
            setIsEditing(false);
            addAlert("Message edited", "success", 1000);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <>
            {loading ? (
                <Loader />
            ) : (
                <>
                    <div className="bg-[#313640] h-16 rounded-t-3xl flex flex-row justify-between items-center gap-0 px-6">
                        <button onClick={chat.resetSelect}>
                            <img src="/images/arrow-back.svg" alt="Go back" className="h-8" />
                        </button>
                        <div className="flex flex-col items-end">
                            {chat.displayName ? <span className="text-lg">{chat.displayName}</span> : <span className="text-lg">{chat.username}</span>}
                            <p className="text-white/50 italic">@{chat.username}</p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-items-start w-full h-full p-3 gap-2 overflow-y-auto custom-scroll">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender?.id === chat.userId ? "flex-row" : "flex-row-reverse"} gap-3`}>
                                <div className={`flex flex-col gap-1 ${msg.sender?.id === chat.userId ? "bg-[#313640] items-start self-start px-3 py-2 other-message max-w-[50%]" : "bg-[#9371EB] items-end self-end px-3 py-2 my-message max-w-[50%]"}`}>
                                    {msg.sender?.display_name ? <p className="text-xs text-white/50">{msg.sender?.display_name}</p> : <p className="text-xs text-white/50">{msg.sender?.username}</p>}
                                    {msg.reply_content && (
                                        <div className="flex flex-row items-center bg-white/35 px-3 py-1 rounded-lg gap-2">
                                            <img src="/images/reply.svg" alt="Reply" className="h-5 opacity-50" />
                                            <p>{msg.reply_content}</p>
                                        </div>
                                    )}
                                    {msg.image_url && <img src={`http://localhost:5050${msg.image_url}`} alt="Uploaded" className="w-72 rounded-2xl my-2" />}
                                    <span>{msg.content}</span>
                                    <div className={`flex ${msg.sender?.id === chat.userId ? "flex-row" : "flex-row-reverse"} gap-1 text-xs`}>
                                        <p className="text-white/50">{new Date(msg.sent_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                </div>

                                {msg.sender?.id !== chat.userId ? (
                                    <div className="flex flex-row h-full justify-center gap-2">
                                        <button
                                            onClick={() => {
                                                setIsReplying(false);
                                                setIsEditing(true);
                                                setEditMessageId(msg.id);
                                                setOldMessageContent(msg.content);
                                            }}
                                        >
                                            <img src="/images/edit.svg" alt="Edit" className="h-10 bg-white/15 p-2 rounded-xl hover:bg-white/35 transition-all duration-350" />
                                        </button>

                                        <button onClick={() => handleDelete(msg.id)}>
                                            <img src="/images/delete.svg" alt="Send" className="h-10 bg-white/15 p-1 rounded-xl hover:bg-white/35 transition-all duration-350" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-row-reverse h-full justify-center gap-2">
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setIsReplying(true);
                                                setReplyedMessageContent(msg.content);
                                            }}
                                        >
                                            <img src="/images/reply.svg" alt="Edit" className="h-10 bg-white/15 p-2 rounded-xl hover:bg-white/35 transition-all duration-350" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form
                        className="flex flex-row w-full p-3 gap-3 items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setMessageContent("");
                            setSelectedFile(null);
                            isEditing ? handleEdit(editMessageId, oldMessageContent) : handleSend();
                        }}
                    >
                        {isEditing ? (
                            <div className="flex flex-col w-full bg-[#21242B]/50 rounded-2xl">
                                <div className="flex flex-row items-center justify-between mx-3 mt-3 mb-2 px-3 py-1 bg-[#9371EB]/50 rounded-t-xl rounded-b-md">
                                    <div className="flex flex-row gap-2 items-center">
                                        <img src="/images/edit.svg" alt="Edit" className="h-4 opacity-50" />
                                        <p>{oldMessageContent}</p>
                                    </div>
                                    <p onClick={() => setIsEditing(false)} className="text-lg cursor-pointer">
                                        ×
                                    </p>
                                </div>
                                <TextareaAutosize
                                    minRows={1}
                                    maxRows={4}
                                    placeholder="Enter message here"
                                    value={messageContent || ""}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleEdit(editMessageId, oldMessageContent);
                                        }
                                    }}
                                    className="bg-[#21242B]/75 px-5 min-h-12 rounded-2xl w-full focus:bg-[#21242B]/90 pt-3 focus:outline-none custom-scroll resize-none"
                                />
                            </div>
                        ) : isReplying ? (
                            <div className="flex flex-col w-full bg-[#21242B]/50 rounded-2xl">
                                <div className="flex flex-row items-center justify-between mx-3 mt-3 mb-2 px-3 py-1 bg-[#9371EB]/50 rounded-t-xl rounded-b-md">
                                    <div className="flex flex-row gap-2 items-center">
                                        <img src="/images/reply.svg" alt="Relpy" className="h-4 opacity-50" />
                                        <p>{replyedMessageContent}</p>
                                    </div>
                                    <p onClick={() => setIsReplying(false)} className="text-lg cursor-pointer">
                                        ×
                                    </p>
                                </div>
                                <TextareaAutosize
                                    minRows={1}
                                    maxRows={4}
                                    placeholder="Enter message here"
                                    value={messageContent || ""}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    className="bg-[#21242B]/75 px-5 min-h-12 rounded-2xl w-full focus:bg-[#21242B]/90 pt-3 focus:outline-none custom-scroll resize-none"
                                />
                            </div>
                        ) : (
                            <div className="flex w-full">
                                <TextareaAutosize
                                    minRows={1}
                                    maxRows={4}
                                    placeholder="Enter message here"
                                    value={messageContent || ""}
                                    onChange={(e) => setMessageContent(e.target.value)}
                                    required
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    className="bg-[#21242B]/75 px-5 min-h-12 rounded-2xl w-full focus:bg-[#21242B]/90 pt-3 focus:outline-none custom-scroll resize-none"
                                />
                            </div>
                        )}

                        <label className={`min-w-12 h-12 flex justify-center items-center ${selectedFile ? "bg-[#9371EB]" : "bg-[#555]"}  cursor-pointer text-white rounded-2xl viol-glow`}>
                            <img src={selectedFile ? "/images/done.svg" : "/images/clip.svg"} alt="Add" className="h-5 " />
                            <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)} />
                        </label>

                        <button type="submit" className="min-w-12 h-12 text-white rounded-2xl bg-[#9371EB] flex justify-center items-center viol-glow">
                            <img src={!isEditing ? "/images/send.svg" : "/images/done.svg"} alt="Send" className="h-6" />
                        </button>
                    </form>
                </>
            )}
        </>
    );
};

export default ChatWindow;