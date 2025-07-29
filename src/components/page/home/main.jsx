// Package Imports
import { useState, useEffect } from "react"
import { v7 } from "uuid"

// Lib Imports
import { endpoint } from "@/lib/endpoints"
import { log, isUuid } from "@/lib/utils"
import { encrypt_base64_using_pubkey } from "@/lib/encryption"

// Context Imports
import { useWebSocketContext } from "@/components/context/websocket"
import { useMessageContext } from "@/components/context/messages"

// Components
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

// Main
export function Main() {
    let [open, setOpen] = useState(false)
    let [newChatUUID, setNewChatUUID] = useState("")
    let { send } = useWebSocketContext()

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

                await fetch(`${endpoint.user}${localStorage.getItem('uuid')}/public-key`)
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
                        message: `${localStorage.getItem('uuid')} sent ${newChatUUID} a friend request`,
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
        <div className="w-full h-full flex gap-5">
            <Card className="w-full h-full">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            role="combobox"
                            aria-expanded={open}
                            className="justify-between"
                        >
                            <Badge>
                                Add Chat
                            </Badge>
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Enter the UUID of the User</AlertDialogTitle>
                            <AlertDialogDescription>
                                <Input className="text-foreground" placeholder="00000000-0000-0000-0000-000000000000" value={newChatUUID} onChange={(e) => handleInputChange(e.target.value)} onSubmit={handleSubmit}></Input>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSubmit}>Add</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>
        </div>
    )
}