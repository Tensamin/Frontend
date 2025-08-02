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
import { RemoteStreamVideo } from "@/components/page/voice/controls";

// Main
export function Main() {
  let { currentCall, chatsArray, ownUuid } = useUsersContext();
  let [inviteOpen, setInviteOpen] = useState(false);
  let [usersWithSelf, setUsersWithSelf] = useState([]);
  let [focused, setFocused] = useState("01983d6c-fd9a-71ce-8826-8f18e0431a62")
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
    <div className="flex flex-col gap-1">
      {JSON.stringify(currentCall)}

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

      {/* Remote Screen Shares */}
      <div className="mt-2">
        {typeof window !== "undefined" &&
          window.getAllScreenStreams &&
          window.getAllScreenStreams().length > 0 && (
            <div className="flex flex-col gap-2 h-full">
              <h3 className="text-sm font-semibold">Active Screen Shares</h3>
              {window
                .getAllScreenStreams()
                .map(({ peerId, stream }) => {
                  let betterId = peerId || ownUuid;
                  return (
                    <div key={betterId} className="flex flex-col h-screen w-full align-middle justify-center">
                      <span className="mb-1 text-xs text-muted-foreground">
                        Screen from {betterId}
                      </span>
                      <RemoteStreamVideo stream={stream} className={`${focused === betterId ? "object-cover w-full h-full" : "w-[16rem] h-[9rem] rounded-2xl"} border-1`} />
                    </div>
                  )
                })}
            </div>
          )}
      </div>

      <div className="h-0 w-full border-t-1"></div>
      {usersWithSelf.map((user) => (
        <VoiceModal key={user} id={user} />
      ))}
    </div>
  );
}

function InviteItem({ id, onShouldClose }) {
  let [profile, setProfile] = useState(null);
  let { get, currentCall } = useUsersContext();
  let { encrypt_base64_using_pubkey } = useEncryptionContext();
  let { send } = useWebSocketContext();

  useEffect(() => {
    get(id).then(setProfile);
  }, [id, get]);

  let handleInvite = async () => {
    if (!profile || !profile.public_key) {
      log("User profile or public key not loaded yet.", "showError");
      return;
    }
    try {
      let data = await send(
        "call_invite",
        {
          message: `Invited ${id} to the call ${currentCall.id}`,
          log_level: 0,
        },
        {
          receiver_id: id,
          call_id: currentCall.id,
          call_secret: await encrypt_base64_using_pubkey(
            btoa(currentCall.secret),
            profile.public_key,
          ),
          call_secret_sha: await sha256(currentCall.secret),
        },
      );

      if (data.type !== "error") {
        log("Sent Invite", "success");
      } else {
        log(data.log.message, "showError");
      }
    } catch (error) {
      log(`Failed to send invite: ${error}`, "showError");
    } finally {
      onShouldClose(false);
    }
  };

  if (!profile) {
    return <CommandItem>Loading...</CommandItem>;
  }

  return (
    <CommandItem onSelect={handleInvite}>
      <p>{profile.display}</p>
    </CommandItem>
  );
}