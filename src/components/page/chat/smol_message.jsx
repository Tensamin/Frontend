// Package Imports
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import { Hourglass } from "ldrs/react";
import "ldrs/react/Hourglass.css";
import * as Icon from "lucide-react"

// Lib Imports
import { copyTextToClipboard } from "@/lib/utils"

// Components
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { MarkdownToReactComponents } from "@/components/page/chat/markdown";

// Main
export function SmolMessage({ message, sendToServer }) {
    let [showLoading, setShowLoading] = useState(false);
    
    let niceMessage = message.content.replace(/:/g, '\\:');

    useEffect(() => {
        if (sendToServer) {
            let opacityTimeout = setTimeout(() => setShowLoading(true), 2500);
            return () => clearTimeout(opacityTimeout);
        }
    }, [sendToServer]);

    return (
        <ContextMenu>
            <ContextMenuTrigger>
                <div className={`flex gap-2 text-foreground hover:bg-input/15 rounded-sm pl-1 ${sendToServer ? "opacity-50" : null}`}>
                    <div className="whitespace-pre-wrap w-full">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownToReactComponents}>
                            {niceMessage}
                        </ReactMarkdown>
                    </div>
                    <div className="pt-0.5">
                        {sendToServer ? (
                            <div
                                className={`h-full transition-opacity duration-500 ease-in-out ${sendToServer && showLoading ? 'opacity-100' : 'opacity-0'}`}
                            >
                                <Hourglass size={14} speed={2} color="var(--foreground)" />
                            </div>
                        ) : (
                            <div
                                className="invisible hover:visible h-full transition-opacity duration-500 ease-in-out"
                            >
                                <Icon.Ellipsis size={14} />
                            </div>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={() => {
                    copyTextToClipboard(message.content)
                }}>
                    <Icon.MessageSquareIcon /> Copy Message
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem>
                    <Icon.Reply /> Reply
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}