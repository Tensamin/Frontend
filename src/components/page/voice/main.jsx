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
      <div className="flex">
        {connectedUsers.map((user) => (
          <button
            key={user}
            onClick={() => {
              setFocused(user)
            }}
          >
            <VoiceModal
              id={user}
              streams={streamingUsers.includes(user)}
              focused={focused === user}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

function VoiceModal({ id, streams = false, focused }) {
  let [avatar, setAvatar] = useState("...");
  let [username, setUsername] = useState("...");
  let [display, setDisplay] = useState("...");
  let { get, ownUuid } = useUsersContext();
  let { getScreenStream } = useCallContext();

  useEffect(() => {
    if (id !== "") get(id)
      .then(data => {
        setAvatar(data.avatar);
        setUsername(data.username);
        setDisplay(data.display);
      });
  }, [id])

  return (
    <Card className="p-2 w-auto rounded-3xl">
      <div className="flex flex-col gap-2">
        {streams && (
          <div className="w-[240px] h-[135px]">
            <VideoStream className="rounded-2xl border-1" peerConnection={id === ownUuid ? getScreenStream() : getScreenStream(id)} local={id === ownUuid} />
          </div>
        )}
        <div className="flex items-center gap-2 p-2 border-1 rounded-2xl bg-input/20">
          <div>
            {avatar !== "..." ? (
              <Avatar className="size-8 bg-accent/50">
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
      </div>
    </Card>
  )
}