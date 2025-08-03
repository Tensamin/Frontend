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
import { Skeleton } from "@/components/ui/skeleton";

export function GettingCalled() {
    let { gettingCalledData, gettingCalled, setGettingCalled, get, startVoiceCall, stopVoiceCall } = useUsersContext();

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
                        onClick={async () => {
                            await stopVoiceCall();
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

export function RemoteStreamVideo({ stream, className }) {
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const noUpdateCountRef = useRef(0);
    const streamIdRef = useRef(stream?.id);
    const isInitializedRef = useRef(false);

    // Memoized track validation
    const trackInfo = useMemo(() => {
        if (!stream) return { hasActive: false, trackIds: '', videoTrackCount: 0 };

        const tracks = stream.getTracks();
        const videoTracks = tracks.filter(t => t.kind === 'video');
        const hasActive = videoTracks.some(track =>
            track.enabled && track.readyState === 'live' && !track.muted
        );
        const trackIds = tracks.map(t => t.id).sort().join(',');

        return { hasActive, trackIds, videoTrackCount: videoTracks.length };
    }, [stream]);

    // Optimized rendering function with throttling
    const renderFrame = useCallback(() => {
        if (!canvasRef.current || !videoRef.current) return;

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d", { alpha: false });

        // Only render if video is ready and has content
        if (videoElement.readyState >= 3 && videoElement.videoWidth > 0) {
            // Check for new frame by comparing currentTime
            const currentTime = videoElement.currentTime;
            if (currentTime > 0 && currentTime !== lastFrameTimeRef.current) {
                // Reset stall counter
                noUpdateCountRef.current = 0;
                lastFrameTimeRef.current = currentTime;

                // Resize canvas if video dimensions changed
                if (canvasElement.width !== videoElement.videoWidth ||
                    canvasElement.height !== videoElement.videoHeight) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                }

                // Clear and draw new frame
                context.clearRect(0, 0, canvasElement.width, canvasElement.height);

                try {
                    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                } catch (err) {
                    // Silently handle drawing errors (e.g., video not ready)
                }
            } else {
                // Increment stall counter
                noUpdateCountRef.current++;

                // After 5 seconds of no updates (300 frames), show stalled message
                if (noUpdateCountRef.current > 300) {
                    const hasActiveTracks = trackInfo.hasActive;

                    if (!hasActiveTracks) {
                        context.fillStyle = '#1a1a1a';
                        context.fillRect(0, 0, canvasElement.width, canvasElement.height);

                        context.font = '16px sans-serif';
                        context.fillStyle = '#ffffff';
                        context.textAlign = 'center';
                        context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);

                        // Trigger UI update for cleanup
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("remote-streams-changed"));
                        }
                    }
                }
            }
        }

        // Continue animation loop
        animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    }, [trackInfo.hasActive]);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const isNewStream = streamIdRef.current !== stream.id;
        const shouldReinitialize = isNewStream || !isInitializedRef.current;

        if (shouldReinitialize) {
            log(`Initializing video for stream ${stream.id}`, "debug", "Remote Video:");

            // Cancel any existing animation
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }

            // Clean up previous video element
            if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.load();
            }

            // Create or update video element
            let videoElement = videoRef.current || document.createElement("video");
            videoRef.current = videoElement;

            // Configure video element for optimal playback
            videoElement.srcObject = stream;
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('webkit-playsinline', '');

            // Enable video tracks
            stream.getVideoTracks().forEach(track => {
                if (!track.enabled) {
                    track.enabled = true;
                    log(`Enabled video track: ${track.id}`, "debug", "Remote Video:");
                }
            });

            // Set up track ended handlers
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    log(`Track ${track.id} ended`, "debug", "Remote Video:");
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("remote-streams-changed"));
                    }
                };
            });

            // Start video playback
            videoElement.play().catch(error => {
                log(`Video play failed for stream ${stream.id}: ${error.message}`, "debug", "Remote Video:");
            });

            // Initialize canvas
            const canvasElement = canvasRef.current;
            const context = canvasElement.getContext("2d", { alpha: false });

            if (!trackInfo.hasActive) {
                // Show placeholder for inactive streams
                canvasElement.width = 640;
                canvasElement.height = 360;
                context.fillStyle = '#1a1a1a';
                context.fillRect(0, 0, canvasElement.width, canvasElement.height);
                context.font = '16px sans-serif';
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);
            }

            // Reset frame tracking
            lastFrameTimeRef.current = 0;
            noUpdateCountRef.current = 0;
            streamIdRef.current = stream.id;
            isInitializedRef.current = true;

            // Start rendering loop
            renderFrame();
        }

        // Cleanup function
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }

            // Don't stop the stream tracks here to prevent breaking for other components
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [stream, trackInfo.hasActive, renderFrame]);

    return <canvas ref={canvasRef} className={className} />;
}

export function User({ id, className, avatarSize }) {
    let [display, setDisplay] = useState("...");
    let [username, setUsername] = useState("...");
    let [avatar, setAvatar] = useState("...");
    let { get } = useUsersContext();

    useEffect(() => {
        get(id)
            .then(data => {
                setDisplay(data.display)
                setUsername(data.username)
                setAvatar(data.avatar)
            })
    }, [id])

    return (
        <div className={`${className} relative group bg-input/20 rounded-xl flex justify-center items-center`}>
            {avatar !== "..." ? (
                <div>
                    <Avatar className={`bg-accent/50 border w-${avatarSize} h-full`}>
                        {avatar !== "" ? (
                            <Image
                                className="w-auto h-auto object-fill"
                                data-slot="avatar-image"
                                width={250}
                                height={250}
                                src={avatar}
                                alt=""
                                onError={() => {
                                    setAvatar("")
                                }}
                            />
                        ) : null}
                        <AvatarFallback>
                            {convertDisplayNameToInitials(username)}
                        </AvatarFallback>
                    </Avatar>
                </div>
            ) : (
                <Skeleton className="rounded-full size-8" />
            )}
            <div className="group-hover:block hidden absolute bottom-0 left-0 m-2">
                {display}
            </div>
        </div>
    )
}

export function InviteItem({ id, onShouldClose }) {
    let [profile, setProfile] = useState(null);
    let { get, currentCall } = useUsersContext();
    let { encrypt_base64_using_pubkey } = useEncryptionContext();
    let { send } = useWebSocketContext();

    useEffect(() => {
        get(id).then(setProfile);
    }, [id, get]);

    let handleInvite = async () => {
        if (!profile || !profile.public_key) {
            log("User profile or public key not loaded yet.", "showError");
            return;
        }
        try {
            let data = await send(
                "call_invite",
                {
                    message: `Invited ${id} to the call ${currentCall.id}`,
                    log_level: 0,
                },
                {
                    receiver_id: id,
                    call_id: currentCall.id,
                    call_secret: await encrypt_base64_using_pubkey(
                        btoa(currentCall.secret),
                        profile.public_key,
                    ),
                    call_secret_sha: await sha256(currentCall.secret),
                },
            );

            if (data.type !== "error") {
                log("Sent Invite", "success");
            } else {
                log(data.log.message, "showError");
            }
        } catch (error) {
            log(`Failed to send invite: ${error}`, "showError");
        } finally {
            onShouldClose(false);
        }
    };

    if (!profile) {
        return <CommandItem>Loading...</CommandItem>;
    }

    return (
        <CommandItem onSelect={handleInvite}>
            <p>{profile.display}</p>
        </CommandItem>
    );
}