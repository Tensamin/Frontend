// Package Imports
import { useEffect, useState } from "react";
import Image from "next/image"
import * as Icon from "lucide-react"

// Lib Imports
import { convertDisplayNameToInitials } from "@/lib/utils"

// Context Imports
import { useUsersContext } from "@/components/context/users";

// Components
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function GettingCalled() {
    let { gettingCalledData, gettingCalled, setGettingCalled, get, startVoiceCall } = useUsersContext();

    let [sender_id, setSenderId] = useState("");
    let [call_id, setCallId] = useState("");
    let [call_secret, setCallSecret] = useState("");

    let [caller, setCaller] = useState({});

    useEffect(() => {
        if (sender_id !== "") {
            get(sender_id)
                .then(data => {
                    setCaller(data)
                })
        }
    }, [sender_id]);

    useEffect(() => {
        setSenderId(gettingCalledData.sender_id)
        setCallId(gettingCalledData.call_id)
        setCallSecret(gettingCalledData.call_secret)
    }, [gettingCalledData]);

    return (
        <CommandDialog
            showCloseButton={false}
            key={gettingCalled}
            open={gettingCalled}
            onOpenChange={setGettingCalled}
            className="rounded-4xl border shadow-md md:min-w-[450px] h-1/2 scale-85"
        >
            <div className="flex flex-col justify-center items-center w-full gap-10 p-10">
                <Avatar className="w-[250px] h-[250px] border-1 bg-input/20">
                    {typeof caller.avatar !== "undefined" && caller.avatar !== "" ? (
                        <Image
                            src={caller.avatar}
                            alt={caller.display}
                            width={250}
                            height={250}
                        />
                    ) : null}
                    <AvatarFallback>{convertDisplayNameToInitials(caller.display)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                    <p className="text-center text-5xl font-bold">{caller.display}</p>
                    <p className="text-center text-sm text-muted-foreground/50">{caller.username}</p>
                </div>
                <div className="flex gap-5">
                    <Button
                        className="size-20 rounded-3xl"
                        onClick={() => {
                            startVoiceCall(call_id, call_secret);
                            setGettingCalled(false);
                        }}
                    >
                        <div className="scale-160">
                            <Icon.PhoneIncoming />
                        </div>
                    </Button>
                    <Button
                        className="size-20 rounded-3xl bg-destructive hover:bg-destructive/90"
                        onClick={() => {
                            setGettingCalled(false);
                        }}
                    >
                        <div className="scale-160">
                            <Icon.X />
                        </div>
                    </Button>
                </div>
                <p className="text-secondary-foreground/50 text-xl">{caller.display} is calling you ...</p>
            </div>
        </CommandDialog>
    )
}