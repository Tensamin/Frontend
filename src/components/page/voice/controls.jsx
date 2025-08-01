// Package Imports
import React, { useState, useEffect, useMemo, memo, useRef } from "react";
import * as Icon from "lucide-react";

// Lib Imports
import { log } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { usePageContext } from "@/components/context/page";

// Components
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

export function RemoteStreamVideo({ stream, className }) {
    let canvasRef = useRef(null);
    let videoRef = useRef(null);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        let videoElement = document.createElement("video");
        videoRef.current = videoElement;

        videoElement.srcObject = stream;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.play().catch((error) => {
            log(`Video play failed for stream ${stream.id}: ${error}`, "showError");
        });

        let canvasElement = canvasRef.current;
        let context = canvasElement.getContext("2d");
        let animationFrameId;

        let renderFrame = () => {
            if (!videoRef.current) return;
            if (videoElement.readyState >= 2) {
                if (canvasElement.width !== videoElement.videoWidth) {
                    canvasElement.width = videoElement.videoWidth;
                }
                if (canvasElement.height !== videoElement.videoHeight) {
                    canvasElement.height = videoElement.videoHeight;
                }
                context.drawImage(
                    videoElement,
                    0,
                    0,
                    canvasElement.width,
                    canvasElement.height,
                );
            }
            animationFrameId = requestAnimationFrame(renderFrame);
        };

        renderFrame();

        return () => {
            cancelAnimationFrame(animationFrameId);
            if (videoRef.current) {
                let tracks = videoRef.current.srcObject?.getTracks();
                tracks?.forEach((track) => track.stop());
                videoRef.current.srcObject = null;
                videoRef.current = null;
            }
        };
    }, [stream]);

    return <canvas ref={canvasRef} className={className} />;
}

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
    let [streamError, setStreamError] = useState(null);

    let handleStartStream = async () => {
        setStreamError(null);
        try {
            let stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
            });

            let videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.addEventListener("ended", handleStopStream);
            }

            setCurrentCallStream((prev) => ({
                ...prev,
                active: true,
                stream: stream,
            }));

            if (typeof window !== "undefined" && window.setScreenShareStream) {
                window.setScreenShareStream(stream);
            }
        } catch (err) {
            setStreamError("Screen sharing failed: " + err.message);
            setCurrentCallStream((prev) => ({
                ...prev,
                active: false,
                stream: null,
            }));
        }
    };

    let handleStopStream = () => {
        if (currentCallStream.stream) {
            currentCallStream.stream.getTracks().forEach((track) => track.stop());
        }
        setCurrentCallStream((prev) => ({
            ...prev,
            active: false,
            stream: null,
        }));

        if (typeof window !== "undefined" && window.clearScreenShareStream) {
            window.clearScreenShareStream();
        }
    };

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
        setCurrentCall((prev) => ({
            ...prev,
            mute: !prev.mute,
            deaf: !prev.mute ? prev.deaf : false, // Un-deafen if un-muting
        }));
    }

    function toggleDeaf() {
        setCurrentCall((prev) => ({
            ...prev,
            deaf: !prev.deaf,
            mute: prev.deaf ? prev.mute : true, // Mute if deafening
        }));
    }

    let memoizedUserList = useMemo(
        () =>
            currentCall.users.length !== 0 ? (
                currentCall.users.map((chat) => (
                    <MemoizedInviteItem id={chat} key={chat} />
                ))
            ) : (
                <div className="flex w-full items-center justify-center gap-3 text-sm">
                    <Bouncy size="25" speed="1.75" color="var(--foreground)" />
                    Waiting for others...
                </div>
            ),
        [currentCall.users],
    );

    useEffect(() => {
        if (streamError && streamError !== "") {
            log(streamError, "showError")
        }
    }, [streamError])

    return (
        <div className="flex w-full flex-col gap-3">
            {currentCallStream.active && currentCallStream.stream && (
                <div className="flex flex-col items-center gap-2">
                    <RemoteStreamVideo stream={currentCallStream.stream} className="w-full max-w-md rounded-xl border-1" />
                </div>
            )}

            <Card className="flex flex-row justify-center gap-0 p-2">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
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

                    <div className="flex flex-row gap-2">
                        {/* Stream */}
                        <div>
                            <DropdownMenu>
                                <Tooltip delayDuration={2000}>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant={currentCallStream.active ? "secondary" : "default"}
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
                                            disabled={currentCallStream.active}
                                            onClick={handleStartStream}
                                        >
                                            <Icon.MonitorCheck className="mr-2" />
                                            <span>Start Stream</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            disabled={!currentCallStream.active}
                                            onClick={handleStopStream}
                                        >
                                            <Icon.MonitorX className="mr-2" />
                                            <span>Stop Stream</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled={!currentCallStream.active}>
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
                                                checked={currentCallStream.audio}
                                                onCheckedChange={setCurrentCallActive}
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
                                                            defaultValue={currentCallStream.refresh}
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
                                                            defaultValue={currentCallStream.resolution}
                                                            onValueChange={changeStreamResolution}
                                                        >
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="480" id="480" />
                                                                <Label className="w-full pl-2" htmlFor="480">
                                                                    480p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="720" id="720" />
                                                                <Label className="w-full pl-2" htmlFor="720">
                                                                    720p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="1080" id="1080" />
                                                                <Label className="w-full pl-2" htmlFor="1080">
                                                                    1080p
                                                                </Label>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                <RadioGroupItem value="2560" id="2560" />
                                                                <Label className="w-full pl-2" htmlFor="2560">
                                                                    2560p
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

                <div className="w-full justify-center">
                    <div className="border-l-1 pl-0.5" />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-row gap-2">
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
                                    onClick={stopVoiceCall}
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
                                    onClick={toggleMute}
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
                                    onClick={toggleDeaf}
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
            </div>
        </div>
    );
}

let MemoizedInviteItem = memo(function InviteItem({ id }) {
    let { get } = useUsersContext();
    let [profile, setProfile] = useState(null);

    useEffect(() => {
        if (id) {
            get(id).then(setProfile);
        }
    }, [id, get]);

    if (!profile) return null;

    return (
        <MiniMiniUserModal
            display={profile.display}
            username={profile.username}
            avatar={profile.avatar}
            key={id}
        />
    );
});