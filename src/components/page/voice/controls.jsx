// Package Imports
import * as Icon from "lucide-react";
import { useState, useEffect, useMemo, memo } from "react"; // Added useMemo and memo

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { usePageContext } from "@/components/context/page";

// Components
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { MiniMiniUserModal } from "@/components/page/root/user-modal/main";
import { Bouncy } from "ldrs/react";
import "ldrs/react/Bouncy.css";

// Main
export function VoiceControls() {
    let {
        currentCall,
        setCurrentCall,
        stopVoiceCall,
        currentCallStream,
        setCurrentCallStream,
    } = useUsersContext();
    let { setPage } = usePageContext();

    let [expandUsers, setExpandUsers] = useState(true);

    function setCurrentCallActive(event) {
        setCurrentCallStream((prev) => ({
            ...prev,
            audio: event,
        }));
    }

    function changeStreamResolution(event) {
        setCurrentCallStream((prev) => ({
            ...prev,
            resolution: event,
        }));
    }

    function changeStreamRefresh(event) {
        setCurrentCallStream((prev) => ({
            ...prev,
            refresh: event,
        }));
    }

    function toggleMute() {
        if (currentCall.mute) {
            setCurrentCall((prev) => ({
                ...prev,
                mute: false,
                deaf: false,
            }));
        } else {
            setCurrentCall((prev) => ({
                ...prev,
                mute: true,
            }));
        }
    }

    function toggleDeaf() {
        if (currentCall.deaf) {
            setCurrentCall((prev) => ({
                ...prev,
                deaf: false,
            }));
        } else {
            setCurrentCall((prev) => ({
                ...prev,
                mute: true,
                deaf: true,
            }));
        }
    }

    let memoizedUserList = useMemo(
        () =>
            currentCall.users.length !== 0 ? (
                currentCall.users.map((chat) => <MemoizedInviteItem id={chat} key={chat} />)
            ) : (
                <div className="flex w-full items-center justify-center gap-3 text-sm">
                    <Bouncy size="25" speed="1.75" color="var(--foreground)" />
                    Waiting for others...
                </div>
            ),
        [currentCall.users]
    );

    return (
        <div className="flex w-full flex-col gap-3">
            <Card className="flex flex-row justify-center gap-0 p-2">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                        {/* Soundboard */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="h-9 w-9"
                                    onClick={() => {
                                        console.log("Soundboard");
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
                                    className="h-9 w-9"
                                    onClick={() => {
                                        console.log("Camera");
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
                            <DropdownMenu>
                                <Tooltip delayDuration={2000}>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger
                                            className={`w-9 h-9 ${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}   h-9 px-4 py-2 has-[>svg]:px-3 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive`}
                                            onClick={() => {
                                                console.log("Stream");
                                            }}
                                        >
                                            <Icon.Monitor />
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Stream</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent>
                                    <DropdownMenuGroup heading="Actions">
                                        <DropdownMenuItem
                                            htmlFor="start-stream"
                                            disabled={currentCallStream.active}
                                            onClick={() => {
                                                setCurrentCallStream((prev) => ({
                                                    ...prev,
                                                    active: true,
                                                }));
                                            }}
                                        >
                                            <Icon.MonitorCheck />
                                            <Label
                                                htmlFor="start-stream"
                                                className="text-sm font-normal"
                                            >
                                                Start Stream
                                            </Label>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            htmlFor="stop-stream"
                                            disabled={!currentCallStream.active}
                                            onClick={() => {
                                                setCurrentCallStream((prev) => ({
                                                    ...prev,
                                                    active: false,
                                                }));
                                            }}
                                        >
                                            <Icon.MonitorX />
                                            <Label
                                                htmlFor="stop-stream"
                                                className="text-sm font-normal"
                                            >
                                                Stop Stream
                                            </Label>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            htmlFor="change-screen"
                                            disabled={!currentCallStream.active}
                                        >
                                            <Icon.ScreenShare id="change-screen" />
                                            <Label
                                                htmlFor="change-screen"
                                                className="text-sm font-normal"
                                            >
                                                Change Window
                                            </Label>
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup heading="Controls">
                                        <DropdownMenuItem htmlFor="stream-audio">
                                            <Icon.Volume2 />
                                            <Label
                                                htmlFor="stream-audio"
                                                className="w-full text-sm font-normal"
                                            >
                                                Stream Audio
                                            </Label>
                                            <Checkbox
                                                id="stream-audio"
                                                checked={currentCallStream.audio}
                                                onCheckedChange={setCurrentCallActive}
                                            />
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Icon.MonitorCog id="change-resolution" />
                                                <Label
                                                    htmlFor="change-resolution"
                                                    className="text-sm font-normal"
                                                >
                                                    Change Quality
                                                </Label>
                                                <Icon.ChevronRightIcon />
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuGroup>
                                                        <RadioGroup
                                                            className="gap-0.5"
                                                            defaultValue={currentCallStream.refresh}
                                                            onValueChange={changeStreamRefresh}
                                                        >
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="15" id="15" />
                                                                <Label className="w-full" htmlFor="15">
                                                                    15
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="30" id="30" />
                                                                <Label className="w-full" htmlFor="30">
                                                                    30
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="60" id="60" />
                                                                <Label className="w-full" htmlFor="60">
                                                                    60
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="120" id="120" />
                                                                <Label className="w-full" htmlFor="120">
                                                                    120
                                                                </Label>
                                                                <Icon.Gem />
                                                            </DropdownMenuItem>
                                                        </RadioGroup>
                                                    </DropdownMenuGroup>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuGroup>
                                                        <RadioGroup
                                                            className="gap-0.5"
                                                            defaultValue={currentCallStream.resolution}
                                                            onValueChange={changeStreamResolution}
                                                        >
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="480" id="480" />
                                                                <Label className="w-full" htmlFor="480">
                                                                    480
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="720" id="720" />
                                                                <Label className="w-full" htmlFor="720">
                                                                    720
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="1080" id="1080" />
                                                                <Label className="w-full" htmlFor="1080">
                                                                    1080{" "}
                                                                </Label>
                                                                <Icon.Gem />
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="flex items-center gap-2">
                                                                <RadioGroupItem value="2560" id="2560" />
                                                                <Label className="w-full" htmlFor="2560">
                                                                    2560{" "}
                                                                </Label>
                                                                <Icon.Gem />
                                                            </DropdownMenuItem>
                                                        </RadioGroup>
                                                    </DropdownMenuGroup>
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        {/* ? */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="h-9 w-9"
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

                <div className="flex w-full justify-center">
                    <div className="border-l-1 pl-0.5" />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
                        {/* Expand */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className="h-9 w-9"
                                    onClick={() => {
                                        setPage({ name: "voice", data: "" });
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
                                    className="h-9 w-9 bg-destructive hover:bg-destructive/90"
                                    onClick={() => {
                                        stopVoiceCall();
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
                                    className={`h-9 w-9 ${currentCall.mute
                                        ? "bg-destructive hover:bg-destructive/90"
                                        : ""
                                        }`}
                                    onClick={() => {
                                        toggleMute();
                                    }}
                                >
                                    {currentCall.mute ? <Icon.MicOff /> : <Icon.Mic />}
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
                                    className={`h-9 w-9 ${currentCall.deaf
                                        ? "bg-destructive hover:bg-destructive/90"
                                        : ""
                                        }`}
                                    onClick={() => {
                                        toggleDeaf(); // der aus Rainbow Six :)
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
                <div className="flex flex-row flex-wrap justify-start rounded-xl">
                    <div
                        className={`min-h-13 max-h-50 flex w-full flex-row flex-wrap justify-start gap-1.5 rounded-xl border-1 px-1.5 py-2.5 ${expandUsers ? "overflow-auto" : "overflow-hidden"
                            }`}
                    >
                        {memoizedUserList}
                    </div>
                    <div
                        hidden={expandUsers}
                        className="pointer-events-none absolute h-full w-full rounded-xl bg-gradient-to-b from-transparent to-background"
                    />
                </div>
            </div>
        </div>
    );
}

let MemoizedInviteItem = memo(function InviteItem({ id }) {
    let { get } = useUsersContext();

    let [fetched, setFetched] = useState(false);
    let [profile, setProfile] = useState({
        display: "...",
        username: "...",
        avatar: "",
    });

    useEffect(() => {
        if (id !== "") {
            get(id).then((data) => {
                setProfile((prev) => ({
                    ...prev,
                    display: data.display,
                    username: data.username,
                    avatar: data.avatar,
                }));
                setFetched(true);
            });
        }
    }, [id, get]);

    return fetched ? (
        <MiniMiniUserModal
            display={profile.display}
            username={profile.username}
            avatar={profile.avatar}
            key={id}
        />
    ) : null;
});