// Package Imports
import { useRef, useState, useEffect, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import Image from "next/image"

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { log, sha256, convertDisplayNameToInitials } from "@/lib/utils";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useUsersContext } from "@/components/context/users";
import { useEncryptionContext } from "@/components/context/encryption";
import { useMessageContext } from "@/components/context/messages";
import { useWebSocketContext } from "@/components/context/websocket";

// Components
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton";
import {
    CommandItem,
} from "@/components/ui/command"

// Main
export function VoiceCall() {
    let { privateKeyHash } = useCryptoContext();
    let { currentCall, setCurrentCall, setCurrentCallStream, ownUuid, get } = useUsersContext();

    let screenStreamRef = useRef(null); // Consolidated to single ref for screen streams

    let { receiver } = useMessageContext();
    let { encrypt_base64_using_aes, decrypt_base64_using_aes, encrypt_base64_using_pubkey } =
        useEncryptionContext();

    let peerConnections = useRef(new Map());
    let remoteAudioRefs = useRef(new Map());
    let remoteScreenRefs = useRef(new Map()); // For remote screen shares
    let localStream = useRef(null);

    let [connectedPeers, setConnectedPeers] = useState([]);
    let [identified, setIdentified] = useState(false);
    let [screenShareActive, setScreenShareActive] = useState(false);
    let [screenShareError, setScreenShareError] = useState(null);
    let [screenSharePermission, setScreenSharePermission] = useState(false);

    // Global screen share management
    useEffect(() => {
        // Check for screen share permission
        const checkScreenSharePermission = async () => {
            try {
                // Check if getDisplayMedia is available
                if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                    setScreenShareError("Screen sharing is not supported in your browser");
                    return false;
                }
                setScreenSharePermission(true);
                return true;
            } catch (err) {
                setScreenShareError("Screen sharing permission check failed: " + err.message);
                return false;
            }
        };

        checkScreenSharePermission();

        // Set up status notification for remote clients
        const notifyScreenShareStatus = () => {
            // Always check for stream changes for all peers, regardless of our streaming state
            if (peerConnections.current.size > 0) {
                // Check if we need to trigger a remote-streams-changed event
                let shouldNotifyUI = false;

                // Check for dead tracks in remote streams and clean them up
                remoteScreenRefs.current.forEach((stream, peerId) => {
                    const videoTracks = stream.getVideoTracks();
                    let trackRemoved = false;

                    videoTracks.forEach(track => {
                        // Check if track is ended or muted
                        if (track.readyState === 'ended' || !track.enabled) {
                            stream.removeTrack(track);
                            log(`Removed dead track ${track.id} from peer ${peerId}`, "debug", "Voice WebSocket:");
                            trackRemoved = true;
                            shouldNotifyUI = true;
                        }
                    });

                    // If all tracks are removed, we might want to clean up the stream
                    if (trackRemoved && stream.getTracks().length === 0) {
                        log(`All tracks removed from peer ${peerId}, cleaning up`, "debug", "Voice WebSocket:");
                    }
                });

                // Only handle our own screen sharing tracks
                if (screenStreamRef.current) {
                    peerConnections.current.forEach(async (pc, userId) => {
                        try {
                            // Check connection state before attempting any operations
                            if (pc.connectionState === 'connected' && pc.signalingState === 'stable') {
                                const transceivers = pc.getTransceivers();
                                const videoTransceiver = transceivers.find(t =>
                                    (t.receiver && t.receiver.track && t.receiver.track.kind === 'video') ||
                                    (t.mid !== null && t.direction.includes('recv'))
                                );

                                const videoTrack = screenStreamRef.current.getVideoTracks()[0];

                                // Check if we need to replace the track
                                if (videoTransceiver && videoTrack) {
                                    const currentTrack = videoTransceiver.sender.track;

                                    // If we don't have a track or it's different, replace it
                                    if (!currentTrack || currentTrack.id !== videoTrack.id) {
                                        try {
                                            await videoTransceiver.sender.replaceTrack(videoTrack);
                                            videoTransceiver.direction = 'sendrecv';
                                            log(`Updated video track for peer ${userId}`, "debug", "Voice WebSocket:");
                                            shouldNotifyUI = true;
                                        } catch (err) {
                                            log(`Couldn't update video track for peer ${userId}: ${err.message}`, "debug", "Voice WebSocket:");
                                        }
                                    }
                                }

                                // Check audio tracks
                                const senders = pc.getSenders();
                                const screenAudioTracks = screenStreamRef.current.getAudioTracks();

                                screenAudioTracks.forEach(track => {
                                    const trackExists = senders.some(sender => sender.track && sender.track.id === track.id);

                                    if (!trackExists) {
                                        try {
                                            pc.addTrack(track, screenStreamRef.current);
                                            log(`Late-added screen audio track ${track.id} to peer ${userId}`, "debug", "Voice WebSocket:");
                                            shouldNotifyUI = true;
                                        } catch (err) {
                                            log(`Couldn't add screen audio track to peer ${userId}: ${err.message}`, "debug", "Voice WebSocket:");
                                        }
                                    }
                                });
                            }
                        } catch (err) {
                            log(`Failed to update screen status for peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                        }
                    });
                }

                // Always dispatch event to ensure UI stays updated
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new Event("remote-streams-changed"));
                }
            }
        };

        // Set up more frequent status update interval - but not too frequent to avoid conflicts
        const statusInterval = setInterval(notifyScreenShareStatus, 5000);

        // Expose functions to start/stop screen sharing globally
        window.startScreenShare = async () => {
            if (!screenSharePermission) {
                setScreenShareError("Screen sharing is not available");
                return null;
            }

            if (screenShareActive) {
                log("Screen share already active", "warning", "Voice WebSocket:");
                return screenStreamRef.current;
            }

            try {
                setScreenShareError(null);
                let stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                screenStreamRef.current = stream;
                setScreenShareActive(true);

                // Update currentCallStream in context
                setCurrentCallStream(prev => ({
                    ...prev,
                    active: true,
                    stream: stream
                }));

                // Add screen share tracks to all peer connections with error handling
                peerConnections.current.forEach(async (pc, userId) => {
                    try {
                        const videoTrack = stream.getVideoTracks()[0];
                        const audioTracks = stream.getAudioTracks();

                        // Find existing video transceiver and replace the track
                        const transceivers = pc.getTransceivers();
                        const videoTransceiver = transceivers.find(t =>
                            t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
                        ) || transceivers.find(t => t.mid !== null && t.direction.includes('recv'));

                        if (videoTransceiver && videoTrack) {
                            // Replace the dummy track with our actual screen share
                            await videoTransceiver.sender.replaceTrack(videoTrack);
                            videoTransceiver.direction = 'sendrecv';
                            log(`Replaced video track for peer ${userId} with screen share`, "debug", "Voice WebSocket:");
                        } else if (videoTrack) {
                            // Fallback: add track directly if no transceiver found
                            pc.addTrack(videoTrack, stream);
                            log(`Added video track to peer ${userId}`, "debug", "Voice WebSocket:");
                        }

                        // Add audio tracks from screen share
                        audioTracks.forEach(track => {
                            pc.addTrack(track, stream);
                            log(`Added ${track.kind} track to peer ${userId}`, "debug", "Voice WebSocket:");
                        });
                    } catch (err) {
                        log(`Failed to add screen tracks to peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                    }
                });

                // Handle when user stops sharing via browser UI
                stream.getVideoTracks()[0].addEventListener('ended', () => {
                    log("Screen share ended by user", "debug", "Voice WebSocket:");
                    window.stopScreenShare();
                });

                log("Screen sharing started", "debug", "Voice WebSocket:");
                return stream;
            } catch (err) {
                setScreenShareError("Screen sharing failed: " + err.message);
                log(err.message, "error", "Voice WebSocket:");
                throw err;
            }
        };

        window.stopScreenShare = () => {
            if (screenStreamRef.current) {
                log("Stopping screen share and notifying all peers", "debug", "Voice WebSocket:");

                // Get track references before stopping them
                const tracksToRemove = screenStreamRef.current.getTracks().map(track => ({
                    id: track.id,
                    kind: track.kind
                }));

                // Stop all tracks
                screenStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    log(`Stopped ${track.kind} track ${track.id}`, "debug", "Voice WebSocket:");
                });

                // Remove tracks from all peer connections
                peerConnections.current.forEach(async (pc, userId) => {
                    try {
                        // Get transceivers for this peer connection
                        const transceivers = pc.getTransceivers();
                        let trackRemoved = false;

                        // Find and handle screen share tracks
                        tracksToRemove.forEach(trackInfo => {
                            if (trackInfo.kind === 'video') {
                                // Find the video transceiver and replace with null (stop sending)
                                const videoTransceiver = transceivers.find(t =>
                                    t.sender.track && t.sender.track.id === trackInfo.id
                                );

                                if (videoTransceiver) {
                                    try {
                                        // Replace with null to stop sending video
                                        videoTransceiver.sender.replaceTrack(null);
                                        videoTransceiver.direction = 'recvonly'; // Back to receive-only
                                        log(`Reset video transceiver to recvonly for peer ${userId}`, "debug", "Voice WebSocket:");
                                        trackRemoved = true;
                                    } catch (err) {
                                        log(`Error resetting video transceiver for peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                                    }
                                }
                            } else {
                                // Handle audio tracks normally
                                const senders = pc.getSenders();
                                const sender = senders.find(s => s.track && s.track.id === trackInfo.id);
                                if (sender) {
                                    try {
                                        pc.removeTrack(sender);
                                        log(`Removed ${trackInfo.kind} track from peer ${userId}`, "debug", "Voice WebSocket:");
                                        trackRemoved = true;
                                    } catch (err) {
                                        log(`Error removing ${trackInfo.kind} track from peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                                    }
                                }
                            }
                        });

                        // Simple renegotiation - let the normal negotiation process handle it
                        if (trackRemoved && pc.signalingState === 'stable' && pc.connectionState === 'connected') {
                            log(`Track changes completed for peer ${userId}, letting normal negotiation handle updates`, "debug", "Voice WebSocket:");
                        }
                    } catch (err) {
                        log(`Failed to process track removal for peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                    }
                });

                // Clear the screen stream reference
                screenStreamRef.current = null;

                // Notify clients about stream change
                if (typeof window !== 'undefined') {
                    // Dispatch multiple events to ensure UI updates
                    window.dispatchEvent(new Event("remote-streams-changed"));
                    // Send another update after a short delay
                    setTimeout(() => {
                        window.dispatchEvent(new Event("remote-streams-changed"));
                    }, 500);
                }
            }

            setScreenShareActive(false);

            // Update currentCallStream in context
            setCurrentCallStream(prev => ({
                ...prev,
                active: false,
                stream: null
            }));

            log("Screen sharing stopped", "debug", "Voice WebSocket:");
        };

        // Toggle screen share function
        window.toggleScreenShare = async () => {
            if (screenShareActive) {
                window.stopScreenShare();
                return false;
            } else {
                await window.startScreenShare();
                return true;
            }
        };

        // Expose function to get all screen streams (local and remote)
        window.getAllScreenStreams = () => {
            let streams = [];

            // Add local screen stream if active
            if (screenStreamRef.current) {
                // Check if local stream has active video tracks
                const localVideoTracks = screenStreamRef.current.getVideoTracks();
                const localHasActiveTracks = localVideoTracks.some(
                    track => track.enabled && track.readyState === 'live'
                );

                if (localHasActiveTracks) {
                    streams.push({
                        type: 'local',
                        stream: screenStreamRef.current
                    });
                }
            }

            // Add all remote screen streams
            remoteScreenRefs.current.forEach((stream, peerId) => {
                // Check if the stream has active video tracks
                const videoTracks = stream.getVideoTracks();

                if (videoTracks && videoTracks.length > 0) {
                    // Double check that at least one track is enabled and live
                    const hasActiveTracks = videoTracks.some(
                        track => track.enabled && track.readyState === 'live'
                    );

                    if (hasActiveTracks) {
                        streams.push({
                            type: 'remote',
                            peerId: peerId,
                            stream: stream
                        });
                    } else {
                        // Clean up inactive tracks to prevent stale frames
                        videoTracks.forEach(track => {
                            if (track.readyState === 'ended' || !track.enabled) {
                                try {
                                    stream.removeTrack(track);
                                } catch (err) {
                                    // Ignore removal errors
                                }
                            }
                        });

                        // If after cleanup we still have video tracks, include the stream
                        // This is important for recently stopped streams that might still have useful data
                        if (stream.getVideoTracks().length > 0) {
                            streams.push({
                                type: 'remote',
                                peerId: peerId,
                                endingSoon: true,  // Mark as ending
                                stream: stream
                            });
                        }
                    }
                }
            });

            return streams;
        };

        // Expose function to get a specific screen stream
        window.getScreenStream = (peerId) => {
            if (!peerId) {
                // Return local screen stream
                return screenStreamRef.current;
            }

            // Return remote screen stream for specific peer
            return remoteScreenRefs.current.get(peerId);
        };

        return () => {
            // Clean up the status interval
            clearInterval(statusInterval);

            // Keep the screen share active but make sure to clean up the global methods
            // We're not stopping the screen share on unmount, as this was causing issues
            const currentScreenStream = screenStreamRef.current;

            delete window.startScreenShare;
            delete window.stopScreenShare;
            delete window.toggleScreenShare;
            delete window.getAllScreenStreams;
            delete window.getScreenStream;

            // Dispatch event one more time to notify UI components
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("remote-streams-changed"));
            }
        };
    }, [screenSharePermission, screenShareActive]);

    // Init WebSocket
    let { sendMessage, lastMessage, readyState } = useWebSocket(
        endpoint.call_wss,
        {
            onOpen: () => log("Voice connected", "debug", "Voice WebSocket:"),
            onClose: () => {
                log("Voice disconnected", "debug", "Voice WebSocket:");
                setIdentified(false);
            },
            onError: (event) => log(event.type, "error", "Voice WebSocket:"),
            shouldReconnect: () => false,
        },
    );

    // Message Sending Function
    let send = useCallback(
        (data) => {
            if (currentCall.connected) {
                sendMessage(JSON.stringify(data));
                log(data, "debug", "Voice WebSocket:");
            } else {
                log("WebSocket not open", "error", "Voice WebSocket:");
            }
        },
        [currentCall.connected, sendMessage],
    );

    // New User connection function
    let createNewPeerConnection = useCallback(
        async (remoteUserId, isInitiator) => {
            log(
                `Attempting to create new peer connection for ${remoteUserId}. Initiator: ${isInitiator}`,
                "debug",
                "Voice WebSocket:",
            );
            if (peerConnections.current.has(remoteUserId)) {
                log(
                    `Peer connection already exists for ${remoteUserId}. Returning existing.`,
                    "debug",
                    "Voice WebSocket:",
                );
                return peerConnections.current.get(remoteUserId);
            }

            let pc = new RTCPeerConnection({
                iceServers: [
                    { urls: ["stun:stun.omikron.methanium.net:5349"] },
                ],
                iceCandidatePoolSize: 10,
            });
            peerConnections.current.set(remoteUserId, pc);
            log(
                `New RTCPeerConnection created for ${remoteUserId}.`,
                "debug",
                "Voice WebSocket:",
            );

            // Always add audio tracks if available
            if (localStream.current) {
                log(
                    `Adding local audio tracks to peer connection for ${remoteUserId}.`,
                    "debug",
                    "Voice WebSocket:",
                );
                localStream.current.getAudioTracks().forEach((track) => {
                    pc.addTrack(track, localStream.current);
                });
            }

            // Always add a video transceiver to enable receiving screen shares
            // This ensures we can receive video tracks even if we're not sending any initially
            const videoTransceiver = pc.addTransceiver('video', {
                direction: 'recvonly'  // Start as receive-only
            });
            log(
                `Added video transceiver for ${remoteUserId} (direction: recvonly)`,
                "debug",
                "Voice WebSocket:",
            );

            // Add screen share tracks if available - this will change the transceiver to sendrecv
            if (screenStreamRef.current) {
                log(
                    `Adding screen share tracks to peer connection for ${remoteUserId}.`,
                    "debug",
                    "Voice WebSocket:",
                );
                try {
                    // Replace the transceiver with our actual screen share tracks
                    const videoTrack = screenStreamRef.current.getVideoTracks()[0];
                    if (videoTrack) {
                        await videoTransceiver.sender.replaceTrack(videoTrack);
                        videoTransceiver.direction = 'sendrecv';
                        log(`Replaced dummy video track with screen share for ${remoteUserId}`, "debug", "Voice WebSocket:");
                    }

                    // Add any audio tracks from screen share
                    screenStreamRef.current.getAudioTracks().forEach((track) => {
                        pc.addTrack(track, screenStreamRef.current);
                    });
                } catch (err) {
                    log(
                        `Failed to add screen tracks to peer ${remoteUserId}: ${err.message}`,
                        "error",
                        "Voice WebSocket:",
                    );
                }
            }

            if (!localStream.current) {
                log(
                    `NO LOCAL AUDIO STREAM AVAILABLE TO ADD FOR ${remoteUserId}. This might be expected if mic access was denied.`,
                    "warning",
                    "Voice WebSocket:",
                );
            }

            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    log(
                        `Generated ICE candidate for ${remoteUserId}.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                    send({
                        type: "webrtc_ice",
                        data: {
                            payload: await encrypt_base64_using_aes(
                                btoa(JSON.stringify(event.candidate)),
                                currentCall.secret,
                            ),
                            receiver_id: remoteUserId,
                        },
                    });
                    log(
                        `Sent ICE candidate to ${remoteUserId}.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                } else {
                    log(
                        `ICE candidate gathering complete for ${remoteUserId}.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                }
            };

            pc.ontrack = (event) => {
                log(
                    `Received ${event.track.kind} track from ${remoteUserId} (ID: ${event.track.id}, enabled: ${event.track.enabled}, readyState: ${event.track.readyState}).`,
                    "debug",
                    "Voice WebSocket:"
                );

                // Listen for track state changes
                event.track.onended = () => {
                    log(`Track ${event.track.id} from ${remoteUserId} ended`, "debug", "Voice WebSocket:");
                    // Clean up the track from our stream when it ends
                    if (event.track.kind === 'video') {
                        const remoteStream = remoteScreenRefs.current.get(remoteUserId);
                        if (remoteStream) {
                            remoteStream.removeTrack(event.track);
                            log(`Removed ended track ${event.track.id} from remote screen stream`, "debug", "Voice WebSocket:");
                        }
                    } else {
                        const remoteStream = remoteAudioRefs.current.get(remoteUserId);
                        if (remoteStream) {
                            remoteStream.removeTrack(event.track);
                            log(`Removed ended track ${event.track.id} from remote audio stream`, "debug", "Voice WebSocket:");
                        }
                    }
                    // Dispatch UI update when a track ends
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("remote-streams-changed"));
                    }
                };

                // Check if this is a video track (potential screen share)
                if (event.track.kind === 'video') {
                    // Always create or get the remote stream for this user
                    let remoteStream = remoteScreenRefs.current.get(remoteUserId);
                    if (!remoteStream) {
                        log(
                            `Creating new MediaStream for remote screen from user ${remoteUserId}.`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        remoteStream = new MediaStream();
                        remoteScreenRefs.current.set(remoteUserId, remoteStream);
                    }

                    // Check if this exact track is already in the stream
                    const trackExists = Array.from(remoteStream.getTracks()).some(
                        track => track.id === event.track.id
                    );

                    if (!trackExists) {
                        log(
                            `Adding remote video track (screen share) from ${remoteUserId} (ID: ${event.track.id}).`,
                            "debug",
                            "Voice WebSocket:",
                        );

                        // Make sure track is enabled
                        event.track.enabled = true;

                        // Add the track to our stream
                        remoteStream.addTrack(event.track);

                        // Notify UI immediately that we have a new remote screen stream
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("remote-streams-changed"));
                        }
                    } else {
                        log(
                            `Track ${event.track.id} already exists in stream for ${remoteUserId}, skipping`,
                            "debug",
                            "Voice WebSocket:",
                        );
                    }
                }
                // Handle audio tracks
                else {
                    let remoteStream = remoteAudioRefs.current.get(remoteUserId);
                    if (!remoteStream) {
                        log(
                            `Creating new MediaStream for remote user ${remoteUserId}.`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        remoteStream = new MediaStream();
                        remoteAudioRefs.current.set(remoteUserId, remoteStream);
                    }

                    // Check if this track is already in the stream
                    const trackExists = Array.from(remoteStream.getTracks()).some(
                        track => track.id === event.track.id
                    );

                    if (!trackExists) {
                        log(
                            `Adding remote audio track from ${remoteUserId}.`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        remoteStream.addTrack(event.track);
                    }
                }

                // Update connected peers list
                setConnectedPeers((prev) =>
                    Array.from(new Set([...prev, remoteUserId])),
                );
            };

            if (isInitiator) {
                pc.onnegotiationneeded = async () => {
                    // Only proceed if the connection is in a stable state
                    if (pc.signalingState !== 'stable') {
                        log(
                            `Skipping negotiation for ${remoteUserId} - signaling state: ${pc.signalingState}`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        return;
                    }

                    log(
                        `Negotiation needed for ${remoteUserId} (isInitiator: true). Creating offer...`,
                        "debug",
                        "Voice WebSocket:",
                    );
                    try {
                        let offer = await pc.createOffer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: true
                        });

                        // Double-check signaling state before setting local description
                        if (pc.signalingState !== 'stable') {
                            log(
                                `Signaling state changed during offer creation for ${remoteUserId}, aborting`,
                                "debug",
                                "Voice WebSocket:",
                            );
                            return;
                        }

                        await pc.setLocalDescription(offer);
                        log(
                            `Created and set local offer for ${remoteUserId}.`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        send({
                            type: "webrtc_sdp",
                            data: {
                                payload: await encrypt_base64_using_aes(
                                    btoa(JSON.stringify(offer)),
                                    currentCall.secret,
                                ),
                                receiver_id: remoteUserId,
                            },
                        });
                        log(
                            `Sent offer SDP to ${remoteUserId}.`,
                            "debug",
                            "Voice WebSocket:",
                        );
                    } catch (error) {
                        log(
                            `Error creating or sending offer: ${error}`,
                            "error",
                            "Voice WebSocket:",
                        );
                    }
                };
            }

            pc.onconnectionstatechange = () => {
                log(
                    `Connection state with ${remoteUserId} changed to: ${pc.connectionState}`,
                    "debug",
                    "Voice WebSocket:",
                );
                if (
                    pc.connectionState === "disconnected" ||
                    pc.connectionState === "failed" ||
                    pc.connectionState === "closed"
                ) {
                    log(
                        `Connection with ${remoteUserId} is disconnected, failed, or closed. Cleaning up.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                    peerConnections.current.delete(remoteUserId);
                    remoteAudioRefs.current.delete(remoteUserId);
                    remoteScreenRefs.current.delete(remoteUserId);
                    setConnectedPeers((prev) =>
                        prev.filter((id) => id !== remoteUserId),
                    );
                } else if (pc.connectionState === "connected") {
                    log(
                        `Successfully connected to ${remoteUserId}.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                }
            };

            return pc;
        },
        [send],
    );

    // Update connected boolean
    useEffect(() => {
        setCurrentCall((prevData) => ({
            ...prevData,
            connected: readyState === ReadyState.OPEN,
        }));
    }, [readyState]);

    // Update connected users array
    useEffect(() => {
        setCurrentCall((prevData) => ({
            ...prevData,
            users: connectedPeers,
        }));
    }, [connectedPeers]);

    // Update indentification
    useEffect(() => {
        setCurrentCall((prevData) => ({
            ...prevData,
            identified: identified,
        }));
    }, [identified]);

    // Update screen share state
    useEffect(() => {
        setCurrentCall((prevData) => ({
            ...prevData,
            screenShareActive: screenShareActive,
        }));
    }, [screenShareActive]);

    // Get Mic as soon as voice call loads
    useEffect(() => {
        let getMedia = async () => {
            try {
                let stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                localStream.current = stream;
            } catch (err) {
                log(err.message, "error", "Voice WebSocket:");
            }
        };

        getMedia();
    }, []);

    // Mute
    useEffect(() => {
        if (localStream.current) {
            localStream.current.getAudioTracks().forEach((track) => {
                track.enabled = !currentCall.mute;
            });
        }
    }, [currentCall.mute]);

    // Message handling
    useEffect(() => {
        if (lastMessage === null) return;

        let handleMessage = async () => {
            let message;
            try {
                message = JSON.parse(lastMessage.data);
                log(message, "debug", "Voice WebSocket:");
            } catch (err) {
                console.log(lastMessage.data, err.message);
                return;
            }

            switch (message.type) {
                case "identification_response":
                    setIdentified(true);
                    break;

                case "client_connected":
                    let newUser = message.data.user_id;
                    if (newUser !== ownUuid) {
                        log(
                            `${newUser}: Init P2P Connection`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        await createNewPeerConnection(newUser, true);
                    }
                    break;

                case "client_closed":
                    let disconnectedUser = message.data.user_id;
                    let toBeClosedPeerConnection =
                        peerConnections.current.get(disconnectedUser);
                    if (toBeClosedPeerConnection) {
                        toBeClosedPeerConnection.close();
                    }

                    setCurrentCall((prevData) => ({
                        ...prevData,
                        users: prevData.users.filter(
                            (user) => user !== disconnectedUser,
                        ),
                    }));
                    break;

                case "webrtc_sdp":
                    let sdp_payload_b64 = await decrypt_base64_using_aes(
                        message.data.payload,
                        currentCall.secret,
                    );
                    let sdp_sender = message.data.sender_id;

                    let sdp_payload;
                    try {
                        sdp_payload = atob(sdp_payload_b64);
                    } catch (err) {
                        log(
                            `${sdp_sender}: ${err.message}`,
                            "error",
                            "Voice WebSocket:",
                        );
                        return;
                    }

                    let pc = peerConnections.current.get(sdp_sender);
                    if (!pc) {
                        log(
                            `${sdp_sender}: Create new P2P Connection`,
                            "debug",
                            "Voice WebSocket:",
                        );
                        pc = await createNewPeerConnection(sdp_sender, false);
                    }

                    try {
                        // Parse the SDP object
                        let sdp_obj = new RTCSessionDescription(
                            JSON.parse(sdp_payload),
                        );

                        // Log that we're processing an SDP message
                        log(
                            `Processing ${sdp_obj.type} from ${sdp_sender}`,
                            "debug",
                            "Voice WebSocket:",
                        );

                        // Set the remote description
                        await pc.setRemoteDescription(sdp_obj);

                        // If this is an offer, we need to create and send an answer
                        if (sdp_obj.type === "offer") {
                            log(
                                `Creating answer for ${sdp_sender}`,
                                "debug",
                                "Voice WebSocket:",
                            );

                            // Create answer with appropriate constraints to allow screen sharing
                            let answer = await pc.createAnswer({
                                offerToReceiveAudio: true,
                                offerToReceiveVideo: true // Important for receiving screen shares
                            });

                            // Set our local description
                            await pc.setLocalDescription(answer);

                            // Send the answer back to the peer
                            send({
                                type: "webrtc_sdp",
                                data: {
                                    payload: await encrypt_base64_using_aes(
                                        btoa(JSON.stringify(answer)),
                                        currentCall.secret,
                                    ),
                                    receiver_id: sdp_sender,
                                },
                            });

                            log(
                                `Answer sent to ${sdp_sender}`,
                                "debug",
                                "Voice WebSocket:",
                            );

                            // After processing a renegotiation, notify UI to update in case new streams arrived
                            if (typeof window !== "undefined") {
                                window.dispatchEvent(new Event("remote-streams-changed"));
                            }
                        }
                    } catch (error) {
                        log(
                            `SDP Error (${sdp_sender}): ${error}`,
                            "error",
                            "Voice WebSocket:",
                        );
                    }
                    break;
                case "webrtc_ice":
                    let ice_payload_b64 = await decrypt_base64_using_aes(
                        message.data.payload,
                        currentCall.secret,
                    );
                    let ice_sender = message.data.sender_id;

                    let ice_payload;
                    try {
                        ice_payload = atob(ice_payload_b64);
                    } catch (err) {
                        log(
                            `${ice_sender}: ${err.message}`,
                            "error",
                            "Voice WebSocket:",
                        );
                        return;
                    }

                    let pcForCandidate =
                        peerConnections.current.get(ice_sender);
                    if (pcForCandidate && ice_payload) {
                        try {
                            await pcForCandidate.addIceCandidate(
                                new RTCIceCandidate(JSON.parse(ice_payload)),
                            );
                        } catch (err) {
                            log(err.message, "error", "Voice WebSocket:");
                        }
                    } else {
                        log(
                            `No peer connection found for ${ice_sender} or ICE payload is empty.`,
                            "warning",
                            "Voice WebSocket:",
                        );
                    }
                    break;
                default:
                    log(
                        `Unknown message type: ${message.type}`,
                        "warning",
                        "Voice WebSocket:",
                    );
                    break;
            }
        };

        handleMessage();
    }, [lastMessage, createNewPeerConnection, send]);

    // Identification
    useEffect(() => {
        if (currentCall.connected && !identified) {
            log(
                "Local media ready and WebSocket open. Sending identification.",
                "debug",
                "Voice WebSocket:",
            );
            async function asyncSend() {
                if (currentCall.invite) {
                    send({
                        type: "identification",
                        data: {
                            call_id: currentCall.id,
                            user_id: ownUuid,
                            receiver_id: receiver,
                            private_key_hash: privateKeyHash,
                            call_secret: await encrypt_base64_using_pubkey(btoa(currentCall.secret), await get(receiver).then(a => { return a.public_key })),
                            call_secret_sha: await sha256(currentCall.secret),
                        },
                    });
                } else {
                    send({
                        type: "identification",
                        data: {
                            call_id: currentCall.id,
                            user_id: ownUuid,
                            private_key_hash: privateKeyHash,
                            call_secret_sha: await sha256(currentCall.secret),
                        },
                    });
                }
            }
            asyncSend();
        }
    }, [currentCall.connected, identified, privateKeyHash, send]);

    // Pings
    useEffect(() => {
        let interval;
        if (currentCall.connected) {
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
    }, [currentCall.connected, send]);

    // Cleanup
    useEffect(() => {
        return () => {
            log(
                "Closing and clearing all peer connections.",
                "debug",
                "Voice WebSocket:",
            );
            peerConnections.current.forEach((pc, userId) => {
                log(`Closing PC for ${userId}.`, "debug", "Voice WebSocket:");
                pc.close();
            });
            peerConnections.current.clear();
            remoteAudioRefs.current.clear();
            remoteScreenRefs.current.clear();

            if (localStream.current) {
                localStream.current.getTracks().forEach((track) => track.stop());
                localStream.current = null;
                log("Stopped local media tracks.", "debug", "Voice WebSocket:");
            }

            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((track) => track.stop());
                screenStreamRef.current = null;
                log("Stopped local screen share tracks.", "debug", "Voice WebSocket:");
            }
        };
    }, []);

    return (
        <div hidden>
            {connectedPeers.map((peerId) => {
                let remoteStream = remoteAudioRefs.current.get(peerId);
                return (
                    <div key={peerId}>
                        {remoteStream && (
                            <audio
                                ref={(el) => {
                                    if (el) el.srcObject = remoteStream;
                                }}
                                autoPlay
                                muted={currentCall.deaf}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function RemoteStreamVideo({ stream, className }) {
    let canvasRef = useRef(null);
    let videoRef = useRef(null);
    let animationFrameIdRef = useRef(null);
    let lastFrameTimeRef = useRef(0);
    let noUpdateCountRef = useRef(0);

    // Store the stream ID and track IDs to detect changes
    let streamIdRef = useRef(stream?.id);
    let trackIdsRef = useRef([]);
    let trackStatesRef = useRef({});

    useEffect(() => {
        // Safety checks
        if (!stream || !canvasRef.current) return;

        // Get current track information
        const currentTracks = stream.getTracks();
        const currentTrackIds = currentTracks.map(t => t.id).sort().join(',');

        // Check if we have active video tracks
        const hasActiveVideoTracks = currentTracks.some(
            track => track.kind === 'video' && track.enabled && track.readyState === 'live'
        );

        // If no active video tracks, we might need to clear the display
        if (!hasActiveVideoTracks) {
            log(`Stream ${stream.id} has no active video tracks, might be stopped`, "debug", "Remote Video:");
        }

        // Log that we're attaching to a stream
        log(`Attaching to stream: ${stream.id} with ${currentTracks.length} tracks, active video: ${hasActiveVideoTracks}`, "debug", "Remote Video:");

        // Check if this is a new stream or tracks changed
        const isNewStream = streamIdRef.current !== stream.id;
        const tracksChanged = trackIdsRef.current !== currentTrackIds;

        // Update refs with new track information
        streamIdRef.current = stream.id;
        trackIdsRef.current = currentTrackIds;

        // Update individual track state information
        trackStatesRef.current = {};
        currentTracks.forEach(track => {
            trackStatesRef.current[track.id] = {
                enabled: track.enabled,
                readyState: track.readyState,
                muted: track.muted
            };
        });

        // Clean up previous video element if stream or tracks changed
        if ((isNewStream || tracksChanged) && videoRef.current) {
            log(`Stream or tracks changed, cleaning up previous video element`, "debug", "Remote Video:");
            cancelAnimationFrame(animationFrameIdRef.current);

            // Disconnect from our video element
            videoRef.current.srcObject = null;
            videoRef.current.load(); // Reset the video element completely

            // Reset frame timing
            lastFrameTimeRef.current = 0;
            noUpdateCountRef.current = 0;
        }

        // Create or update video element for the stream
        if (isNewStream || tracksChanged || !videoRef.current) {
            log(`Setting up video element for stream ${stream.id}`, "debug", "Remote Video:");

            let videoElement = videoRef.current || document.createElement("video");
            videoRef.current = videoElement;

            // Make sure video tracks are enabled
            stream.getVideoTracks().forEach(track => {
                if (!track.enabled) {
                    track.enabled = true;
                    log(`Enabled video track: ${track.id}`, "debug", "Remote Video:");
                }
            });

            // Attach stream to video element with settings for better responsiveness
            videoElement.srcObject = stream;
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.muted = true;

            // Additional settings to improve playback
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('webkit-playsinline', '');

            // Play the video
            videoElement.play().catch((error) => {
                log(`Video play failed for stream ${stream.id}: ${error}`, "showError");
            });

            // Listen for ended event on each track
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    log(`Track ${track.id} ended, triggering UI update`, "debug", "Remote Video:");
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("remote-streams-changed"));
                    }
                };
            });
        } else if (videoRef.current) {
            // If we have the same element but need to update the stream
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch(err => {
                    log(`Failed to play updated stream: ${err}`, "debug", "Remote Video:");
                });
            }
        }

        // Set up canvas
        let canvasElement = canvasRef.current;
        let context = canvasElement.getContext("2d", { alpha: false }); // No alpha for better performance

        // Initial canvas size
        if (!canvasElement.width || !canvasElement.height) {
            canvasElement.width = 640; // Default width
            canvasElement.height = 360; // Default height
        }

        // Draw a placeholder if we have no active video tracks
        if (!hasActiveVideoTracks) {
            // Clear the canvas
            context.fillStyle = '#1a1a1a'; // Dark background
            context.fillRect(0, 0, canvasElement.width, canvasElement.height);

            // Add text saying stream ended
            context.font = '16px sans-serif';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);
        }

        // Rendering function for smoother playback
        let renderFrame = () => {
            // Check if component is still mounted
            if (!canvasRef.current || !videoRef.current) return;

            let videoElement = videoRef.current;
            let now = performance.now();

            // Only render if video is actually playing and has content
            if (videoElement.readyState >= 3 && videoElement.videoWidth > 0) {
                // Check if frame has been updated (by comparing currentTime)
                // This helps detect stalled video streams
                if (videoElement.currentTime > 0 && videoElement.currentTime !== lastFrameTimeRef.current) {
                    // Reset no-update counter since we have a new frame
                    noUpdateCountRef.current = 0;
                    lastFrameTimeRef.current = videoElement.currentTime;

                    // Resize canvas if needed
                    if (canvasElement.width !== videoElement.videoWidth) {
                        canvasElement.width = videoElement.videoWidth;
                    }
                    if (canvasElement.height !== videoElement.videoHeight) {
                        canvasElement.height = videoElement.videoHeight;
                    }

                    // Clear canvas before drawing
                    context.clearRect(0, 0, canvasElement.width, canvasElement.height);

                    try {
                        // Draw video frame
                        context.drawImage(
                            videoElement,
                            0, 0,
                            canvasElement.width,
                            canvasElement.height,
                        );
                    } catch (err) {
                        // Handle drawing errors quietly
                    }
                } else {
                    // Increment no-update counter - after many frames with no updates, 
                    // we'll consider the stream stalled
                    noUpdateCountRef.current++;

                    // After ~5 seconds (300 frames at 60fps) of no updates, draw a "stalled" message
                    if (noUpdateCountRef.current > 300) {
                        // Check if any tracks are still active
                        const hasActiveTracks = stream.getTracks().some(t =>
                            t.readyState === 'live' && t.enabled && !t.muted
                        );

                        // If no active tracks, draw the "ended" message
                        if (!hasActiveTracks) {
                            // Draw a clear indication that the stream is stalled/ended
                            context.fillStyle = '#1a1a1a';
                            context.fillRect(0, 0, canvasElement.width, canvasElement.height);

                            context.font = '16px sans-serif';
                            context.fillStyle = '#ffffff';
                            context.textAlign = 'center';
                            context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);

                            // Try to trigger a UI update
                            if (typeof window !== "undefined") {
                                window.dispatchEvent(new Event("remote-streams-changed"));
                            }
                        }
                    }
                }
            }

            // Schedule next frame
            animationFrameIdRef.current = requestAnimationFrame(renderFrame);
        };

        // Start rendering
        renderFrame();

        // Cleanup function
        return () => {
            // Cancel any pending animation frame
            cancelAnimationFrame(animationFrameIdRef.current);

            // Don't stop tracks here to prevent breaking the stream when component unmounts
            // Just clean up our references
            if (videoRef.current) {
                videoRef.current.srcObject = null; // Detach stream but don't stop it
                videoRef.current = null;
            }
        };
    }, [stream]);

    return <canvas ref={canvasRef} className={className} />;
}

export function User({ id, className, avatarSize }) {
    let [display, setDisplay] = useState("...");
    let [username, setUsername] = useState("...");
    let [avatar, setAvatar] = useState("...");
    let { get } = useUsersContext();

    useEffect(() => {
        get(id)
            .then(data => {
                setDisplay(data.display)
                setUsername(data.username)
                setAvatar(data.avatar)
            })
    }, [id])

    return (
        <div className={`${className} relative group bg-input/20 rounded-xl flex justify-center items-center`}>
            {avatar !== "..." ? (
                <div>
                    <Avatar className={`bg-accent/50 border w-${avatarSize} h-full`}>
                        {avatar !== "" ? (
                            <Image
                                className="w-auto h-auto object-fill"
                                data-slot="avatar-image"
                                width={250}
                                height={250}
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
                </div>
            ) : (
                <Skeleton className="rounded-full size-8" />
            )}
            <div className="group-hover:block hidden absolute bottom-0 left-0 m-2">
                {display}
            </div>
        </div>
    )
}

export function InviteItem({ id, onShouldClose }) {
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