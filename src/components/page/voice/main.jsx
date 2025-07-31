// Package Imports
import { useEffect, useState } from "react";
import * as Icon from "lucide-react"

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";

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
    let { currentCall, chatsArray, get } = useUsersContext();

    let [inviteOpen, setInviteOpen] = useState(false);
    let [usersWithSelf, setUsersWithSelf] = useState([])

    useEffect(() => {
        if (currentCall.users.length > 0) {
            setUsersWithSelf([currentCall.users, ls.get("uuid")])
        } else {
            setUsersWithSelf([ls.get("uuid")])
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
                        <CommandEmpty>No friend found.</CommandEmpty>
                        <CommandGroup heading="Friends">
                            {chatsArray.map((chat) => (
                                <InviteItem id={chat.user_id} key={chat.user_id} />
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
        <CommandItem
            onClick={() => {

            }}
        >
            <MiniUserModal
                display={profile.display}
                username={profile.username}
                avatar={profile.avatar}
            />
        </CommandItem>
    ) : null
}