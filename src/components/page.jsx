"use client";

// Package Imports
import { useState, useEffect } from "react";

// Lib Imports
import ls from "@/lib/localStorageManager"

// Context Imports
import { usePageContext } from "@/components/context/page";
import { ActualThemeProvider } from "@/components/context/theme";
import { useUsersContext } from "@/components/context/users";

// Components
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner"
import { Navbar } from "@/components/page/root/navbar";
import { AppSidebar } from "@/components/page/root/sidebar";
import { Main as ChatMain } from "@/components/page/chat/main"
import { Main as HomeMain } from "@/components/page/home/main"
import { Main as SettingsMain } from "@/components/page/settings/main"
import { Main as VoiceMain } from "@/components/page/voice/main"
import { VoiceCall } from "@/components/page/voice/call"
import { GettingCalled } from "@/components/page/voice/active"

export function Page() {
    let [isVisible, setIsVisible] = useState(false);
    let { page } = usePageContext();
    let { shouldCreateCall } = useUsersContext();

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 1);

        return () => clearTimeout(timer);
    }, []);

    return (
        <ActualThemeProvider>
            <SidebarProvider className="bg-sidebar">
                <div className="flex flex-col w-screen h-screen overflow-hidden">
                    <div className="flex h-10">
                        <Navbar />
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {ls.get("sidebar_side") === "left" ? (
                            <AppSidebar />
                        ) : null}

                        <SidebarInset
                            className="border-1 border-card rounded-4xl m-2 flex flex-col flex-1 overflow-hidden"
                        >
                            <div className={`flex flex-col items-center gap-5 flex-1 overflow-auto p-5 h-full transition-all duration-175 ease-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                                <GettingCalled />
                                {page.name === "chat" ? (
                                    <ChatMain data={page.data} />
                                ) : null}
                                {page.name === "home" ? (
                                    <HomeMain data={page.data} />
                                ) : null}
                                {page.name === "settings" ? (
                                    <SettingsMain data={page.data} />
                                ) : null}
                                {page.name === "voice" ? (
                                    <VoiceMain data={page.data} />
                                ) : null}
                            </div>
                        </SidebarInset>

                        {ls.get("sidebar_side") === "right" ? (
                            <AppSidebar />
                        ) : null}
                    </div>
                </div>
            </SidebarProvider>
            <Toaster />
            {shouldCreateCall ? (
                <VoiceCall />
            ) : null}
        </ActualThemeProvider>
    )
};