// Package Imports
import Image from "next/image";
import { useEffect } from "react";
import { useDencrypt } from "use-dencrypt-effect";

// Main
export function Loading({ message }) {
    let [coolMessage, setCoolMessage] = useDencrypt({ initialValue: btoa("Tensamin"), interval: 15})

    useEffect(() => {
        setCoolMessage(message || "Loading...")
    }, [])

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
                <p className="font-bold font-mono text-2xl text-[#c8ccf4]/30">{coolMessage}</p>
            </div>
    );
}