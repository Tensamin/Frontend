// Package Imports
import React, { useState, useEffect, useMemo, memo, useRef, useCallback } from "react";
import * as Icon from "lucide-react";
import { toast } from "sonner"
//import { Bouncy } from "ldrs/react";
//import "ldrs/react/Bouncy.css";

// Context Imports
import { usePageContext } from "@/components/context/page";
import { useCallContext } from "@/components/context/call";

// Components
import { Card } from "@/components/ui/card";
//import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { VideoStream } from "@/components/page/voice/parts"
//import { MiniMiniUserModal } from "@/components/page/root/user-modal/main";

// Main
export function VoiceControls() {
    let { setPage } = usePageContext();
    let { toggleMute, toggleDeaf, mute, deaf, stream, stopCall, getScreenStream, startScreenStream, stopScreenStream, setStreamResolution, setStreamRefresh, setStreamAudio, streamResolution, streamRefresh, streamAudio } = useCallContext();

    //let [expandUsers, setExpandUsers] = useState(true);

    function changeStreamRefresh(event) {
        setStreamRefresh(event);
    }

    function changeStreamResolution(event) {
        setStreamResolution(event);
    }

    function changeStreamAudio(event) {
        setStreamAudio(event);
    }

    return (
        <Card className="flex w-full flex-col p-2 gap-2">
            {stream && (
                <div className="">
                    <VideoStream peerConnection={getScreenStream()} local={true} className="rounded-lg border-1" />
                </div>
            )}

            <div className="flex flex-row justify-center gap-3">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-3">
                        {/* Soundboard */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    disabled
                                    className="h-9 w-9"
                                    onClick={() => console.log("Soundboard")}
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
                                    onClick={() => console.log("Camera")}
                                >
                                    <Icon.Camera />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Camera</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex flex-row gap-3">
                        {/* Stream */}
                        <div>
                            <DropdownMenu>
                                <Tooltip delayDuration={2000}>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant={stream ? "secondary" : "default"}
                                                className="h-9 w-9"
                                            >
                                                <Icon.Monitor />
                                            </Button>
                                        </DropdownMenuTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Stream</p>
                                    </TooltipContent>
                                </Tooltip>
                                <DropdownMenuContent>
                                    <DropdownMenuGroup heading="Actions">
                                        <DropdownMenuItem
                                            disabled={stream}
                                            onClick={startScreenStream}
                                        >
                                            <Icon.MonitorCheck className="mr-2" />
                                            <span>Start Stream</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={!stream}
                                            onClick={stopScreenStream}
                                        >
                                            <Icon.MonitorX className="mr-2" />
                                            <span>Stop Stream</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled={!stream}>
                                            <Icon.ScreenShare className="mr-2" />
                                            <span>Change Window</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup heading="Controls">
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Icon.Volume2 className="mr-2" />
                                            <Label
                                                htmlFor="stream-audio"
                                                className="w-full text-sm font-normal"
                                            >
                                                Stream Audio
                                            </Label>
                                            <Checkbox
                                                id="stream-audio"
                                                checked={streamAudio}
                                                onCheckedChange={changeStreamAudio}
                                            />
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <Icon.MonitorCog className="mr-2" />
                                                <span>Change Quality</span>
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    <DropdownMenuGroup>
                                                        <RadioGroup
                                                            className="gap-0.5"
                                                            defaultValue={streamRefresh}
                                                            onValueChange={changeStreamRefresh}
                                                        >
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="15" id="15" />
                                                                <Label className="w-full pl-2" htmlFor="15">
                                                                    15 FPS
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="30" id="30" />
                                                                <Label className="w-full pl-2" htmlFor="30">
                                                                    30 FPS
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="60" id="60" />
                                                                <Label className="w-full pl-2" htmlFor="60">
                                                                    60 FPS
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="120" id="120" />
                                                                <Label className="w-full pl-2" htmlFor="120">
                                                                    120 FPS
                                                                </Label>
                                                            </DropdownMenuItem>
                                                        </RadioGroup>
                                                    </DropdownMenuGroup>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuGroup>
                                                        <RadioGroup
                                                            className="gap-0.5"
                                                            defaultValue={streamResolution}
                                                            onValueChange={changeStreamResolution}
                                                        >
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="854x480" id="480" />
                                                                <Label className="w-full pl-2" htmlFor="480">
                                                                    480p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="1280x720" id="720" />
                                                                <Label className="w-full pl-2" htmlFor="720">
                                                                    720p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="1920x1080" id="1080" />
                                                                <Label className="w-full pl-2" htmlFor="1080">
                                                                    1080p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="2560x1440" id="1440" />
                                                                <Label className="w-full pl-2" htmlFor="1440">
                                                                    1440p
                                                                </Label>
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
                                <Button disabled className="h-9 w-9">
                                    <Icon.Bomb />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>idk</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className="w-full h-auto flex justify-center items-center">
                    <div className="h-3/4 border-l pl-0.5"></div>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex flex-row gap-3">
                        {/* Expand */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className="h-9 w-9"
                                    onClick={() => setPage({ name: "voice", data: "" })}
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
                                    onClick={stopCall}
                                >
                                    <Icon.PhoneOutgoing />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Exit Call</p>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    <div className="flex flex-row gap-3">
                        {/* Mute */}
                        <Tooltip delayDuration={2000}>
                            <TooltipTrigger asChild>
                                <Button
                                    className={`h-9 w-9 ${mute
                                        ? "bg-destructive hover:bg-destructive/90"
                                        : ""
                                        }`}
                                    onClick={toggleMute}
                                >
                                    {mute ? <Icon.MicOff /> : <Icon.Mic />}
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
                                    className={`h-9 w-9 ${deaf
                                        ? "bg-destructive hover:bg-destructive/90"
                                        : ""
                                        }`}
                                    onClick={toggleDeaf}
                                >
                                    {deaf ? (
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
            </div>
            {/*currentCall.users.length >= 25 ? (
                <div className="flex items-center gap-2">
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
            </div>*/}
        </Card>
    );
}