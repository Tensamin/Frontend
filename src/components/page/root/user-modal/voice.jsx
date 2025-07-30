// Package Imports
import * as Icon from "lucide-react"

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils"

// Context Imports
import { useUsersContext } from "@/components/context/users"

// Components
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function VoiceControls() {
    let { currentCall, setCurrentCall, stopVoiceCall } = useUsersContext();

    function toggleMute() {
        if (currentCall.mute) {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                mute: false,
            }))
        } else {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                mute: true,
            }))
        }
    }

    function toggleDeaf() {
        if (currentCall.deaf) {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                deaf: false,
            }))
        } else {
            setCurrentCall((prevCall) => ({
                ...prevCall,
                deaf: true,
            }))
        }
    }

    return (
        <div className="flex gap-1">
            {/* Mute Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className={`${currentCall.mute ? "bg-destructive hover:bg-destructive/90" : ""}`}
                        onClick={() => {
                            toggleMute() // der aus Rainbow Six :)
                        }}
                    >
                        {currentCall.mute ? (
                            <Icon.MicOff />
                        ) : (
                            <Icon.Mic />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Toggle Mute</p>
                </TooltipContent>
            </Tooltip>

            {/* Deaf Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className={`${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}`}
                        onClick={() => {
                            toggleDeaf() // der aus Rainbow Six :)
                        }}
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

            {/* Copy Invite Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
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

            {/* Exit Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={() => {
                            stopVoiceCall()
                        }}
                    >
                        <Icon.X />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Exit Call</p>
                </TooltipContent>
            </Tooltip>
        </div>
    )
}