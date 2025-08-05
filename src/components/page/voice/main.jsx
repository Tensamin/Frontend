// Package Imports
import React, { useEffect, useState, useMemo, useCallback } from "react";
import * as Icon from "lucide-react";

// Lib Imports
import { sha256, log } from "@/lib/utils";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useWebSocketContext } from "@/components/context/websocket";
import { useEncryptionContext } from "@/components/context/encryption";
import { useCallContext } from "@/components/context/call";

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
import { InviteItem, User } from "@/components/page/voice/parts";

// Main
export function Main() {
  let { ownUuid, chatsArray } = useUsersContext();
  let { connected } = useCallContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [focused, setFocused] = useState("");

  return (
    <div className="flex flex-col gap-1 h-full w-full">
      <div className="flex gap-1 w-full justify-start">
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
    </div>
  );
};