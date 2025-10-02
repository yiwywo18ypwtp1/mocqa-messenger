import React, { useEffect, useRef, useState } from "react";
import TextareaAutosize from 'react-textarea-autosize';
import arrowBack from '../images/arrow-back.svg';
import axios from "axios";
import Loader from "./Loader";

type ChatProps = {
    chatId: number;
    userId: number;
    username: string;
    displayName: string;
    resetSelect: () => void;
}

type Message = {
    id: number;
    chat_id: number;
    content: string;
    sent_time: string;
    image_url?: string;
    sender: {
        id: number;
        username: string;
        display_name: string;
    };
};

const ChatWindow = ({ chat }: { chat: ChatProps }) => {
    const [messageContent, setMessageContent] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [oldMessageContent, setOldMessageContent] = useState<string | null>(null)
    const [editMessageId, setEditMessageId] = useState<number | null>(null);

    const ws = useRef<WebSocket | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        let isMounted = true;
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        const fetchMessages = async () => {
            setLoading(true);
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
                const response = await axios.get("/messages", {
                    headers: { "Authorization": `Bearer ${token}` },
                    params: { chat_id: chat.chatId }
                });
                if (isMounted) setMessages(response.data.messages);
            } catch (err) {
                console.log(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMessages();

        const wsInstance = new WebSocket(`ws://localhost:5000/ws/chat/${chat.chatId}`);
        ws.current = wsInstance;

        wsInstance.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.action === "delete_message") {
                setMessages(prev => prev.filter(m => m.id !== data.message_id));
                return;
            }

            if (data.action === "edit_message") {
                setMessages(prev => prev.map(m => m.id === data.message_id ? { ...m, content: data.new_content } : m));
                return;
            }

            setMessages(prev => [
                ...prev,
                {
                    ...data,
                    sender: {
                        id: data.sender_id,
                        username: data.sender_username,
                        displayName: data.sender_displayName
                    }
                }
            ]);
        };

        return () => {
            isMounted = false;
            wsInstance.close();
        };
    }, [chat.chatId]);

    const sendMessage = async () => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        if (isEditing) return;

        const formData = new FormData();
        formData.append("chat_id", chat.chatId.toString());
        if (messageContent) formData.append("content", messageContent);
        if (selectedFile) formData.append("image", selectedFile);

        try {
            await axios.post("/messages", formData, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "multipart/form-data"
                }
            });
        } catch (err) {
            console.log(err);
        }

        setMessageContent("");
        setSelectedFile(null);
    };

    const deleteMessage = async (messageId: number) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        try {
            await axios.delete(`/messages/${messageId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error(err);
        }
    };

    const editMessage = async (messageId: number | null, oldContent: string | null) => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        if (!isEditing || messageId === null || oldContent === null) return;

        setOldMessageContent(oldContent);

        try {
            await axios.patch(
                `/messages/${messageId}`,
                { new_content: messageContent },
                {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                }
            );

            setEditMessageId(null);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <>
            {loading ? (<Loader />) : (
                <>
                    <div className="bg-[#313640] h-16 rounded-t-3xl flex flex-row justify-between items-center gap-0 px-6">
                        <button onClick={chat.resetSelect}>
                            <img src="/images/arrow-back.svg" alt="Go back" className="h-8" />
                        </button>
                        <div className="flex flex-col items-end">
                            {chat.displayName ? <span className="text-lg">{chat.displayName}</span> : <span className="text-lg">{chat.username}</span>}
                            <p className="text-white/50 italic">@{chat.username} (id:{chat.userId})</p>
                        </div>
                    </div>

                    <div className="flex flex-col justify-items-start w-full h-full p-3 gap-2 overflow-y-auto custom-scroll">
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender?.id === chat.userId ? "flex-row" : "flex-row-reverse"} gap-3`}
                            >
                                <div className={`flex flex-col ${msg.sender?.id === chat.userId ? "bg-[#313640] items-start self-start px-3 py-2 other-message max-w-[50%]" : "bg-[#9371EB] items-end self-end px-3 py-2 my-message max-w-[50%]"}`}>
                                    {msg.sender?.display_name ? <p className="text-xs text-white/50">{msg.sender?.display_name}</p> : <p className="text-xs text-white/50">{msg.sender?.username}</p>}
                                    {msg.image_url && (
                                        <img
                                            src={`http://localhost:5000${msg.image_url}`}
                                            alt="uploaded"
                                            className="w-72 rounded-2xl my-2"
                                        />
                                    )}
                                    <span>{msg.content}</span>
                                    <div className={`flex ${msg.sender?.id === chat.userId ? "flex-row" : "flex-row-reverse"} gap-1 text-xs`}>
                                        <p className="text-white/50">
                                            {new Date(msg.sent_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>

                                {msg.sender?.id !== chat.userId && (
                                    <div className="flex flex-col h-full justify-center gap-2">
                                        <button onClick={() => {
                                            setIsEditing(true);
                                            setEditMessageId(msg.id);
                                            setOldMessageContent(msg.content);
                                        }}>
                                            <img src="/images/edit.svg" alt="Edit" className="h-10 bg-white/15 p-2 rounded-xl hover:bg-white/35 transition-all duration-350" />
                                        </button>

                                        <button onClick={() => deleteMessage(msg.id)}>
                                            <img src="/images/delete.svg" alt="Send" className="h-10 bg-white/15 p-1 rounded-xl hover:bg-white/35 transition-all duration-350" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div >

                    <form
                        className="flex flex-row w-full p-3 gap-3 items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            setMessageContent("");
                            setSelectedFile(null);
                            isEditing ? editMessage(editMessageId, oldMessageContent) : sendMessage();
                        }}
                    >
                        {isEditing ?
                            <div className="flex flex-col w-full bg-[#21242B]/50 rounded-2xl">
                                <div className="flex flex-row items-center justify-between mx-3 mt-3 mb-2 px-3 py-1 bg-[#9371EB]/50 rounded-t-xl rounded-b-md">
                                    {oldMessageContent}
                                    <p
                                        onClick={() => setIsEditing(false)}
                                        className="text-lg cursor-pointer"
                                    >
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
                                            editMessage(editMessageId, oldMessageContent);
                                        }
                                    }}
                                    className="bg-[#21242B]/75 px-5 min-h-12 rounded-2xl w-full focus:bg-[#21242B]/90 pt-3 focus:outline-none custom-scroll resize-none"
                                />

                            </div> :
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
                                            sendMessage();
                                        }
                                    }}
                                    className="bg-[#21242B]/75 px-5 min-h-12 rounded-2xl w-full focus:bg-[#21242B]/90 pt-3 focus:outline-none custom-scroll resize-none"
                                />
                            </div>
                        }
                        <label className={`min-w-12 h-12 flex justify-center items-center ${selectedFile ? "bg-[#9371EB]" : "bg-[#555]"}  cursor-pointer text-white rounded-2xl viol-glow`}>
                            <img src={selectedFile ? "/images/done.svg" : "/images/clip.svg"} alt="Add photo" className="h-5 " />
                            <input
                                type="file"
                                className="hidden"
                                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                            />
                        </label>

                        <button
                            type="submit"
                            className="min-w-12 h-12 text-white rounded-2xl bg-[#9371EB] flex justify-center items-center viol-glow"
                        >
                            <img src={!isEditing ? "/images/send.svg" : "/images/done.svg"} alt="Send" className="h-6" />
                        </button>
                    </form>
                </>
            )
            }
        </>
    )
}

export default ChatWindow;