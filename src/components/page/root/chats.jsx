"use client";

// Package Imports
import Link from "next/link";
import { useEffect, useState } from "react";

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { log } from "@/lib/utils";

// Context Imports
import { useWebSocketContext } from "@/components/context/websocket";
import { useUsersContext } from "@/components/context/users";
import { usePageContext } from "@/components/context/page";

// Components
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  SmallUserModal,
  SmallUserModalSkeleton,
} from "@/components/page/root/user-modal/main";

// Main
export function Chats() {
  let {
    send,
    connected,
    identified,
  } = useWebSocketContext();
  let { chatsArray, setChatsArray, forceLoad } = useUsersContext();
  let [loading, setLoading] = useState(true);
  let [chats, setChats] = useState([])

  useEffect(() => {
    if (connected && identified) {
      send("get_chats", {
        log_level: 0,
        message: "Getting all chats",
      }, {})
        .then((data) => {
          if (data.type !== "error") {
            let sortedChats = data.user_ids.sort(
              (a, b) => b.last_message_at - a.last_message_at
            );
            setChatsArray(sortedChats);
            setLoading(false);
          } else {
            log(data.log.message, "showError");
            setLoading(false);
          }
        });
    }
  }, [connected, identified]);

  useEffect(() => {
    setChats(chatsArray)
  }, [chatsArray])

  return (
    <div className="flex flex-col gap-2">
      {forceLoad ? (
        <Chat chatsNotAllowed={true}/>
      ) : (
        <>
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <SidebarMenuItem key={`skeleton-${i}`}>
                <Button
                  className="w-full h-full p-1 pr-2.5 pl-0 rounded-2xl transition-all duration-200 ease-in-out"
                  variant="outline"
                >
                  <div
                    variant="outline"
                    className="w-full text-left justify-start"
                  >
                    <SmallUserModalSkeleton />
                  </div>
                </Button>
              </SidebarMenuItem>
            ))
          ) : (
            chats.map((chat) => (
              <SidebarMenuItem key={chat.user_id}>
                <Chat user_id={chat.user_id} />
              </SidebarMenuItem>
            ))
          )}
        </>
      )}
    </div>
  );
}

function Chat({ user_id, chatsNotAllowed = false }) {
  let { get, getUserState } = useUsersContext();
  let { setPage } = usePageContext();

  let [userData, setUserData] = useState(null);

  useEffect(() => {
    get(user_id).then(setUserData);
  }, [user_id]);

  return (
    <Button
      className="w-full h-full p-1 pr-2.5 pl-0 rounded-2xl transition-all duration-200 ease-in-out"
      variant="outline"
      onClick={() => {
        setPage({ name: "chat", data: user_id });
      }}
      disabled={chatsNotAllowed}
    >
      <div variant="outline" className="w-full text-left justify-start">
        {chatsNotAllowed ? (
          <SmallUserModal
            display="Debug Mode"
            username=""
            avatar="notAllowed"
            state="none"
            status="This page was force loaded."
            showIotaStatus={false}
          />
        ) : userData ? (
          <SmallUserModal
            display={userData.display}
            username={userData.username}
            avatar={userData.avatar}
            state={getUserState(user_id)}
            status={userData.status}
            showIotaStatus={true}
          />
        ) : (
          <SmallUserModalSkeleton />
        )}
      </div>
    </Button>
  );
}