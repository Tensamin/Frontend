// Package Imports
import React, { useEffect, useState, useRef } from "react"; // Added useRef
import * as Icon from "lucide-react";
import { toast } from "sonner";

// Lib Imports
import { copyTextToClipboard, sha256, log } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useUsersContext } from "@/components/context/users";
import { useWebSocketContext } from "@/components/context/websocket";
import { useEncryptionContext } from "@/components/context/encryption";

// Components
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  SmallUserModal,
  VoiceModal,
  MiniUserModal,
} from "@/components/page/root/user-modal/main";
import ScreenShare from "./screen-share.jsx";

// This new component renders a video stream onto a canvas.
// By using a canvas, we can ensure that the last successfully received frame
// remains visible if the stream temporarily stalls or drops a frame,
// preventing a flicker or a blank screen.
function RemoteStreamVideo({ stream }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    // Ensure we have a stream and a canvas element to draw on.
    if (!stream || !canvasRef.current) return;

    // We use an in-memory video element to process the stream.
    // It does not need to be added to the DOM to be played.
    const videoElement = document.createElement("video");
    videoRef.current = videoElement;

    videoElement.srcObject = stream;
    videoElement.playsInline = true;
    videoElement.muted = true; // Audio is handled separately in your app
    videoElement.play().catch((error) => {
      // Autoplay can sometimes be blocked by the browser.
      log(`Video play failed for stream ${stream.id}: ${error}`, "showError");
    });

    const canvasElement = canvasRef.current;
    const context = canvasElement.getContext("2d");
    let animationFrameId;

    const renderFrame = () => {
      // Stop the loop if the component has unmounted
      if (!videoRef.current) return;

      // readyState >= 2 (HAVE_CURRENT_DATA) means there's a frame to display.
      if (videoElement.readyState >= 2) {
        // Ensure canvas dimensions match the video to avoid stretching.
        if (canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
        }
        if (canvasElement.height !== videoElement.videoHeight) {
          canvasElement.height = videoElement.videoHeight;
        }
        // Draw the current video frame onto the canvas.
        // If the stream stalls, the video element holds the last rendered frame.
        // This loop will continue to draw that last frame, creating the
        // illusion of a frozen image instead of a blank screen.
        context.drawImage(
          videoElement,
          0,
          0,
          canvasElement.width,
          canvasElement.height,
        );
      }
      // Continue the loop for the next frame.
      animationFrameId = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    // Cleanup function to run when the component unmounts or the stream changes.
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (videoRef.current) {
        // Stop all tracks in the stream to release camera/screen resources.
        const tracks = videoRef.current.srcObject?.getTracks();
        tracks?.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
        videoRef.current = null;
      }
    };
  }, [stream]); // This effect re-runs if the stream prop changes.

  // The canvas is what the user sees, providing a resilient display.
  return <canvas ref={canvasRef} className="w-full max-w-md rounded border" />;
}

// Main
export function Main() {
  let { currentCall, chatsArray, ownUuid } = useUsersContext();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [usersWithSelf, setUsersWithSelf] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  useEffect(() => {
    if (currentCall.users.length > 0) {
      setUsersWithSelf([currentCall.users, ownUuid]);
    } else {
      setUsersWithSelf([ownUuid]);
    }
  }, [currentCall.users]);

  // Handlers for screen sharing
  const handleScreenShareStart = (stream) => {
    setIsSharing(true);
    setScreenStream(stream);
    if (typeof window !== "undefined" && window.setScreenShareStream) {
      window.setScreenShareStream(stream);
    }
  };
  const handleScreenShareStop = () => {
    setIsSharing(false);
    setScreenStream(null);
    if (typeof window !== "undefined" && window.clearScreenShareStream) {
      window.clearScreenShareStream();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {JSON.stringify(currentCall)}

      <div className="flex gap-1">
        {/* Connection Status Button */}
        <Button
          className={`${
            currentCall.connected
              ? ""
              : "bg-destructive hover:bg-destructive/90"
          }`}
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
          className="h-9"
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

      {/* Screen Sharing UI */}
      <div className="mt-2">
        <ScreenShare
          onStart={handleScreenShareStart}
          onStop={handleScreenShareStop}
          isSharing={isSharing}
        />
      </div>

      {/* Remote Screen Shares */}
      <div className="mt-2">
        {typeof window !== "undefined" &&
          window.getRemoteScreenStreams &&
          window.getRemoteScreenStreams().length > 0 && (
            <div className="flex flex-col gap-2">
              {window
                .getRemoteScreenStreams()
                .map(({ peerId, stream }) => (
                  <div key={peerId} className="flex flex-col items-center">
                    <span className="text-xs text-muted-foreground mb-1">
                      Screen from {peerId}
                    </span>
                    {/*
                      FIX: Replaced the <video> element with the new RemoteStreamVideo
                      component. This component uses a canvas to render the video,
                      which prevents a blank screen on frame drops by holding the
                      last good frame.
                    */}
                    <RemoteStreamVideo stream={stream} />
                  </div>
                ))}
            </div>
          )}
      </div>

      <div className="w-full h-0 border-t-1"></div>
      {usersWithSelf.map((user) => (
        <VoiceModal key={user} id={user} />
      ))}
    </div>
  );
}

function InviteItem({ id, onShouldClose }) {
  let [display, setDisplay] = useState("...");
  let [username, setUsername] = useState("...");
  let [avatar, setAvatar] = useState("...");
  let [publicKey, setPublicKey] = useState("...");
  let [loading, setLoading] = useState(true);

  let { get, currentCall } = useUsersContext();
  let { encrypt_base64_using_pubkey } = useEncryptionContext();
  let { send } = useWebSocketContext();

  useEffect(() => {
    get(id).then((data) => {
      setDisplay(data.display);
      setUsername(data.username);
      setAvatar(data.avatar);
      setPublicKey(data.public_key);
      setLoading(false);
    });
  }, [id]);

  return (
    <div
      onClick={async () => {
        send(
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
              publicKey,
            ),
            call_secret_sha: await sha256(currentCall.secret),
          },
        ).then((data) => {
          if (data.type !== "error") {
            log("Sent Invite", "success");
          } else {
            log(data.log.message, "showError");
          }
        });
        onShouldClose(false);
      }}
    >
      <CommandItem>
        <p>{display}</p>
        {/*<MiniUserModal
                    display={display}
                    username={username}
                    avatar={avatar}
                    loading={loading}
                />*/}
      </CommandItem>
    </div>
  );
}