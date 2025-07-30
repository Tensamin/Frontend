// Package Imports
import Image from "next/image";

// Main
export function Loading({ message }) {
    return (
            <div className="w-screen h-screen bg-[#11111b] flex justify-center items-center flex-col gap-20">
                <Image
                    src="/loading.gif"
                    alt="Tensamin"
                    width={500}
                    height={500}
                    className="w-75 h-75 rounded-4xl select-none"
                    priority
                    unoptimized
                />
                <p className="font-bold text-2xl text-white/7">{message || "Authenticating..."}</p>
            </div>
    );
}