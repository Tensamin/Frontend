// Package Imports
import { useState, useEffect } from "react";
import { v7 } from "uuid";
import * as Icon from "lucide-react";

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { log, isUuid } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useWebSocketContext } from "@/components/context/websocket";
import { useEncryptionContext } from "@/components/context/encryption";
import { useUsersContext } from "@/components/context/users";
import { useCallContext } from "@/components/context/call";

// Components
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Main
export function Main() {
    let [open, setOpen] = useState(false)
    let [newChatUUID, setNewChatUUID] = useState("")
    let { ownUuid } = useUsersContext();
    let { send } = useWebSocketContext();
    let { encrypt_base64_using_pubkey } = useEncryptionContext();
    let { callId, setCallId, callSecret, setCallSecret, setCreateCall, clientPing, connected, mute, toggleMute, deaf, toggleDeaf, stream, startScreenStream, stopScreenStream, getScreenStream, getAllScreenStreams, connectedUsers, streamingUsers, toggleStream } = useCallContext();
    function handleInputChange(e) {
        setNewChatUUID(e)
    }

    async function handleSubmit() {
        try {
            if (isUuid(newChatUUID)) {
                let secret = btoa(v7() + " Tensate? " + v7() + " Sag mal Fisch " + v7() + " Jreap stinkt " + v7() + " Karpfen " + v7() + " Marmeladendoner " + v7() + " Ich war in Elias keller :^) " + v7())

                let ownPubKey;
                let newUserPubKey;

                let success = false;

                await fetch(`${endpoint.user}${ownUuid}/public-key`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.type !== "error") {
                            log(data.log.message, "debug");
                            ownPubKey = data.data.public_key;
                            success = true;
                        } else {
                            log(data.log.message, "error");
                            success = false;
                        };
                    });

                await fetch(`${endpoint.user}${newChatUUID}/public-key`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.type !== "error") {
                            log(data.log.message, "debug");
                            newUserPubKey = data.data.public_key;
                            success = true;
                        } else {
                            if (data.log.message === `Failed to get public_key for ${newChatUUID}: UUID not found.`) {
                                log("That User does not exist!", "warning")
                            } else {
                                log(data.log.message, "error");
                            }
                            success = false;
                        };
                    });

                if (success) {
                    await send("shared_secret_set", {
                        message: `${ownUuid} sent ${newChatUUID} a friend request`,
                        log_level: 1
                    }, {
                        receiver_id: newChatUUID,
                        shared_secret_own: await encrypt_base64_using_pubkey(btoa(secret), ownPubKey),
                        shared_secret_other: await encrypt_base64_using_pubkey(btoa(secret), newUserPubKey),
                    })
                        .then(data => {
                            if (data.type !== "error") {
                                log(`Sent Chat Request to ${newChatUUID}`, "success")
                            }
                        })
                }
            } else {
                log("That User does not exist!", "warning")
            }
        } catch (err) {
            log(err.message, "error")
        } finally {
            setNewChatUUID("")
        }
    }

    return (
        <div className="w-full h-full flex gap-3">
            <Card className="w-full h-full">
                <CardHeader>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <div className="flex">
                                <button
                                    role="combobox"
                                    aria-expanded={open}
                                    className="flex"
                                >
                                    <Badge>
                                        Add Chat
                                    </Badge>
                                </button>
                            </div>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Enter the UUID of the User</AlertDialogTitle>
                                <AlertDialogDescription>
                                    <Input placeholder="00000000-0000-0000-0000-000000000000" value={newChatUUID} onChange={(e) => handleInputChange(e.target.value)} onSubmit={handleSubmit}></Input>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit}>Add</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardHeader>
                <CardContent className="h-full w-full">
                    <p>Homepage</p>
                    {/* Calling */}

                    <div className="flex gap-2">
                        <Button
                            disabled={connected}
                            onClick={() => {
                                setCallId("c118752d-2fa5-4b3d-903f-5b4fd4004887");
                                setCallSecret("c118752d-2fa5-4b3d-903f-5b4fd4004887");
                                setCreateCall(true);
                            }}>
                            Join
                        </Button>

                        {/* Mute */}
                        <Button
                            className={`h-9 w-9 ${mute && "bg-destructive hover:bg-destructive/90"}`}
                            onClick={() => {
                                if (connected) {
                                    toggleMute();
                                }
                            }}
                            disabled={!connected}
                        >
                            {mute ? <Icon.MicOff /> : <Icon.Mic />}
                        </Button>

                        {/* Deaf */}
                        <Button
                            className={`h-9 w-9 ${deaf && "bg-destructive hover:bg-destructive/90"}`}
                            onClick={() => {
                                if (connected) {
                                    toggleDeaf();
                                }
                            }}
                            disabled={!connected}
                        >
                            {deaf ? <Icon.HeadphoneOff /> : <Icon.Headphones />}
                        </Button>

                        {/* Stream */}
                        <Button
                            className={`h-9 w-9 ${stream && "bg-destructive hover:bg-destructive/90"}`}
                            onClick={() => {
                                if (connected) {
                                    toggleStream();
                                }
                            }}
                            disabled={!connected}
                        >
                            {stream ? <Icon.MonitorOff /> : <Icon.Monitor />}
                        </Button>
                    </div>

                    <p>ID: {callId || "None"}</p>
                    <p>Secret: {callSecret || "None"}</p>
                    <p>Ping: {clientPing}</p>
                    <p>Connected: {connected ? "true" : "false"}</p>
                    <p>Mute: {mute ? "true" : "false"}</p>
                    <p>Deaf: {deaf ? "true" : "false"}</p>
                    <p>Active Stream: {stream ? "true" : "false"}</p>
                    <p>All Streams: {JSON.stringify(getAllScreenStreams())}</p>
                    <p>Connected: {JSON.stringify(connectedUsers)}</p>
                    <p>Streaming: {JSON.stringify(streamingUsers)}</p>

                    {connectedUsers.map((id) => (
                        <div key={id}>
                            <Button
                                disabled={!streamingUsers.includes(id) || stream}
                                onClick={() => {
                                    createP2PConnection(id, true, true);
                                }}
                            >{id}</Button>
                        </div>
                    )
                    )}

                    {/* Calling */}
                </CardContent>
            </Card>
            <Card className="w-70">

            </Card>
        </div>
    )
}