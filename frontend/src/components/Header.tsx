import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const Header: React.FC = () => {
    const navigate = useNavigate();

    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");

        axios.get("/me", {
            headers: {
                "Authorization": "Bearer " + token
            }
        })
            .then(response => setUsername(response.data.username))
            .catch(() => setUsername(null));
    }, [])

    return (
        <header className="flex flex-row items-center justify-between sticky top-0 py-3 px-5">
            <div className="flex flex-row">
                {username ?
                    <div className="flex flex-row gap-3">
                        <p className="white-glow">Hello, {username}!</p>
                        <p>|</p>
                        <p
                            onClick={
                                () => {
                                    localStorage.clear();
                                    navigate("/login");
                                }
                            }
                            className="white-glow cursor-pointer"
                        >
                            Sign out
                        </p>
                    </div>
                    :
                    <p className="white-glow cursor-pointer">Log in</p>}
            </div>
            <Link
                to="/"
                className="white-glow text-2xl absolute left-1/2 transform -translate-x-1/2"
            >
                MoCQa - Messenger
            </Link>

        </header >
    )
}

export default Header;