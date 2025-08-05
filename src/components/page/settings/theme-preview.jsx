// Package Imports
import * as Icon from "lucide-react";

// Components
import { Button } from "@/components/ui/button";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserModal } from "@/components/page/root/user-modal/main";

// Main
export function Preview({ style }) {
  return (
    <div className="w-full p-0 rounded-xl">
      <div
        // Preview Theme Provider
        className="h-full"
        style={style}
      >
        <div
          className="flex gap-2 p-2 pb-1 pr-1 h-full rounded-xl border-1"
          style={{
            backgroundColor: "var(--sidebar)",
            color: "var(--foreground)",
          }}
        >
          {/* Sidebar */}
          <div
            className="flex flex-col h-full w-20"
            style={{
              backgroundColor: "var(--sidebar)",
              color: "var(--foreground)",
            }}
          >
            <div className="scale-40 origin-top-left w-50 flex flex-col gap-7">
              <div className="border-1 bg-card rounded-xl flex flex-col">
                <SidebarMenuButton size="lg" asChild>
                  <UserModal
                    id="01984d57-c556-725b-82b5-cccbbe742117"
                    state="ONLINE"
                  />
                </SidebarMenuButton>
              </div>
              <div className="flex w-full justify-center rounded-full border-input border-1">
                <Button
                  className="rounded-full rounded-r-none w-1/2 border-0"
                  variant="outline"
                  disabled
                >
                  Communities
                </Button>
                <div className="h-9 w-0.5 bg-background flex items-center border-l-1 border-input" />
                <Button
                  className="rounded-full rounded-l-none w-1/2 border-0"
                  variant="outline"
                >
                  Chats
                </Button>
              </div>
            </div>
          </div>
          {/* Main Page & Navbar */}
          <div
            className="flex flex-col h-full w-full"
            style={{
              backgroundColor: "var(--sidebar)",
              color: "var(--foreground)",
            }}
          >
            <div
              className="origin-top-left scale-35 flex h-3"
              style={{
                backgroundColor: "var(--sidebar)",
                color: "var(--foreground)",
                width: "calc(100% / 0.35)",
              }}
            >
              {/* Navbar */}
              <div className="flex-1 flex items-center p-1.5 pr-0">
                <div className="bg-sidebar flex-1 flex items-center gap-3"
                  style={{
                    backgroundColor: "var(--sidebar)",
                    color: "var(--foreground)",
                  }}
                >
                  <Button className="w-9 h-9" variant="outline">
                    <Icon.Sidebar />
                  </Button>
                  <Button className="w-9 h-9" variant="outline">
                    <Icon.Settings />
                  </Button>
                  <div className="w-full" />
                  <Button className="w-9 h-9" variant="outline">
                    <Icon.House />
                  </Button>
                </div>
              </div>
            </div>
            <div
              className="h-full border-1 rounded-md border-card"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}