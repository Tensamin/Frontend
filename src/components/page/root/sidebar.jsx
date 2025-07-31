"use client";

// Package Imports
import { useState, useEffect } from "react";

// Lib Imports
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";

// Components
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserModal } from "@/components/page/root/user-modal/main"
import { Chats } from "@/components/page/root/chats"

// Main
export function AppSidebar(props) {
  let { get, forceLoad } = useUsersContext()
  let [username, setUsername] = useState("...")
  let [display, setDisplay] = useState("...")
  let [avatar, setAvatar] = useState("...")

  useEffect(() => {
    get(ls.get('uuid'))
      .then(data => {
        setUsername(data.username)
        setDisplay(data.display)
        setAvatar(data.avatar)
      })
  }, [])

  return (
    <Sidebar side={ls.get("sidebar_side") || "left"} variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="border-1 bg-card rounded-xl">
            <SidebarMenuButton size="lg" asChild>
              <UserModal
                display={display}
                username={username}
                avatar={avatar}
                status="ONLINE"
              />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu className="mt-3 pb-5">
          <SidebarMenuItem>
            <div className="flex w-full justify-center rounded-full bg-card">
              <Button className={`rounded-full rounded-r-none w-1/2 ${forceLoad ? "border-r-0" : ""}`} variant="outline" disabled={forceLoad}>
                Communities
              </Button>
              <Button className={`rounded-full rounded-l-none w-1/2 ${forceLoad ? "" : "border-l-0"}`} variant="outline" disabled={forceLoad}>
                Chats
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <Chats />
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
      </SidebarContent>
      <SidebarFooter>
      </SidebarFooter>
    </Sidebar>
  );
}