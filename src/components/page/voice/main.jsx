// Package Imports
import { useEffect, useState } from "react";
import * as Icon from "lucide-react"
import { toast } from "sonner"

// Lib Imports
import { copyTextToClipboard, sha256 } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useWebSocketContext } from "@/components/context/websocket";
import { useEncryptionContext } from "@/components/context/encryption";

// Components
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { SmallUserModal, VoiceModal, MiniUserModal } from "@/components/page/root/user-modal/main";

// Main
export function Main() {
    let { currentCall, chatsArray, ownUuid } = useUsersContext();

    let [inviteOpen, setInviteOpen] = useState(false);
    let [usersWithSelf, setUsersWithSelf] = useState([]);

    useEffect(() => {
        if (currentCall.users.length > 0) {
            setUsersWithSelf([currentCall.users, ownUuid])
        } else {
            setUsersWithSelf([ownUuid])
        }
    }, [currentCall.users])

    return (
        <div className="flex flex-col gap-1">
            {JSON.stringify(currentCall)}

            <div className="flex gap-1">

                {/* Connection Status Button */}
                <Button className={`${currentCall.connected ? "" : "bg-destructive hover:bg-destructive/90"}`}>
                    {currentCall.connected ? (<><Icon.Wifi /> Connected</>) : (<><Icon.WifiOff /> Disconnected</>)}
                </Button>

                {/* Copy Invite Button */}
                <Button
                    className="h-9"
                    onClick={() => {
                        setInviteOpen(true);
                    }}
                >
                    <Icon.Send /> Invite
                </Button>

                {/* Invite Popup */}
                <CommandDialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <CommandInput placeholder="Search for a Friend..." />
                    <CommandList>
                        <CommandEmpty>No friends to invite.</CommandEmpty>
                        <CommandGroup>
                            {chatsArray.map((chat) => (
                                <InviteItem id={chat.user_id} key={chat.user_id} onShouldClose={setInviteOpen} />
                            ))}
                        </CommandGroup>
                    </CommandList>
                </CommandDialog>
            </div>
            <div className="w-full h-0 border-t-1"></div>
            {usersWithSelf.map((user) => (
                <VoiceModal key={user} id={user} />
            ))}
        </div>
    )
}

function InviteItem({ id, onShouldClose }) {
    let [display, setDisplay] = useState("...");
    let [username, setUsername] = useState("...");
    let [avatar, setAvatar] = useState("...");
    let [publicKey, setPublicKey] = useState("...");
    let [loading, setLoading] = useState(true);

    let { get, currentCall } = useUsersContext();
    let { encrypt_base64_using_pubkey } = useEncryptionContext();
    let { send } = useWebSocketContext();

    useEffect(() => {
        get(id)
            .then(data => {
                setDisplay(data.display);
                setUsername(data.username);
                setAvatar(data.avatar);
                setPublicKey(data.public_key);
                setLoading(false);
            })
    }, [id])

    return (
        <div
            onClick={async () => {
                send("call_invite", {
                    message: `Invited ${id} to the call ${currentCall.id}`,
                    log_level: 0,
                }, {
                    receiver_id: id,
                    call_id: currentCall.id,
                    call_secret: await encrypt_base64_using_pubkey(btoa(currentCall.secret), publicKey),
                    call_secret_sha: await sha256(currentCall.secret),
                })
                onShouldClose(false)
            }}
        >
            <CommandItem>
                <p>{display}</p>
                {/*<MiniUserModal
                    display={display}
                    username={username}
                    avatar={avatar}
                    loading={loading}
                />*/}
            </CommandItem>
        </div>
    )
}