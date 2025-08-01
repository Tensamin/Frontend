// Package Imports
import * as Icon from "lucide-react"
import { useState, useEffect } from "react"

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils"
import ls from "@/lib/localStorageManager"

// Context Imports
import { useUsersContext } from "@/components/context/users"
import { usePageContext } from "@/components/context/page"

// Components
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { MiniMiniUserModal } from "@/components/page/root/user-modal/main"
import { Bouncy } from 'ldrs/react'
import 'ldrs/react/Bouncy.css'

// Main
export function VoiceControls() {
    let { currentCall, setCurrentCall, stopVoiceCall } = useUsersContext();
    let { setPage } = usePageContext();

    let [expandUsers, setExpandUsers] = useState(true);

    function toggleMute() {
        if (currentCall.mute) {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                mute: false,
                deaf: false,
            }))
        } else {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                mute: true,
            }))
        }
    }

    function toggleDeaf() {
        if (currentCall.deaf) {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                deaf: false,
            }))
        } else {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                mute: true,
                deaf: true,
            }))
        }
    }

    return (
        <div className="flex flex-col gap-3 w-full">
            <Card className="flex flex-row p-2 justify-center gap-0">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                        {/* Soundboard */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="w-9 h-9"
                                    onClick={() => {
                                        console.log("Soundboard")
                                    }}
                                >
                                    <Icon.Clapperboard />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Soundboard</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Camera */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="w-9 h-9"
                                    onClick={() => {
                                        console.log("Camera")
                                    }}
                                >
                                    <Icon.Camera />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Camera</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex flex-row gap-2">
                        {/* Stream */}
                        <div>
                            {currentCall.active_stream ? (
                                <Popover>
                                    <PopoverTrigger>
                                        <Tooltip delayDuration={2000}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    className={`w-9 h-9 ${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}`}
                                                    onClick={() => {
                                                        console.log("Stream")
                                                    }}
                                                >
                                                    <Icon.Monitor />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Stream</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 border-0">
                                        <Command className="rounded-lg border shadow-md">
                                            <CommandInput placeholder="Type a command or search..." />
                                            <CommandList>
                                                <CommandEmpty>No results found.</CommandEmpty>
                                                <CommandGroup heading="Suggestions">
                                                    <CommandItem>
                                                        <Icon.Calendar />
                                                        <span>Calendar</span>
                                                    </CommandItem>
                                                    <CommandItem>
                                                        <Icon.Smile />
                                                        <span>Search Emoji</span>
                                                    </CommandItem>
                                                    <CommandItem disabled>
                                                        <Icon.Calculator />
                                                        <span>Calculator</span>
                                                    </CommandItem>
                                                </CommandGroup>
                                                <CommandSeparator />
                                                <CommandGroup heading="Settings">
                                                    <CommandItem>
                                                        <Icon.User />
                                                        <span>Profile</span>
                                                    </CommandItem>
                                                    <CommandItem>
                                                        <Icon.CreditCard />
                                                        <span>Billing</span>
                                                    </CommandItem>
                                                    <CommandItem>
                                                        <Icon.Settings />
                                                        <span>Settings</span>
                                                    </CommandItem>
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <Tooltip delayDuration={2000}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            className={`w-9 h-9 ${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}`}
                                            onClick={() => {
                                                console.log("Stream")
                                            }}
                                        >
                                            <Icon.Monitor />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Stream</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>

                        {/* ? */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="w-9 h-9"
                                    onClick={() => {

                                    }}
                                >
                                    <Icon.Bomb />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>idk</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className="w-full flex justify-center" >
                    <div className="border-l-1 pl-0.5" />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                        {/* Expand */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className="w-9 h-9"
                                    onClick={() => {
                                        setPage({ name: "voice", data: "" })
                                    }}
                                >
                                    <Icon.Expand />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Expand</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Exit */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className="w-9 h-9 bg-destructive hover:bg-destructive/90"
                                    onClick={() => {
                                        stopVoiceCall()
                                    }}
                                >
                                    <Icon.PhoneOutgoing />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Exit Call</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex flex-row gap-2">
                        {/* Mute */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className={`w-9 h-9 ${currentCall.mute ? "bg-destructive hover:bg-destructive/90" : ""}`}
                                    onClick={() => {
                                        toggleMute()
                                    }}
                                >
                                    {currentCall.mute ? (
                                        <Icon.MicOff />
                                    ) : (
                                        <Icon.Mic />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Toggle Mute</p>
                            </TooltipContent>
                        </Tooltip>

                        {/* Deaf */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className={`w-9 h-9 ${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}`}
                                    onClick={() => {
                                        toggleDeaf() // der aus Rainbow Six :)
                                    }}
                                >
                                    {currentCall.deaf ? (
                                        <Icon.HeadphoneOff />
                                    ) : (
                                        <Icon.Headphones />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Toggle Deaf</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </Card>
            {currentCall.users.length >= 25 ? (
                <div className="flex gap-2">
                    <Switch
                        id="expand-users"
                        checked={expandUsers}
                        onCheckedChange={setExpandUsers}
                    />
                    <Label htmlFor="expand-users">Expand Users</Label>
                </div>
            ) : null}
            <div className="relative">
                <div className="flex flex-wrap flex-row justify-start rounded-xl">
                    <div className={`flex flex-wrap flex-row justify-start gap-1.5 px-1.5 py-2.5 rounded-xl border-1 min-h-13 max-h-50 w-full ${expandUsers ? "overflow-auto" : "overflow-hidden"}`}>
                        {currentCall.users.length !== 0 ? currentCall.users.map((chat) =>
                            <InviteItem id={chat} key={chat} />
                        ) : (
                            <div className="text-sm w-full gap-3 flex items-center justify-center">
                                <Bouncy
                                    size="25"
                                    speed="1.75"
                                    color="var(--foreground)"
                                />
                                Waiting for others...
                            </div>
                        )}
                    </div>
                    <div hidden={expandUsers} className="pointer-events-none absolute bg-gradient-to-b from-transparent to-background rounded-xl h-full w-full" />
                </div>
            </div>
        </div>
    )
}

function InviteItem({ id }) {
    let { get } = useUsersContext();

    let [fetched, setFetched] = useState(false)
    let [profile, setProfile] = useState({
        display: "...",
        username: "...",
        avatar: "",
    })

    useEffect(() => {
        if (id !== "") {
            get(id)
                .then(data => {
                    setProfile((prev) => ({
                        ...prev,
                        display: data.display,
                        username: data.username,
                        avatar: data.avatar,
                    }))
                    setFetched(true);
                })
        }
    }, [id])

    return fetched ? (
        <MiniMiniUserModal
            display={profile.display}
            username={profile.username}
            avatar={profile.avatar}
            key={id}
        />
    ) : null
}