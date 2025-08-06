// Package Imports
import React, { useEffect, useState, useMemo, useCallback } from "react";
import * as Icon from "lucide-react";
import Image from "next/image";

// Lib Imports
import { convertDisplayNameToInitials } from "@/lib/utils";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useCallContext } from "@/components/context/call";

// Components
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteItem, VideoStream } from "@/components/page/voice/parts";

// Main
export function Main() {
  let { ownUuid, chatsArray } = useUsersContext();
  let { connected, connectedUsers, streamingUsers } = useCallContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [focused, setFocused] = useState("");

  return (
    <div className="flex flex-col h-full w-full gap-4">
      <div className="flex gap-2 w-full">
        {/* Connection Status Button */}
        <Button
          className={`gap-2 ${connected ? "" : "bg-destructive hover:bg-destructive/90"}`}
        >
          {connected ? (
            <>
              <Icon.Wifi /> Connected
            </>
          ) : (
            <>
              <Icon.WifiOff /> Disconnected
            </>
          )}
        </Button>

        {/* Invite Button */}
        <Button
          className="h-9 gap-2"
          onClick={() => {
            setInviteOpen(true);
          }}
          disabled={!connected}
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
      
      <div className="flex flex-col flex-1 w-full">
        {focused === "" ? (
          <div className={`
            ${connectedUsers.length > 1 ? 
            "grid grid-cols-"+Math.round(Math.sqrt(connectedUsers.length)+0.5) : ""}
            gap-4 p-4 h-full overflow-auto
          `}>
            
            {connectedUsers.map((user) => (
              <div key={user} className="h-full">
                <VoiceModal
                  id={user}
                  streams={streamingUsers.includes(user)}
                  onFocus={(focus) => {
                    if (focus) {
                      setFocused(user);
                    }
                  }}
                  focused={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="flex-1 w-full" key={focused}>
              <VoiceModal
                id={focused}
                streams={streamingUsers.includes(focused)}
                onFocus={(focus) => {
                  if (focus) {
                    setFocused("");
                  }
                }}
                focused={true}
              />
            </div>
            <div className="flex gap-2 w-full overflow-x-auto p-2">
              {connectedUsers.map((user) => {
                return focused === user ? null : (
                  <div key={user} className="flex-shrink-0">
                    <VoiceModal
                      id={user}
                      streams={streamingUsers.includes(user)}
                      onFocus={(focus) => {
                        if (focus) {
                          setFocused(user);
                        }
                      }}
                      focused={false}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VoiceModal({ id, streams = false, focused = false, onFocus }) {
  let [avatar, setAvatar] = useState("...");
  let [username, setUsername] = useState("...");
  let [display, setDisplay] = useState("...");
  let [loading, setLoading] = useState(true);
  let { get, ownUuid } = useUsersContext();
  let { watchingUsers, voiceSend } = useCallContext();

  useEffect(() => {
    if (id !== "") {
      setLoading(true);
      get(id).then((data) => {
        setAvatar(data.avatar);
        setUsername(data.username);
        setDisplay(data.display);
      });
    }
  }, [id, get]);

  return (
    <Card
      className={`p-3 rounded-2xl flex flex-col ${
        focused ? "w-full h-full" : "w-[240px] h-[200px]"
      }`}
    >
      <div className="flex flex-col h-full gap-2">
        {streams && id !== ownUuid ? (
          <>
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-2 p-2 border rounded-xl bg-input/30 border-input flex-1 min-w-0">
                <div>
                  {avatar !== "..." ? (
                    <Avatar className="size-8 bg-accent border">
                      {avatar !== "" ? (
                        <Image
                          className="object-fill"
                          data-slot="avatar-image"
                          width={100}
                          height={100}
                          src={avatar}
                          alt=""
                          onError={() => {
                            setAvatar("");
                          }}
                        />
                      ) : null}
                      <AvatarFallback>
                        {convertDisplayNameToInitials(username)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Skeleton className="rounded-full size-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {display !== "..." ? (
                    <p className="truncate">{display}</p>
                  ) : (
                    <Skeleton className="w-20 h-4" />
                  )}
                </div>
              </div>
              <Button
                className="rounded-xl h-auto p-2"
                variant="outline"
                onClick={() => {
                  onFocus(true);
                }}
              >
                {focused ? <Icon.Shrink /> : <Icon.Expand />}
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              {watchingUsers.includes(id) ? (
                <>
                  {loading && <Skeleton className="rounded-xl border w-full h-full" />}
                  <VideoStream
                    className={`rounded-xl border w-full h-full ${loading ? "hidden" : ""}`}
                    id={id}
                    key={id}
                    onPlay={() => {
                      setLoading(false);
                    }}
                  />
                </>
              ) : (
                <Button
                  className="rounded-xl border w-full h-full flex items-center justify-center text-lg"
                  variant="outline"
                  onClick={() => {
                    onFocus(true);
                    voiceSend(
                      "watch_stream",
                      {
                        message: `${ownUuid} wants to watch ${id}`,
                        log_level: 0,
                      },
                      {
                        want_to_watch: true,
                        receiver_id: id,
                      },
                      false
                    );
                  }}
                >
                  Watch Stream...
                </Button>
              )}
            </div>
          </>
        ) : (
          <Button
            className="rounded-xl w-full h-full flex flex-col items-center justify-center gap-4"
            variant="outline"
            onClick={() => {
              onFocus(true);
            }}
          >
            <div className="flex flex-col items-center gap-4">
              {avatar !== "..." ? (
                <Avatar className="size-16 bg-background/10 border">
                  {avatar !== "" ? (
                    <Image
                      className="object-fill"
                      data-slot="avatar-image"
                      width={100}
                      height={100}
                      src={avatar}
                      alt=""
                      onError={() => {
                        setAvatar("");
                      }}
                    />
                  ) : null}
                  <AvatarFallback>
                    {convertDisplayNameToInitials(username)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Skeleton className="rounded-full size-16" />
              )}
              <div>
                {display !== "..." ? (
                  <p className="text-xl truncate max-w-[200px]">{display}</p>
                ) : (
                  <Skeleton className="w-32 h-6" />
                )}
              </div>
            </div>
          </Button>
        )}
      </div>
    </Card>
  );
}