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
import { RemoteStreamVideo, InviteItem, User } from "@/components/page/voice/call";

// Main
export function Main() {
  let { currentCall, chatsArray, ownUuid } = useUsersContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [usersWithSelf, setUsersWithSelf] = useState([]);
  let [focused, setFocused] = useState(ownUuid);
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
    <div className="flex flex-col gap-1 h-full w-full">
      <div className="flex gap-1 w-full justify-start">
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

      {/* Remote Screen Shares */}

      <div className="flex-grow min-h-0 flex flex-col gap-2 h-full m-5">
        {typeof window !== "undefined" && window.getAllScreenStreams && (
          <>
            {/* Get streams and create a map */}
            {(() => {
              const streams = window.getAllScreenStreams();
              const streamMap = new Map(streams.map(({ peerId, stream }) => [peerId || ownUuid, stream]));

              // Create combined items array (users and streams)
              const allItems = usersWithSelf.map(userId => ({
                id: userId,
                isStreaming: streamMap.has(userId),
                stream: streamMap.get(userId)
              }));

              // Separate focused and non-focused items
              const focusedItem = allItems.find(item => item.id === focused);
              const otherItems = allItems.filter(item => item.id !== focused);

              return (
                <>
                  {/* Focused Item Display */}
                  {focusedItem && (
                    <div className="flex-grow min-h-0">
                      <div className="w-full h-full">
                        {focusedItem.isStreaming ? (
                          <RemoteStreamVideo
                            stream={focusedItem.stream}
                            className="w-full h-full object-contain rounded-xl bg-input/20 border"
                          />
                        ) : (
                          <User
                            id={focusedItem.id}
                            className="w-full h-full object-contain border-1"
                            avatarSize={70}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Non-focused Items Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {otherItems.map(item => (
                      <button
                        key={item.id}
                        className="w-[16rem] h-[9rem]"
                        onClick={() => {
                          setFocused(item.id)
                        }}
                      >
                        {item.isStreaming ? (
                          <RemoteStreamVideo
                            stream={item.stream}
                            className="w-full h-full object-cover rounded-2xl border"
                          />
                        ) : (
                          <User
                            id={item.id}
                            className="w-full h-full object-cover rounded-2xl border"
                            avatarSize={20}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}