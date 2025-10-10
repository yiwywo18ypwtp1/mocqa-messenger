import { useEffect, useState } from "react";
import axios from "axios";
import { useAlert } from "../context/AlertContext";

type Participant = {
    id: number;
    username: string;
    display_name: string;
}

type ChatFromServer = {
    chat_id: number;
    participants: Participant[];
}

type ChatPanelProps = {
    chatIdSelected: number | null;
    username: string;
    displayName: string;
    chatSelect: (userId: number, chatUsername: string, chatDisplayName: string, chatId: number) => void;
}

const ChatsPanel = ({ chat }: { chat: ChatPanelProps }) => {
    const { addAlert } = useAlert();

    const [chats, setChats] = useState<ChatFromServer[]>([]);
    const [searchInput, setSearchInput] = useState<string>("");
    const [currentUser, setCurrentUser] = useState<{ id: number, username: string, display_name: string } | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("accessToken")
        if (!token) return;

        axios.get("/chats", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => setChats(response.data.chats))
            .catch(err => console.error(err));

        axios.get("/me", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => setCurrentUser(response.data))
            .catch(err => console.error(err));
    }, []);

    const handleSearchClick = async () => {
        if (!searchInput) return;

        const token = localStorage.getItem("accessToken")

        try {
            const response = await axios.post("/chats",
                {
                    username: searchInput,
                },
                {
                    headers: {
                        "Authorization": "Bearer " + token
                    }
                }
            );

            const newChat: ChatFromServer = {
                chat_id: response.data.chat_id,
                participants: response.data.participants
            };
            setChats(prev => [...prev, newChat]);
            addAlert("Friend added! Enjoy chatting :)", "success");

        } catch (error: any) {
            if (error.response?.status === 404) {
                addAlert("No user with such username. Please enter correct username", "error")
            }
        }
    }

    return (
        <>
            <div className="pt-3 px-3 flex flex-row gap-3">
                <input
                    type="text"
                    placeholder="Enter username to start chat!"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="px-5 py-2 h-12 text-white text-sm w-full bg-[#21242B]/75 rounded-2xl focus:bg-[#21242B] focus:outline-none placeholder:italic placeholder:text-white/30"
                />
                <button
                    className="min-w-12 text-white rounded-2xl bg-[#9371EB] flex justify-center items-center viol-glow"
                    onClick={handleSearchClick}
                >
                    <img src="/images/search.svg" alt="Search" className="h-6" />
                </button>
            </div>
            <div className="m-3 flex flex-col gap-3 overflow-y-auto h-[calc(100vh-150px)] custom-scroll">
                {chats.map(current_chat => {
                    const otherUser = current_chat.participants.find(p => p.username !== currentUser?.username);
                    if (!otherUser) return null;

                    return (
                        <div
                            key={current_chat.chat_id}
                            className={`px-3 py-2 rounded-2xl hover:shadow-none hover:bg-[#21242b]/50 cursor-pointer
                                ${chat.chatIdSelected === current_chat.chat_id ? "bg-[#9371EB] shadow-none" : "glass-back"} transition duration-350`}
                            onClick={() => chat.chatSelect(
                                otherUser.id,
                                otherUser.username,
                                otherUser.display_name,
                                current_chat.chat_id
                            )}
                        >
                            <strong>{otherUser.display_name}</strong>
                            <p className="text-white/50 italic">@{otherUser.username}</p>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export default ChatsPanel;
