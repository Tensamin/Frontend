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
import { VoiceModal } from "@/components/page/root/user-modal/main";

// Main
export function Main() {
    let { currentCall } = useUsersContext();
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
                <Button 
                    onClick={() => {

                    }}
                    className={`${currentCall.connected ? "" : "bg-destructive hover:bg-destructive/90"}`}
                >
                    {currentCall.connected ? (<><Icon.Wifi /> Connected</>) : (<><Icon.WifiOff /> Disconnected</>)}
                </Button>

                {/* Copy Invite Button */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            className="w-9 h-9"
                            onClick={() => {
                                copyTextToClipboard("```invite" + `\n${currentCall.id}\n${currentCall.secret}\n` + "```")
                            }}
                        >
                            <Icon.Clipboard />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Invite</p>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="w-full h-0 border-t-1"></div>
            {usersWithSelf.map((user) => (
                <VoiceModal key={user} id={user} />
            ))}
        </div>
    )
}