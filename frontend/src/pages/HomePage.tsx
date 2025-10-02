import React, { useEffect, useState } from "react";
import Header from "../components/Header"
import ChatWindow from "../components/ChatWindow";
import ChatsPanel from "../components/ChatsPanel";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const HomePage: React.FC = () => {
    const navigate = useNavigate();

    const [chatIdSelected, setChatIdSelected] = useState<number | null>(null);
    const [userIdSelected, setUserIdSelected] = useState<number | null>(null);
    const [username, setUsername] = useState<string>("");
    const [displayName, setDisplayName] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) {
            navigate("/login");
            return;
        }

        axios.get("/me", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => setIsLoading(false))
            .catch(() => navigate("/login"));
    }, [navigate]);

    if (isLoading) return <div>Loading...</div>

    const handleChatSelect = (userId: number | null, chatUsername: string, chatDisplayName: string, chatId: number) => {
        setUserIdSelected(userId);
        setUsername(chatUsername);
        setDisplayName(chatDisplayName);
        setChatIdSelected(chatId);
    }

    const resetSelect = () => {
        setChatIdSelected(null);
    }


    return (
        < div className="flex flex-col h-screen" >
            <Header />

            <div className="flex flex-1 flex-col overflow-hidden mx-3 mb-3">
                <div className="flex flex-1 flex-row gap-3 min-h-0">
                    <div className="w-1/4 glass-back rounded-3xl overflow-hidden">
                        <ChatsPanel chat={{ username: username, displayName: displayName, chatIdSelected: chatIdSelected, chatSelect: handleChatSelect }} />
                    </div>

                    <div className="flex-1 glass-back rounded-3xl flex flex-col justify-between overflow-hidden">
                        {(userIdSelected !== null && chatIdSelected !== null) ?
                            <ChatWindow chat={{ userId: userIdSelected, username: username, displayName: displayName, chatId: chatIdSelected, resetSelect: resetSelect }} /> :
                            <h1 className="self-center relative top-1/2">Select chat for start messenging!</h1>
                        }
                    </div>
                </div>
            </div>
        </div >
    );
};

export default HomePage;
