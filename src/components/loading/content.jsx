// Package Imports
import Image from "next/image";

// Main
export function Loading() {
    return (
            <div className="w-screen h-screen bg-[#11111b] flex justify-center items-center">
                <Image
                    src="/loading.gif"
                    alt="Tensamin"
                    width={500}
                    height={500}
                    className="w-75 h-75 rounded-4xl"
                    priority
                    unoptimized
                />
            </div>
    );
}