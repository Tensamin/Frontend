// Package Imports
import * as Icon from "lucide-react"
import { useEffect, useState } from "react"

// Lib Imports
import { sha256 } from "@/lib/encryption"
import { isUuid } from "@/lib/utils"

// Context Imports
import { usePageContext } from "@/components/context/page"
import { useWebSocketContext } from "@/components/context/websocket"
import { useUsersContext } from "@/components/context/users"

// Components
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardAction, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function CallInvite({ data }) {
    let { startVoiceCall } = useUsersContext();
    let { setPage } = usePageContext();
    let { send } = useWebSocketContext();
    let [splitData, setSplitData] = useState(["", ""]);
    let [invalid, setInvalid] = useState(false)

    // Alex macht Call Invite design

    let [callState, setCallState] = useState("")
    let [connectedUsers, setConnectedUsers] = useState([])
    let [startDate, setStartDate] = useState("")
    let [endDate, setEndDate] = useState("")
    let [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            let tmpSplitData = data.split('\n')
            if (isUuid(tmpSplitData[0]) && isUuid(tmpSplitData[0])) {
                setSplitData(tmpSplitData)
            } else {
                setSplitData(["Invalid Invite", ""])
                setInvalid(true)
            }
        } catch (err) {
            setSplitData(["Invalid Invite", ""])
            setInvalid(true)
        }
    }, [])

    useEffect(() => {
        if (isUuid(splitData[0]) && isUuid(splitData[1])) {
            async function asyncSend() {
                send("get_call", {
                    message: `Getting call information for ${splitData[0]}`,
                    log_level: 0
                }, {
                    call_id: splitData[0],
                    call_secret_sha: await sha256(splitData[1])
                })
                    .then(data => {
                        setCallState(data.data.call_state)
                        if (data.data.call_state === "active") {
                            setConnectedUsers(data.data.user_ids)
                            setStartDate(data.data.start_date)
                        } else if (data.data.call_state === "inactive") {
                            setEndDate(data.data.end_date)
                        }
                        setLoading(false);
                    })
            }
            asyncSend()
        }
    }, [splitData])

    let CoolButton = () => {
        if (loading) {
            return (
                <Skeleton className="w-9 h-9" />
            )
        } else {
            return (
                <Button
                    disabled={invalid || callState === "DESTROYED" || callState === "INACTIVE"}
                    className={`w-9 h-9 ${invalid ? "bg-destructive" : ""}`}
                    onClick={() => {
                        startVoiceCall(splitData[0], splitData[1]);
                    }}
                >
                    <Icon.DoorOpen />
                </Button>
            )
        }
    }

    return (
        <Card
            className={`flex w-90 mb-2 mt-3 font-sans ${callState === "DESTROYED" || callState === "INACTIVE" ? "opacity-50" : ""}`}
            disabled={callState === "DESTROYED"}
        >
            <CardHeader>
                <CardAction>
                    {!invalid ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <CoolButton />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Join</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <CoolButton />
                    )}
                </CardAction>
                <CardTitle>{loading ? (
                    <Skeleton className="mr-40"><p className="invisible">🥴</p></Skeleton>
                ) : "Call Invite"}</CardTitle>
                <CardDescription className="text-xs">{loading ? (
                    <Skeleton className="mr-4"><p className="invisible">🥴</p></Skeleton>
                ) : splitData[0]}</CardDescription>
            </CardHeader>
        </Card>
    )
}