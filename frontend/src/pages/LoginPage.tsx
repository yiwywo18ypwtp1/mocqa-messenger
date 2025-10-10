import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { useAlert } from "../context/AlertContext";
import { loginUser } from "../api/api";


function LoginPage() {
    const navigate = useNavigate();
    const { addAlert } = useAlert();

    const [username, setUsername] = useState<string | null>(null)
    const [password, setPassword] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            addAlert("Please, fill the form", "error");
            return;
        }

        try {
            const loginResponse = await loginUser(username, password);
            localStorage.setItem("accessToken", loginResponse.data.access_token);

            addAlert("Login success!", "success", 1500)
            setTimeout(() => navigate("/"), 1000)
        } catch (error: any) {
            if (error.response?.status === 404) {
                addAlert("Username not found. Please register first", "error");
            } else if (error.response?.status === 401) {
                addAlert("Incorrect login or password. Please be more attentive", "error");
            } else {
                addAlert("Server internal error. Please try later :(", "error");
            }
        }

    }

    return (
        <div className="flex flex-col h-screen">
            <Header />
            <div className="flex-1 flex justify-center">
                <form className="glass-back w-1/4 h-fit p-8 mt-32 rounded-3xl flex flex-col items-center justify-between gap-5">
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex flex-col gap-2 items-center">
                            <label>Username</label>
                            <input
                                type="text"
                                placeholder="jonh_doe1996"
                                required
                                onChange={(e) => {
                                    setUsername(e.target.value);
                                }}
                                className="bg-[#21242B]/50 outline-none w-full h-12 rounded-2xl px-5 text-white placeholder:text-white/50 focus:outline-none focus:placeholder-transparent focus:bg-[#21242B]/75 transition-all duration-500"
                            />
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <label>Password</label>
                            <input
                                type="password"
                                placeholder="qwerty123"
                                required
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                }}
                                className="bg-[#21242B]/50 outline-none w-full h-12 rounded-2xl px-5 text-white placeholder:text-white/50 focus:outline-none focus:placeholder-transparent focus:bg-[#21242B]/75 -transition-all duration-500"
                            />
                        </div>
                    </div>

                    <Link
                        to="/signup"
                        className="white-glow"
                    >
                        Don't have accaunt yet?
                    </Link>

                    <button
                        type="submit"
                        onClick={handleLogin}
                        className="bg-[#9371EB] w-full h-12 rounded-2xl focus:outline-none viol-glow"
                    >
                        Log in
                    </button>
                </form>
            </div >
        </div >
    )
};

export default LoginPage;