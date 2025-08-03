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
    // Force update function that triggers a re-render
    let forceUpdate = () => {
      setTick((t) => t + 1);
    };
    
    // Listen for remote stream changes to update UI
    window.addEventListener("remote-streams-changed", forceUpdate);
    
    // Set up a timer to periodically refresh the UI to ensure streams are displayed
    // Use a less frequent refresh (3000ms) to reduce console spam
    const refreshTimer = setInterval(forceUpdate, 3000);
    
    // Set up a check for connection state and stream validity
    const streamCheckTimer = setInterval(() => {
      if (typeof window !== "undefined" && window.getAllScreenStreams) {
        const streams = window.getAllScreenStreams();
        if (streams.length > 0) {
          console.log(`Periodic check: found ${streams.length} active screen streams`);
        }
      }
    }, 10000); // Check every 10 seconds instead of 3
    
    return () => {
      window.removeEventListener("remote-streams-changed", forceUpdate);
      clearInterval(refreshTimer);
      clearInterval(streamCheckTimer);
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

      {/* Remote Screen Shares */}
      <div className="flex-grow min-h-0 flex flex-col gap-2 h-full m-5">
        {typeof window !== "undefined" && window.getAllScreenStreams && (
          <>
            {/* Get streams and create a map */}
            {(() => {
              // Get all available screen streams
              const streams = window.getAllScreenStreams();
              
              // Create a Map of user ID to stream info
              const streamMap = new Map();
              
              // Process streams in a more detailed way
              streams.forEach(({ type, peerId, stream, endingSoon }) => {
                // For local streams, use the ownUuid
                const userId = type === 'local' ? ownUuid : (peerId || ownUuid);
                
                // Check if stream has active video tracks
                const videoTracks = stream.getVideoTracks();
                const hasActiveTracks = videoTracks.some(track => 
                  track.readyState === 'live' && track.enabled && !track.muted
                );
                
                // Store stream with metadata
                streamMap.set(userId, {
                  stream,
                  active: hasActiveTracks,
                  endingSoon: endingSoon || false,
                  type
                });
              });

              // Create combined items array (users and streams)
              const allItems = usersWithSelf.map(userId => {
                const hasStreamInfo = streamMap.has(userId);
                const streamInfo = hasStreamInfo ? streamMap.get(userId) : null;
                
                return {
                  id: userId,
                  isStreaming: hasStreamInfo && (streamInfo.active || streamInfo.endingSoon),
                  stream: hasStreamInfo ? streamInfo.stream : null,
                  endingSoon: hasStreamInfo ? streamInfo.endingSoon : false,
                  streamType: hasStreamInfo ? streamInfo.type : null
                };
              });

              // Separate focused and non-focused items
              const focusedItem = allItems.find(item => item.id === focused);
              const otherItems = allItems.filter(item => item.id !== focused);

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
                  <div className="grid grid-cols-3 gap-2">
                    {otherItems.map(item => (
                      <button
                        key={item.id}
                        className="w-[16rem] h-[9rem] relative"
                        onClick={() => {
                          setFocused(item.id)
                        }}
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