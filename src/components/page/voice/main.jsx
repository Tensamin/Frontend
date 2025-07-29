"use client";

// Package Imports
import { useState, useEffect, useRef, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import * as Icon from "lucide-react";
import { toast } from "sonner";

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { log as logFunction } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/utils";
import {
  decrypt_base64_to_blob_using_aes,
  encrypt_blob_to_base64_using_aes,
} from "@/lib/encryption";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useUsersContext } from "@/components/context/users";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Main({ data }) {
  // State
  let [isRecording, setIsRecording] = useState(false);
  let [recording, setRecording] = useState(false);
  let [identified, setIdentified] = useState(false);
  let [encodingInfo, setEncodingInfo] = useState("");
  let [unsupported, setUnsupported] = useState(false);

  // Context
  let { privateKeyHash } = useCryptoContext();
  let { voiceStatus, setVoiceStatus } = useUsersContext();

  // Refs
  let mediaRecorderRef = useRef(null);
  let audioStreamRef = useRef(null);
  let audioPlaybackRef = useRef(null);
  let mediaSourceRef = useRef(null);
  let sourceBufferRef = useRef(null);
  let queueRef = useRef([]);

  const mime = "audio/webm;codecs=opus";

  function send(data) {
    if (data.type !== "ping") {
      logFunction(data, "debug", "Voice WebSocket (Sent):");
    }
    sendMessage(JSON.stringify(data));
  }

  // Recording functions
  let startRecording = async () => {
    if (isRecording || !connected) {
      return {
        success: false,
        message: isRecording
          ? "Already recording"
          : !connected
            ? "Not connected to a WebSocket"
            : "Unknown error",
      };
    }

    try {
      let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let selectedMimeType = "audio/webm;codecs=opus";

      if (!MediaRecorder.isTypeSupported(selectedMimeType)) {
        setUnsupported(true);
      }

      let options = {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 16000,
      };

      mediaRecorderRef.current = new MediaRecorder(stream, options);

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0 && readyState === ReadyState.OPEN) {
          sendMessage(await encrypt_blob_to_base64_using_aes(event.data, data));
        }
      };

      mediaRecorderRef.current.start(20);
      setIsRecording(true);
      // For the future when more mime types are supported
      setEncodingInfo(selectedMimeType);
      return { success: true };
    } catch (error) {
      console.error("Error starting recording:", error);
      return { success: false, message: error.message };
    }
  };

  let stopRecording = () => {
    if (!isRecording) return;

    mediaRecorderRef.current?.stop();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    console.log("Recording stopped");
  };

  // Setup MediaSource for playback
  useEffect(() => {
    const audio = audioPlaybackRef.current;
    if (!audio) return;

    if (!("MediaSource" in window) || !MediaSource.isTypeSupported(mime)) {
      setUnsupported(true);
      console.error("MediaSource or mime type not supported");
      return;
    }

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    const objectURL = URL.createObjectURL(mediaSource);
    audio.src = objectURL;

    const onSourceOpen = () => {
      const sourceBuffer = mediaSource.addSourceBuffer(mime);
      sourceBufferRef.current = sourceBuffer;
      sourceBuffer.mode = "sequence";

      sourceBuffer.addEventListener("updateend", () => {
        if (queueRef.current.length > 0 && !sourceBuffer.updating) {
          sourceBuffer.appendBuffer(queueRef.current.shift());
        }
      });
    };

    mediaSource.addEventListener("sourceopen", onSourceOpen);

    return () => {
      mediaSource.removeEventListener("sourceopen", onSourceOpen);
      if (mediaSource.readyState === "open") {
        mediaSource.endOfStream();
      }
      URL.revokeObjectURL(objectURL);
      queueRef.current = [];
    };
  }, []);

  // Handle WebSocket messages
  let handleWebSocketMessage = useCallback(
    async (event) => {
      if (event.data.startsWith("{")) {
        let message = JSON.parse(event.data);
        if (message.type !== "pong") {
          logFunction(message, "debug", "Voice WebSocket (Received):");
        }
      } else {
        let splitBlob = event.data.split(",");
        let blob = await decrypt_base64_to_blob_using_aes(splitBlob[1], data);
        if (blob && audioPlaybackRef.current) {
          const chunk = await blob.arrayBuffer();
          if (
            sourceBufferRef.current &&
            !sourceBufferRef.current.updating
          ) {
            sourceBufferRef.current.appendBuffer(chunk);
          } else {
            queueRef.current.push(chunk);
          }
        }
      }
    },
    [data]
  );

  // WebSocket connection
  let { sendMessage, readyState } = useWebSocket(endpoint.call_wss, {
    onOpen: () => logFunction("Voice connected", "info"),
    onClose: () => logFunction("Voice disconnected", "info"),
    onMessage: handleWebSocketMessage,
    shouldReconnect: () => true,
    share: true,
    reconnectAttempts: 10,
    reconnectInterval: 3000,
  });

  let connected = readyState === ReadyState.OPEN;

  // Pings
  useEffect(() => {
    let interval;
    if (connected) {
      interval = setInterval(async () => {
        let time = Date.now();
        send({
          type: "ping",
          log: {
            message: "Ping from Client",
            log_level: -1,
          },
          data: {
            last_ping: time,
          },
        });
      }, 10000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [connected]);

  useEffect(() => {
    setVoiceStatus({
      ...voiceStatus,
      status: connected ? "CONNECTED" : "DISCONNECTED",
    });
  }, [connected]);

  // Identification & Reauthentication with new Call ID
  useEffect(() => {
    if (connected && data !== "") {
      send({
        type: "identification",
        log: {
          message: "Client identifying",
          log_level: 0,
        },
        data: {
          call_id: data,
          user_id: localStorage.getItem("uuid"),
          private_key_hash: privateKeyHash,
        },
      });
    } else {
      setIdentified(false);
    }
  }, [connected, data, privateKeyHash]);

  // Recording state sync
  useEffect(() => {
    setRecording(isRecording);
  }, [isRecording]);

  useEffect(() => {
    if (recording) {
      startRecording().then((data) => {
        if (!data.success) {
          toast.error(data.message);
        }
      });
    } else {
      stopRecording();
    }
  }, [recording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // UI event handlers
  function toggleRecord() {
    setRecording(!recording);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1">
        <Button
          className={`w-9 h-9 ${connected ? "" : "text-destructive"}`}
        >
          {connected ? <Icon.Wifi /> : <Icon.WifiOff />}
        </Button>
        <Button
          className={`w-9 h-9 ${
            isRecording
              ? "bg-green-500 hover:bg-green-600"
              : "bg-red-500 hover:bg-red-600"
          }`}
          onClick={toggleRecord}
        >
          {isRecording ? <Icon.Mic /> : <Icon.MicOff />}
        </Button>
        <Button
          className="w-9 h-9"
          onClick={() => {
            copyTextToClipboard(data);
          }}
        >
          <Icon.Clipboard />
        </Button>
      </div>
      <div className="flex flex-col" key={data}>
        <p className="text-muted">{data}</p>
        <p className="text-muted">{encodingInfo}</p>
        <audio autoPlay ref={audioPlaybackRef} controls></audio>
      </div>
    </div>
  );
}