// Package Imports
import * as Icon from "lucide-react"

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils"

// Context Imports
import { useUsersContext } from "@/components/context/users"
import { usePageContext } from "@/components/context/page"

// Components
import { Button } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Card } from "@/components/ui/card"

export function VoiceControls() {
    let { currentCall, setCurrentCall, stopVoiceCall } = useUsersContext();
    let { setPage } = usePageContext();

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
        <Card className="flex flex-row p-2 gap-1 w-full">
            {/* Expand */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className="w-9 h-9"
                        onClick={() => {
                            setPage({ name: "voice", data: "" })
                        }}
                    >
                        <Icon.Expand />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Expand</p>
                </TooltipContent>
            </Tooltip>

            {/* Mute Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className={`w-9 h-9 ${currentCall.mute ? "bg-destructive hover:bg-destructive/90" : ""}`}
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
                        className={`w-9 h-9 ${currentCall.deaf ? "bg-destructive hover:bg-destructive/90" : ""}`}
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

            {/* Exit Button */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        className="w-9 h-9 bg-destructive hover:bg-destructive/90"
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
        </Card>
    )
}