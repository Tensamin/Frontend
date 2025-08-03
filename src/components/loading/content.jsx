"use client";

// Package Imports
import Image from "next/image";
import { useEffect, useState } from "react";
import { useDencrypt } from "use-dencrypt-effect";
import * as Icon from "lucide-react"

// Lib Imports
import ls from "@/lib/localStorageManager";

// Components
import { Button } from "@/components/ui/button"

// Main
export function Loading({ message = "Loading...", error = false, allowDebugToForceLoad = false, returnDebug }) {
    let [coolMessage, setCoolMessage] = useDencrypt({ initialValue: btoa("Tensamin"), interval: 15 })
    let [debug, setDebug] = useState(false)

    useEffect(() => {
        setCoolMessage(message)
        setDebug(ls.get("debug") === "true")
    }, [])

    return (
        <div className="w-screen h-screen bg-[#11111b] flex justify-center items-center flex-col gap-20">
            <Image
                src={error ? "/logo.png" : "/loading.gif"}
                alt="Tensamin"
                width={500}
                height={500}
                className="w-75 h-75 rounded-4xl select-none"
                priority
                unoptimized
            />
            <p className="font-bold font-mono text-2xl text-[#c8ccf4]/30 w-2/3 text-center">{coolMessage}</p>
            {debug && allowDebugToForceLoad ? (
                <Button
                    className=""
                    onClick={() => {
                        returnDebug(true)
                    }}
                >
                    <Icon.Users /> Close (Debug Mode Only)
                </Button>
            ) : null}
        </div>
    );
}