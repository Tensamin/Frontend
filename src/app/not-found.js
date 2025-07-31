// Package Imports
import Image from "next/image";

// Main
export default function NotFound() {
    return (
        <div className="w-screen h-screen bg-[#11111b] flex justify-center items-center flex-col gap-20">
            <Image
                src="/logo.png"
                alt="Tensamin"
                width={500}
                height={500}
                className="w-75 h-75 rounded-4xl select-none"
                priority
                unoptimized
            />
            <p className="font-bold font-mono text-2xl text-[#c8ccf4]/30">This page does not exist</p>
        </div>
    );
}