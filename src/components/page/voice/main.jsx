// Package Imports
import React, { useEffect, useState, useMemo, useCallback } from "react";
import * as Icon from "lucide-react";
import Image from "next/image"

// Lib Imports
import { convertDisplayNameToInitials } from "@/lib/utils"

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
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton";
import { InviteItem, VideoStream } from "@/components/page/voice/parts";

// Main
export function Main() {
  let { ownUuid, chatsArray } = useUsersContext();
  let { connected, connectedUsers, streamingUsers } = useCallContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [focused, setFocused] = useState("");

  return (
    <div className="flex flex-col gap-1 h-full w-full">
      <div className="flex gap-1 w-full justify-start">
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
      <div className="flex flex-col h-full w-full gap-5">
        {focused === "" ? (
          <>
            <div className="w-full h-full gap-5 p-5 overflow-hidden grid">
              {connectedUsers.map((user) => (
                <div key={user} className="">
                  <VoiceModal
                    id={user}
                    streams={streamingUsers.includes(user)}
                    onFocus={(focus) => {
                      if (focus) {
                        setFocused(user)
                      }
                    }}
                    focused
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div
              className="relative aspect-video overflow-hidden w-full h-full"
              key={focused}
            >
              <div className="absolute inset-0 h-full w-full object-contain">
                <VoiceModal
                  id={focused}
                  streams={streamingUsers.includes(focused)}
                  onFocus={(focus) => {
                    if (focus) {
                      setFocused("")
                    }
                  }}
                  focused
                />
              </div>
            </div>
            <div className="flex justify-center gap-2 w-full">
              {connectedUsers.map((user) => {
                return focused === user ? null : (
                  <div key={user} >
                    <VoiceModal
                      id={user}
                      streams={streamingUsers.includes(user)}
                      onFocus={(focus) => {
                        if (focus) {
                          setFocused(user)
                        }
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function VoiceModal({ id, streams = false, focused = false, onFocus }) {
  let [avatar, setAvatar] = useState("...");
  let [username, setUsername] = useState("...");
  let [display, setDisplay] = useState("...");
  let [loading, setLoading] = useState(true);
  let { get, ownUuid } = useUsersContext();
  let { watchingUsers, voiceSend } = useCallContext();

  useEffect(() => {
    if (id !== "") get(id)
      .then(data => {
        setAvatar(data.avatar);
        setUsername(data.username);
        setDisplay(data.display);
      });
  }, [id])

  return (
    <Card className={`w-auto p-2 rounded-3xl ${loading && "h-full"}`} >
      <div className={`flex flex-col gap-2 ${focused ? "w-full" : "w-[240px]"} ${loading && "h-full"}`}>
        {streams && id !== ownUuid || !focused ? (
          <>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 p-2 border rounded-2xl bg-input/30 border-input w-full">
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
                            setAvatar("")
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
                <div>
                  {display !== "..." ?
                    <p>{display}</p>
                    :
                    <Skeleton className="mr-20"><p className="invisible">🥴</p></Skeleton>
                  }
                </div>
              </div>
              <Button
                className="rounded-2xl h-auto w-"
                variant="outline"
                onClick={() => {
                  onFocus(true);
                }}
              >
                {focused ? <Icon.Shrink /> : <Icon.Expand />}
              </Button>
            </div>
            {streams && id !== ownUuid && (
              <div className={`${!focused && "h-[135px]"} ${loading && "h-full"}`}>
                {watchingUsers.includes(id) ? (
                  <>
                    {loading ? <Skeleton className="rounded-2xl border h-full" /> : null}
                    <VideoStream
                      className={`rounded-2xl border-1 ${loading && "hidden"}`}
                      id={id}
                      key={id}
                      onPlay={() => {
                        setLoading(false);
                      }}
                    />
                  </>
                ) : (
                  <Button
                    className="rounded-2xl border-1 w-full h-full text-2xl"
                    variant="outline"
                    onClick={() => {
                      onFocus(true);
                      voiceSend("watch_stream", {
                        message: `${ownUuid} wants to watch ${id}`,
                        log_level: 0,
                      }, {
                        want_to_watch: true,
                        receiver_id: id,
                      }, false);
                    }}
                  >
                    Watch Stream...
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <Button
            className="rounded-2xl w-full h-full flex justify-center items-center"
            variant="outline"
            onClick={() => {
              onFocus(true);
            }}
          >
            <div className="flex flex-col justify-center gap-5">
              {avatar !== "..." ? (
                <Avatar className="size-25 bg-background/10 border">
                  {avatar !== "" ? (
                    <Image
                      className="object-fill"
                      data-slot="avatar-image"
                      width={100}
                      height={100}
                      src={avatar}
                      alt=""
                      onError={() => {
                        setAvatar("")
                      }}
                    />
                  ) : null}
                  <AvatarFallback>
                    {convertDisplayNameToInitials(username)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Skeleton className="rounded-full size-25" />
              )}
              <div>
                {display !== "..." ?
                  <p className="text-2xl">{display}</p>
                  :
                  <Skeleton className="mr-20"><p className="invisible">🥴</p></Skeleton>
                }
              </div>
            </div>
          </Button>
        )}
      </div>
    </Card>
  )
}