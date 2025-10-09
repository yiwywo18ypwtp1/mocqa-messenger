import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { registerUser, loginUser } from "../api/api";

function LoginPage() {
    const navigate = useNavigate()

    const [username, setUsername] = useState<string | null>(null)
    const [displayName, setDisplayName] = useState<string | null>(null)
    const [email, setEmail] = useState<string | null>(null)
    const [password, setPassword] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !displayName || !email || !password) {
            setErrorMessage("Please, fill all fields before");
            return;
        }

        try {
            await registerUser(username, displayName, email, password);
            const loginResponse = await loginUser(username, password);
            localStorage.setItem("accessToken", loginResponse.data.access_token);

            navigate("/");

        } catch (error) {
            console.error(error);
            setErrorMessage("Registration failed. Please try again");
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
                                    setErrorMessage(null);
                                }}
                                className="bg-[#21242B]/50 outline-none w-full h-12 rounded-2xl px-5 text-white placeholder:text-white/50 focus:outline-none focus:placeholder-transparent focus:bg-[#21242B]/75 transition-all duration-500"
                            />
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <label>Display Name</label>
                            <input
                                type="text"
                                placeholder="John Doe (optional)"
                                required
                                onChange={(e) => {
                                    setDisplayName(e.target.value);
                                    setErrorMessage(null);
                                }}
                                className="bg-[#21242B]/50 outline-none w-full h-12 rounded-2xl px-5 text-white placeholder:text-white/50 focus:outline-none focus:placeholder-transparent focus:bg-[#21242B]/75 transition-all duration-500"
                            />
                        </div>
                        <div className="flex flex-col gap-2 items-center">
                            <label>E-mail</label>
                            <input
                                type="email"
                                placeholder="johnd@gmail.com"
                                required
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setErrorMessage(null);
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
                                pattern="^(?=.*\d)[A-Za-z\d]{8,}$"
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setErrorMessage(null);
                                }}
                                className="bg-[#21242B]/50 outline-none w-full h-12 rounded-2xl px-5 text-white placeholder:text-white/50 focus:outline-none focus:placeholder-transparent focus:bg-[#21242B]/75 -transition-all duration-500"
                            />
                        </div>
                    </div>

                    {errorMessage ?
                        <p className="text-red-500 animate-pulse">
                            {errorMessage}
                        </p> :
                        <Link
                            to="/login"
                            className="white-glow"
                        >
                            Already have an accaunt?
                        </Link>
                    }


                    <button
                        type="submit"
                        onClick={handleRegister}
                        className="bg-[#9371EB] w-full h-12 rounded-2xl focus:outline-none viol-glow"
                    >
                        Sign up
                    </button>
                </form>
            </div >
        </div >
    )
};

export default LoginPage;