"use client";

// Package Imports
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

// Context Imports
import { ActualThemeProvider } from "@/components/context/theme";
import { WebSocketProvider } from "@/components/context/websocket";
import { MessageProvider } from "@/components/context/messages";
import { UsersProvider } from "@/components/context/users"
import { PageProvider } from "@/components/context/page";

// Components
import { Toaster } from "@/components/ui/sonner"
import { Loading } from "@/components/loading/content";

// Main
export function LoadingWrapper({ children }) {
    let [isAuthenticated, setIsAuthenticated] = useState(false);
    let [isLoading, setIsLoading] = useState(true);

    let router = useRouter();
    let pathname = usePathname();

    useEffect(() => {
        let passkey_id = localStorage.getItem("passkey_id");
        let private_key = localStorage.getItem("private_key");
        let uuid = localStorage.getItem("uuid");

        const authenticated = (passkey_id && private_key && uuid);
        setIsAuthenticated(authenticated);

        if (pathname === '/login') {
            setIsLoading(false);
            return;
        }

        if (!authenticated) {
            router.push('/login');
            setIsLoading(true);
            return;
        }
    }, [router, pathname]);

    useEffect(() => {
        if (pathname === '/login') {
            setIsLoading(false);
            return;
        }

        if (isAuthenticated) {
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }
    }, [isAuthenticated, pathname]);

    useEffect(() => {
        setInterval(() => {
            let warningMessage = `
  %cDO NOT PASTE ANYTHING IN HERE!
`, styles = [
                    'color: red; font-size: 20px; font-weight: bold;',
                ];

            if (localStorage.getItem("debug") !== "true") {
                console.warn(warningMessage, ...styles);
                console.log("Enabled debug mode to hide this warning.")
            }
        }, 3000)
    }, [])

    if (isLoading) {
        return <Loading />;
    }

    const commonProviders = (
        <ActualThemeProvider>
            {children}
            <Toaster />
        </ActualThemeProvider>
    );

    if (pathname === '/login') {
        return commonProviders;
    }

    if (isAuthenticated) {
        return (
            <UsersProvider>
                <WebSocketProvider>
                    <MessageProvider>
                        <PageProvider>
                            {commonProviders}
                        </PageProvider>
                    </MessageProvider>
                </WebSocketProvider>
            </UsersProvider>
        );
    }

    return null;
}