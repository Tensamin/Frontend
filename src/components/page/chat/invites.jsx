// Package Imports
import * as Icon from "lucide-react"

// Context Imports
import { usePageContext } from "@/components/context/page"

// Components
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardAction, CardDescription } from "@/components/ui/card"

export function CallInvite({ children }) {
    let { setPage } = usePageContext();

    let splitKids = children.props.children.split('\n')

    return (
        <Card className="flex w-80 mb-2 mt-3">
            <CardHeader>
                <CardAction>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                className="w-9 h-9"
                                onClick={() => {
                                    setPage({ name: "voice", data: JSON.stringify({ id: splitKids[0], secret: splitKids[1] }) })
                                }}
                            >
                                <Icon.DoorOpen />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Join</p>
                        </TooltipContent>
                    </Tooltip>
                </CardAction>
                <CardTitle>Call Invite</CardTitle>
                <CardDescription>{splitKids[0]}</CardDescription>
            </CardHeader>
        </Card>
    )
}