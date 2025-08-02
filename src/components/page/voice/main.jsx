// Package Imports
import React, { useEffect, useState } from "react";
import * as Icon from "lucide-react";

// Lib Imports
import { sha256, log } from "@/lib/utils";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useWebSocketContext } from "@/components/context/websocket";
import { useEncryptionContext } from "@/components/context/encryption";

// Components
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { VoiceModal } from "@/components/page/root/user-modal/main";
import { RemoteStreamVideo, InviteItem } from "@/components/page/voice/call";

// Main
export function Main() {
  let { currentCall, chatsArray, ownUuid, get } = useUsersContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [usersWithSelf, setUsersWithSelf] = useState([]);
  let [focused, setFocused] = useState("01983d6c-fd9a-71ce-8826-8f18e0431a62");
  let [, setTick] = useState(0);

  useEffect(() => {
    let userSet = new Set(currentCall.users);
    userSet.add(ownUuid);
    setUsersWithSelf(Array.from(userSet));
  }, [currentCall.users, ownUuid]);

  useEffect(() => {
    let forceUpdate = () => setTick((t) => t + 1);
    window.addEventListener("remote-streams-changed", forceUpdate);
    return () => {
      window.removeEventListener("remote-streams-changed", forceUpdate);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 h-full">

      {/* Remote Screen Shares */}
      <div className="mt-2 flex-grow min-h-0">
        {typeof window !== "undefined" &&
          window.getAllScreenStreams &&
          window.getAllScreenStreams().length > 0 && (
            <div className="flex flex-col gap-2 h-full">
              {window
                .getAllScreenStreams()
                .map(({ peerId, stream }) => {
                  let betterId = peerId || ownUuid;
                  
                  return (
                    <div
                      key={betterId}
                      className={`flex flex-col w-full ${focused === betterId ? 'flex-grow min-h-0' : ''}`}
                    >
                      <span className="mb-1 text-xs text-muted-foreground">
                        {betterId}
                      </span>
                      <div className={`${focused === betterId ? 'w-full h-full' : 'w-[16rem] h-[9rem]'}`}>
                        <RemoteStreamVideo
                          stream={stream}
                          className={`w-full h-full ${focused === betterId ? 'object-contain' : 'object-cover rounded-2xl border'}`}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
      </div>
      <div className="flex gap-1">
        <Button
          variant={currentCall.connected ? "default" : "destructive"}
          className={`gap-2 ${currentCall.connected ? "" : "bg-destructive hover:bg-destructive/90"}`}
        >
          {currentCall.connected ? (
            <>
              <Icon.Wifi /> Connected
            </>
          ) : (
            <>
              <Icon.WifiOff /> Disconnected
            </>
          )}
        </Button>

        {/* Copy Invite Button */}
        <Button
          className="h-9 gap-2"
          onClick={() => {
            setInviteOpen(true);
          }}
        >
          <Icon.Send /> Invite
        </Button>

        {/* Invite Popup */}
        <CommandDialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <CommandInput placeholder="Search for a Friend..." />
          <CommandList>
            <CommandEmpty>No friends to invite.</CommandEmpty>
            <CommandGroup>
              {chatsArray.map((chat) => (
                <InviteItem
                  id={chat.user_id}
                  key={chat.user_id}
                  onShouldClose={setInviteOpen}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>

      <div className="h-0 w-full border-t-1"></div>
      <div className="flex-shrink-0">
        {usersWithSelf.map((user) => (
          <VoiceModal key={user} id={user} />
        ))}
      </div>
    </div>
  );
}