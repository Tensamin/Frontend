// Package Imports
import React, { useEffect, useState, useMemo, useCallback } from "react";
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
import { InviteItem, User } from "@/components/page/voice/parts";

// Constants
const UI_UPDATE_INTERVAL = 5000; // Reduced from 3000ms to 5000ms

// Main
export function Main() {
  const { currentCall, chatsArray, ownUuid } = useUsersContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [usersWithSelf, setUsersWithSelf] = useState([]);
  const [focused, setFocused] = useState(ownUuid);
  const [, setTick] = useState(0);

  // Memoized users list to prevent unnecessary re-renders
  const memoizedUsersWithSelf = useMemo(() => {
    const userSet = new Set(currentCall.users);
    userSet.add(ownUuid);
    return Array.from(userSet);
  }, [currentCall.users, ownUuid]);

  // Update users when call users change
  useEffect(() => {
    setUsersWithSelf(memoizedUsersWithSelf);
  }, [memoizedUsersWithSelf]);

  // Optimized force update function
  const forceUpdate = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Optimized UI update management
  useEffect(() => {
    // Listen for remote stream changes
    const handleStreamChange = () => forceUpdate();
    
    if (typeof window !== "undefined") {
      window.addEventListener("remote-streams-changed", handleStreamChange);
    }
    
    // Set up periodic refresh with longer interval to reduce performance impact
    const refreshTimer = setInterval(forceUpdate, UI_UPDATE_INTERVAL);
    
    // Optional: Log active streams less frequently
    const streamCheckTimer = setInterval(() => {
      if (typeof window !== "undefined" && window.getAllScreenStreams) {
        const streams = window.getAllScreenStreams();
        if (streams.length > 0) {
          console.log(`Active screen streams: ${streams.length}`);
        }
      }
    }, 15000); // Check every 15 seconds instead of 10
    
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("remote-streams-changed", handleStreamChange);
      }
      clearInterval(refreshTimer);
      clearInterval(streamCheckTimer);
    };
  }, [forceUpdate]);

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

        {/* Invite Button */}
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

      {/* Optimized Remote Screen Shares */}
      <div className="flex-grow min-h-0 flex flex-col gap-2 h-full m-5">
        <OptimizedStreamDisplay
          ownUuid={ownUuid}
          usersWithSelf={usersWithSelf}
          focused={focused}
          setFocused={setFocused}
        />
      </div>
    </div>
  );
}

// Optimized stream display component to prevent unnecessary re-renders
const OptimizedStreamDisplay = React.memo(({ ownUuid, usersWithSelf, focused, setFocused }) => {
  // Memoized stream processing
  const streamData = useMemo(() => {
    if (typeof window === "undefined" || !window.getAllScreenStreams) {
      return { focusedItem: null, otherItems: [] };
    }

    const streams = window.getAllScreenStreams();
    const streamMap = new Map();
    
    // Process streams efficiently
    streams.forEach(({ type, peerId, stream, endingSoon }) => {
      const userId = type === 'local' ? ownUuid : (peerId || ownUuid);
      
      // Check for active video tracks more efficiently
      const videoTracks = stream.getVideoTracks();
      const hasActiveTracks = videoTracks.length > 0 && videoTracks.some(track => 
        track.readyState === 'live' && track.enabled && !track.muted
      );
      
      streamMap.set(userId, {
        stream,
        active: hasActiveTracks,
        endingSoon: endingSoon || false,
        type
      });
    });

    // Create user items with stream info
    const allItems = usersWithSelf.map(userId => {
      const streamInfo = streamMap.get(userId);
      return {
        id: userId,
        isStreaming: streamInfo && (streamInfo.active || streamInfo.endingSoon),
        stream: streamInfo?.stream || null,
        endingSoon: streamInfo?.endingSoon || false,
        streamType: streamInfo?.type || null
      };
    });

    // Separate focused and other items
    const focusedItem = allItems.find(item => item.id === focused);
    const otherItems = allItems.filter(item => item.id !== focused);

    return { focusedItem, otherItems };
  }, [ownUuid, usersWithSelf, focused]);

  const { focusedItem, otherItems } = streamData;

  return (
    <>
      {/* Focused Item Display */}
      {focusedItem && (
        <div className="flex-grow min-h-0">
          <div className="w-full h-full relative">
            {focusedItem.isStreaming ? (
              <>
                <RemoteStreamVideo
                  stream={focusedItem.stream}
                  className="w-full h-full object-contain rounded-xl bg-input/20 border"
                />
                {focusedItem.endingSoon && (
                  <div className="absolute top-2 right-2 bg-destructive text-white px-2 py-1 rounded-md text-sm">
                    Stream Ended
                  </div>
                )}
                {focusedItem.streamType === 'local' && (
                  <div className="absolute bottom-2 left-2 bg-primary text-white px-2 py-1 rounded-md text-sm">
                    Your Screen
                  </div>
                )}
              </>
            ) : (
              <User
                id={focusedItem.id}
                className="w-full h-full object-contain border-1"
                avatarSize={50}
              />
            )}
          </div>
        </div>
      )}

      {/* Non-focused Items Grid */}
      {otherItems.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {otherItems.map(item => (
            <StreamItem
              key={item.id}
              item={item}
              onClick={() => setFocused(item.id)}
            />
          ))}
        </div>
      )}
    </>
  );
});

// Memoized stream item component
const StreamItem = React.memo(({ item, onClick }) => (
  <button
    className="w-[16rem] h-[9rem] relative"
    onClick={onClick}
  >
    {item.isStreaming ? (
      <>
        <RemoteStreamVideo
          stream={item.stream}
          className="w-full h-full object-cover rounded-2xl border"
        />
        {item.endingSoon && (
          <div className="absolute top-1 right-1 bg-destructive text-white px-1 py-0.5 rounded text-xs">
            Ended
          </div>
        )}
        {item.streamType === 'local' && (
          <div className="absolute bottom-1 left-1 bg-primary text-white px-1 py-0.5 rounded text-xs">
            You
          </div>
        )}
      </>
    ) : (
      <User
        id={item.id}
        className="w-full h-full object-cover rounded-2xl border"
        avatarSize={20}
      />
    )}
  </button>
));