// Package Imports
import * as Icon from "lucide-react";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Lib Imports
import { cn, sha256, log } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { usePageContext } from "@/components/context/page";
import { useMessageContext } from "@/components/context/messages";
import { useUsersContext } from "@/components/context/users";
import { useThemeProvider } from "@/components/context/theme";
import { useEncryptionContext } from "@/components/context/encryption";
import { useWebSocketContext } from "@/components/context/websocket";

// Components
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";

// Framer Motion stuff
let containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
        },
    },
}

let itemVariants = {
    hidden: { y: -20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0, transition: { duration: 0.2 } },
}

// Main
export function Navbar() {
    let { sidebarRightSide } = useThemeProvider();
    let { get, startVoiceCall, currentCall } = useUsersContext();
    let { open } = useSidebar();
    let { setPage } = usePageContext();
    let { failedMessages, navbarLoading, navbarLoadingMessage, receiver } = useMessageContext();
    let { encrypt_base64_using_pubkey } = useEncryptionContext();
    let { send } = useWebSocketContext();

    let [receiverDisplay, setReceiverDisplay] = useState("")

    useEffect(() => {
        if (receiver !== "") {
            get(receiver)
                .then(data => {
                    setReceiverDisplay(data.display)
                })
        } else {
            setReceiverDisplay("")
        }
    }, [receiver])

    return (
        <div className="flex-1 flex items-center p-1.5 pb-0">
            {!sidebarRightSide ? (
                <div
                    className={cn(
                        "bg-sidebar hidden md:block transition-all duration-300",
                        open ? "w-[var(--sidebar-width)]" : "w-0"
                    )}
                />
            ) : null}
            <motion.div
                className="bg-sidebar flex-1 flex items-center gap-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div layout="position" variants={itemVariants}>
                    <SidebarTrigger className="w-9 h-9" />
                </motion.div>

                <motion.div layout="position" variants={itemVariants}>
                    <Button
                        className="w-9 h-9"
                        variant="outline"
                        onClick={() => setPage({ name: "home", data: "" })}
                    >
                        <Icon.House />
                    </Button>
                </motion.div>

                <motion.div layout="position" variants={itemVariants}>
                    <Button
                        className="w-9 h-9"
                        variant="outline"
                        onClick={() => setPage({ name: "settings", data: "" })}
                    >
                        <Icon.Settings />
                    </Button>
                </motion.div>

                <AnimatePresence>
                    {receiverDisplay !== "" && (
                        <motion.div
                            layout="position"
                            key="receiver-display"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <p className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                {receiverDisplay}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div layout className="w-full" variants={itemVariants} />

                <AnimatePresence>
                    {navbarLoading && (
                        <motion.div
                            layout="position"
                            key="loading-indicator"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <HoverCard>
                                <HoverCardTrigger asChild>
                                    <Button className="w-9 h-9" variant="outline">
                                        <Ring
                                            size="16"
                                            stroke="2"
                                            bgOpacity="0"
                                            speed="2"
                                            color="var(--foreground)"
                                        />
                                    </Button>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                    <p className="text-sm">{navbarLoadingMessage}</p>
                                </HoverCardContent>
                            </HoverCard>
                        </motion.div>
                    )}
                    {failedMessages > 0 && (
                        <motion.div
                            layout="position"
                            key="failed-messages-indicator"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <HoverCard>
                                <HoverCardTrigger asChild>
                                    <Button
                                        className="w-9 h-9 text-destructive"
                                        variant="outline"
                                    >
                                        <Icon.TriangleAlert />
                                    </Button>
                                </HoverCardTrigger>
                                <HoverCardContent>
                                    <p className="text-sm text-destructive">
                                        Failed to load {failedMessages}{" "}
                                        {failedMessages === 1 ? "message" : "messages"}.
                                    </p>
                                </HoverCardContent>
                            </HoverCard>
                        </motion.div>
                    )}
                    {receiver !== "" && (
                        <motion.div
                            layout="position"
                            key="call-button"
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <Button
                                className="w-9 h-9"
                                variant="outline"
                                onClick={async () => {
                                    await startVoiceCall(undefined, undefined)
                                    send("call_invite", {
                                        message: `Invited ${receiver} to the call ${currentCall.receiver}`,
                                        log_level: 0,
                                    }, {
                                        receiver_id: receiver,
                                        call_id: currentCall.id,
                                        call_secret: await encrypt_base64_using_pubkey(btoa(currentCall.secret), await get(receiver).then(a => {return a.public_key})),
                                        call_secret_sha: await sha256(currentCall.secret),
                                    })
                                    .then(data => {
                                        if (data.type === "error") {
                                            log(data.log.message, "showError")
                                        }
                                    })
                                }}
                            >
                                <Icon.PhoneCall />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
            {sidebarRightSide ? (
                <div
                    className={cn(
                        "bg-sidebar hidden md:block transition-all duration-300",
                        open ? "w-[var(--sidebar-width)]" : "w-0"
                    )}
                />
            ) : null}
        </div>
    )
}