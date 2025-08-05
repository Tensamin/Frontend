// Package Imports
import { useEffect, useState, useRef } from "react";
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

export function VideoStream({ peerConnection }) {
  let videoRef = useRef(null);
  let [mediaStream, setMediaStream] = useState(null);

  useEffect(() => {
    if (!peerConnection) {
      return;
    }

    let handleTrack = (event) => {
      setMediaStream(event.streams[0]);
    };

    peerConnection.addEventListener("track", handleTrack);

    return () => {
      peerConnection.removeEventListener("track", handleTrack);
    };
  }, [peerConnection]);

  useEffect(() => {
    if (videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
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