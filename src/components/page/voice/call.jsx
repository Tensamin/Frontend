// Package Imports
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
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

// Constants for better performance
const SCREEN_SHARE_CHECK_INTERVAL = 2000;
const STATUS_UPDATE_INTERVAL = 3000;
const PING_INTERVAL = 10000;
const RENEGOTIATION_DEBOUNCE = 500;

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Main
export function VoiceCall() {
    let { privateKeyHash } = useCryptoContext();
    let { currentCall, setCurrentCall, setCurrentCallStream, ownUuid, get } = useUsersContext();

    let screenStreamRef = useRef(null);

    let { receiver } = useMessageContext();
    let { encrypt_base64_using_aes, decrypt_base64_using_aes, encrypt_base64_using_pubkey } =
        useEncryptionContext();

    let peerConnections = useRef(new Map());
    let remoteAudioRefs = useRef(new Map());
    let remoteScreenRefs = useRef(new Map());
    let localStream = useRef(null);
    let renegotiationTimeouts = useRef(new Map()); // Track renegotiation timeouts per peer

    let [connectedPeers, setConnectedPeers] = useState([]);
    let [identified, setIdentified] = useState(false);
    let [screenShareActive, setScreenShareActive] = useState(false);
    let [screenShareError, setScreenShareError] = useState(null);
    let [screenSharePermission, setScreenSharePermission] = useState(false);

    // Memoized ICE servers configuration
    const iceServersConfig = useMemo(() => ({
        iceServers: [
            { urls: ["stun:stun.omikron.methanium.net:5349"] },
        ],
        iceCandidatePoolSize: 10,
    }), []);

    // Debounced function for screen share status updates
    const debouncedStatusUpdate = useCallback(
        debounce(() => {
            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("remote-streams-changed"));
            }
        }, 100),
        []
    );

    // Optimized screen share management
    useEffect(() => {
        // Check for screen share permission
        const initializeScreenShare = async () => {
            try {
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

        initializeScreenShare();

        // Optimized screen share functions
        window.startScreenShare = async () => {
            if (!screenSharePermission) {
                setScreenShareError("Screen sharing is not available");
                throw new Error("Screen sharing is not available");
            }

            if (screenShareActive) {
                log("Screen share already active", "warning", "Voice WebSocket:");
                return screenStreamRef.current;
            }

            try {
                setScreenShareError(null);
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        frameRate: { ideal: 30, max: 60 },
                        width: { ideal: 1920, max: 3840 },
                        height: { ideal: 1080, max: 2160 }
                    },
                    audio: true
                });

                screenStreamRef.current = stream;
                setScreenShareActive(true);

                // Update context state
                setCurrentCallStream(prev => ({
                    ...prev,
                    active: true,
                    stream: stream
                }));

                // Add screen share tracks to all connected peers
                const addScreenShareToPeers = async () => {
                    const addPromises = Array.from(peerConnections.current.entries()).map(async ([userId, pc]) => {
                        try {
                            if (pc.connectionState !== 'connected' || pc.signalingState !== 'stable') {
                                log(`Skipping screen share for peer ${userId} - not ready`, "debug", "Voice WebSocket:");
                                return;
                            }

                            const videoTrack = stream.getVideoTracks()[0];
                            const audioTracks = stream.getAudioTracks();

                            // Find existing video transceiver and replace the track
                            const transceivers = pc.getTransceivers();
                            const videoTransceiver = transceivers.find(t => 
                                t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
                            ) || transceivers.find(t => t.mid !== null && t.direction.includes('recv'));

                            if (videoTransceiver && videoTrack) {
                                await videoTransceiver.sender.replaceTrack(videoTrack);
                                videoTransceiver.direction = 'sendrecv';
                                log(`Added video track for peer ${userId}`, "debug", "Voice WebSocket:");
                            }

                            // Add audio tracks
                            audioTracks.forEach(track => {
                                pc.addTrack(track, stream);
                                log(`Added audio track for peer ${userId}`, "debug", "Voice WebSocket:");
                            });
                        } catch (err) {
                            log(`Failed to add screen tracks to peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                        }
                    });

                    await Promise.allSettled(addPromises);
                };

                // Add tracks to peers
                await addScreenShareToPeers();

                // Handle when user stops sharing via browser UI
                stream.getVideoTracks()[0].addEventListener('ended', () => {
                    log("Screen share ended by user", "debug", "Voice WebSocket:");
                    window.stopScreenShare();
                });

                // Notify UI immediately
                debouncedStatusUpdate();

                log("Screen sharing started successfully", "debug", "Voice WebSocket:");
                return stream;
            } catch (err) {
                const errorMsg = "Screen sharing failed: " + err.message;
                setScreenShareError(errorMsg);
                log(errorMsg, "error", "Voice WebSocket:");
                throw err;
            }
        };

        window.stopScreenShare = () => {
            if (!screenStreamRef.current) {
                log("No screen share to stop", "debug", "Voice WebSocket:");
                return;
            }

            log("Stopping screen share", "debug", "Voice WebSocket:");

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

            // Remove tracks from all peer connections efficiently
            const removePromises = Array.from(peerConnections.current.entries()).map(async ([userId, pc]) => {
                try {
                    if (pc.connectionState === 'closed') return;

                    const transceivers = pc.getTransceivers();
                    let trackRemoved = false;

                    tracksToRemove.forEach(trackInfo => {
                        if (trackInfo.kind === 'video') {
                            const videoTransceiver = transceivers.find(t =>
                                t.sender.track && t.sender.track.id === trackInfo.id
                            );

                            if (videoTransceiver) {
                                try {
                                    videoTransceiver.sender.replaceTrack(null);
                                    videoTransceiver.direction = 'recvonly';
                                    log(`Reset video transceiver for peer ${userId}`, "debug", "Voice WebSocket:");
                                    trackRemoved = true;
                                } catch (err) {
                                    log(`Error resetting video transceiver for peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                                }
                            }
                        } else {
                            // Handle audio tracks
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

                    // Trigger renegotiation if tracks were removed
                    if (trackRemoved && pc.signalingState === 'stable' && pc.connectionState === 'connected') {
                        // Debounce renegotiation to avoid rapid-fire negotiations
                        if (renegotiationTimeouts.current.has(userId)) {
                            clearTimeout(renegotiationTimeouts.current.get(userId));
                        }
                        
                        const timeout = setTimeout(() => {
                            if (pc.signalingState === 'stable' && pc.connectionState === 'connected') {
                                log(`Triggering renegotiation for peer ${userId}`, "debug", "Voice WebSocket:");
                                // Let the normal negotiation process handle it
                            }
                            renegotiationTimeouts.current.delete(userId);
                        }, RENEGOTIATION_DEBOUNCE);
                        
                        renegotiationTimeouts.current.set(userId, timeout);
                    }
                } catch (err) {
                    log(`Failed to process track removal for peer ${userId}: ${err.message}`, "error", "Voice WebSocket:");
                }
            });

            Promise.allSettled(removePromises);

            // Clear the screen stream reference
            screenStreamRef.current = null;
            setScreenShareActive(false);

            // Update context state
            setCurrentCallStream(prev => ({
                ...prev,
                active: false,
                stream: null
            }));

            // Notify UI of changes
            debouncedStatusUpdate();
            setTimeout(debouncedStatusUpdate, 500); // Second update after delay

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

        // Optimized function to get all screen streams (local and remote)
        window.getAllScreenStreams = () => {
            const streams = [];

            // Add local screen stream if active
            if (screenStreamRef.current) {
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

            // Add all remote screen streams with validation
            remoteScreenRefs.current.forEach((stream, peerId) => {
                const videoTracks = stream.getVideoTracks();
                if (videoTracks && videoTracks.length > 0) {
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
                        // Clean up inactive tracks
                        videoTracks.forEach(track => {
                            if (track.readyState === 'ended' || !track.enabled) {
                                try {
                                    stream.removeTrack(track);
                                } catch (err) {
                                    // Ignore removal errors
                                }
                            }
                        });

                        // Include stream if it still has tracks after cleanup
                        if (stream.getVideoTracks().length > 0) {
                            streams.push({
                                type: 'remote',
                                peerId: peerId,
                                endingSoon: true,
                                stream: stream
                            });
                        }
                    }
                }
            });

            return streams;
        };

        // Function to get a specific screen stream
        window.getScreenStream = (peerId) => {
            if (!peerId) {
                return screenStreamRef.current;
            }
            return remoteScreenRefs.current.get(peerId);
        };

        // Cleanup function
        return () => {
            // Clear any pending renegotiation timeouts
            renegotiationTimeouts.current.forEach(timeout => clearTimeout(timeout));
            renegotiationTimeouts.current.clear();

            // Clean up global functions
            delete window.startScreenShare;
            delete window.stopScreenShare;
            delete window.toggleScreenShare;
            delete window.getAllScreenStreams;
            delete window.getScreenStream;

            // Final UI update
            debouncedStatusUpdate();
        };
    }, [screenSharePermission, debouncedStatusUpdate, setCurrentCallStream]);

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

    // Optimized peer connection creation
    const createNewPeerConnection = useCallback(
        async (remoteUserId, isInitiator) => {
            log(
                `Creating peer connection for ${remoteUserId}. Initiator: ${isInitiator}`,
                "debug",
                "Voice WebSocket:",
            );
            
            if (peerConnections.current.has(remoteUserId)) {
                log(
                    `Peer connection already exists for ${remoteUserId}`,
                    "debug",
                    "Voice WebSocket:",
                );
                return peerConnections.current.get(remoteUserId);
            }

            const pc = new RTCPeerConnection(iceServersConfig);
            peerConnections.current.set(remoteUserId, pc);
            
            log(`New RTCPeerConnection created for ${remoteUserId}`, "debug", "Voice WebSocket:");

            // Add audio tracks if available
            if (localStream.current) {
                log(`Adding local audio tracks for ${remoteUserId}`, "debug", "Voice WebSocket:");
                localStream.current.getAudioTracks().forEach((track) => {
                    pc.addTrack(track, localStream.current);
                });
            }

            // Always add a video transceiver for screen sharing
            const videoTransceiver = pc.addTransceiver('video', {
                direction: 'recvonly'
            });
            log(`Added video transceiver for ${remoteUserId} (direction: recvonly)`, "debug", "Voice WebSocket:");

            // Add screen share tracks if available
            if (screenStreamRef.current) {
                log(`Adding screen share tracks for ${remoteUserId}`, "debug", "Voice WebSocket:");
                try {
                    const videoTrack = screenStreamRef.current.getVideoTracks()[0];
                    if (videoTrack) {
                        await videoTransceiver.sender.replaceTrack(videoTrack);
                        videoTransceiver.direction = 'sendrecv';
                        log(`Added screen share video for ${remoteUserId}`, "debug", "Voice WebSocket:");
                    }

                    // Add audio tracks from screen share
                    screenStreamRef.current.getAudioTracks().forEach((track) => {
                        pc.addTrack(track, screenStreamRef.current);
                    });
                } catch (err) {
                    log(`Failed to add screen tracks to peer ${remoteUserId}: ${err.message}`, "error", "Voice WebSocket:");
                }
            }

            // ICE candidate handling
            pc.onicecandidate = async (event) => {
                if (event.candidate) {
                    log(`Generated ICE candidate for ${remoteUserId}`, "debug", "Voice WebSocket:");
                    try {
                        await send({
                            type: "webrtc_ice",
                            data: {
                                payload: await encrypt_base64_using_aes(
                                    btoa(JSON.stringify(event.candidate)),
                                    currentCall.secret,
                                ),
                                receiver_id: remoteUserId,
                            },
                        });
                        log(`Sent ICE candidate to ${remoteUserId}`, "debug", "Voice WebSocket:");
                    } catch (err) {
                        log(`Failed to send ICE candidate to ${remoteUserId}: ${err.message}`, "error", "Voice WebSocket:");
                    }
                } else {
                    log(`ICE gathering complete for ${remoteUserId}`, "debug", "Voice WebSocket:");
                }
            };

            // Track handling - optimized
            pc.ontrack = (event) => {
                log(
                    `Received ${event.track.kind} track from ${remoteUserId} (ID: ${event.track.id})`,
                    "debug",
                    "Voice WebSocket:"
                );

                // Enhanced track ended handler
                event.track.onended = () => {
                    log(`Track ${event.track.id} from ${remoteUserId} ended`, "debug", "Voice WebSocket:");
                    
                    // Clean up track from appropriate stream
                    if (event.track.kind === 'video') {
                        const remoteStream = remoteScreenRefs.current.get(remoteUserId);
                        if (remoteStream) {
                            remoteStream.removeTrack(event.track);
                            log(`Removed ended video track from remote screen stream`, "debug", "Voice WebSocket:");
                        }
                    } else {
                        const remoteStream = remoteAudioRefs.current.get(remoteUserId);
                        if (remoteStream) {
                            remoteStream.removeTrack(event.track);
                            log(`Removed ended audio track from remote audio stream`, "debug", "Voice WebSocket:");
                        }
                    }
                    
                    // Notify UI
                    debouncedStatusUpdate();
                };

                // Handle video tracks (screen shares)
                if (event.track.kind === 'video') {
                    let remoteStream = remoteScreenRefs.current.get(remoteUserId);
                    if (!remoteStream) {
                        log(`Creating new MediaStream for remote screen from ${remoteUserId}`, "debug", "Voice WebSocket:");
                        remoteStream = new MediaStream();
                        remoteScreenRefs.current.set(remoteUserId, remoteStream);
                    }

                    // Check if track already exists
                    const trackExists = Array.from(remoteStream.getTracks()).some(
                        track => track.id === event.track.id
                    );

                    if (!trackExists) {
                        log(`Adding remote video track from ${remoteUserId}`, "debug", "Voice WebSocket:");
                        event.track.enabled = true;
                        remoteStream.addTrack(event.track);
                        
                        // Immediate UI notification for screen shares
                        debouncedStatusUpdate();
                    }
                }
                // Handle audio tracks
                else {
                    let remoteStream = remoteAudioRefs.current.get(remoteUserId);
                    if (!remoteStream) {
                        log(`Creating new MediaStream for remote audio from ${remoteUserId}`, "debug", "Voice WebSocket:");
                        remoteStream = new MediaStream();
                        remoteAudioRefs.current.set(remoteUserId, remoteStream);
                    }

                    const trackExists = Array.from(remoteStream.getTracks()).some(
                        track => track.id === event.track.id
                    );

                    if (!trackExists) {
                        log(`Adding remote audio track from ${remoteUserId}`, "debug", "Voice WebSocket:");
                        remoteStream.addTrack(event.track);
                    }
                }

                // Update connected peers
                setConnectedPeers((prev) =>
                    Array.from(new Set([...prev, remoteUserId])),
                );
            };

            // Optimized negotiation handling
            if (isInitiator) {
                pc.onnegotiationneeded = async () => {
                    if (pc.signalingState !== 'stable') {
                        log(`Skipping negotiation for ${remoteUserId} - signaling state: ${pc.signalingState}`, "debug", "Voice WebSocket:");
                        return;
                    }

                    log(`Negotiation needed for ${remoteUserId}, creating offer`, "debug", "Voice WebSocket:");
                    
                    try {
                        const offer = await pc.createOffer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: true
                        });

                        // Verify state hasn't changed
                        if (pc.signalingState !== 'stable') {
                            log(`Signaling state changed during offer creation for ${remoteUserId}`, "debug", "Voice WebSocket:");
                            return;
                        }

                        await pc.setLocalDescription(offer);
                        log(`Created and set local offer for ${remoteUserId}`, "debug", "Voice WebSocket:");
                        
                        await send({
                            type: "webrtc_sdp",
                            data: {
                                payload: await encrypt_base64_using_aes(
                                    btoa(JSON.stringify(offer)),
                                    currentCall.secret,
                                ),
                                receiver_id: remoteUserId,
                            },
                        });
                        log(`Sent offer SDP to ${remoteUserId}`, "debug", "Voice WebSocket:");
                    } catch (error) {
                        log(`Error creating or sending offer to ${remoteUserId}: ${error}`, "error", "Voice WebSocket:");
                    }
                };
            }

            // Connection state change handling
            pc.onconnectionstatechange = () => {
                log(`Connection state with ${remoteUserId}: ${pc.connectionState}`, "debug", "Voice WebSocket:");
                
                if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
                    log(`Cleaning up connection with ${remoteUserId}`, "debug", "Voice WebSocket:");
                    
                    // Cleanup
                    peerConnections.current.delete(remoteUserId);
                    remoteAudioRefs.current.delete(remoteUserId);
                    remoteScreenRefs.current.delete(remoteUserId);
                    
                    // Clear any pending renegotiation timeouts
                    if (renegotiationTimeouts.current.has(remoteUserId)) {
                        clearTimeout(renegotiationTimeouts.current.get(remoteUserId));
                        renegotiationTimeouts.current.delete(remoteUserId);
                    }
                    
                    setConnectedPeers((prev) => prev.filter((id) => id !== remoteUserId));
                } else if (pc.connectionState === "connected") {
                    log(`Successfully connected to ${remoteUserId}`, "debug", "Voice WebSocket:");
                }
            };

            return pc;
        },
        [send, iceServersConfig, currentCall.secret, debouncedStatusUpdate],
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

    // Combined identification and ping management
    useEffect(() => {
        let pingInterval;

        // Handle identification
        if (currentCall.connected && !identified) {
            log("WebSocket connected. Sending identification.", "debug", "Voice WebSocket:");
            
            const sendIdentification = async () => {
                try {
                    if (currentCall.invite) {
                        const receiverPublicKey = await get(receiver).then(a => a.public_key);
                        await send({
                            type: "identification",
                            data: {
                                call_id: currentCall.id,
                                user_id: ownUuid,
                                receiver_id: receiver,
                                private_key_hash: privateKeyHash,
                                call_secret: await encrypt_base64_using_pubkey(btoa(currentCall.secret), receiverPublicKey),
                                call_secret_sha: await sha256(currentCall.secret),
                            },
                        });
                    } else {
                        await send({
                            type: "identification",
                            data: {
                                call_id: currentCall.id,
                                user_id: ownUuid,
                                private_key_hash: privateKeyHash,
                                call_secret_sha: await sha256(currentCall.secret),
                            },
                        });
                    }
                } catch (err) {
                    log(`Failed to send identification: ${err.message}`, "error", "Voice WebSocket:");
                }
            };
            
            sendIdentification();
        }

        // Handle ping interval
        if (currentCall.connected) {
            pingInterval = setInterval(() => {
                const time = Date.now();
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
            }, PING_INTERVAL);
        }

        return () => {
            if (pingInterval) {
                clearInterval(pingInterval);
            }
        };
    }, [currentCall.connected, identified, privateKeyHash, send, currentCall.invite, currentCall.id, currentCall.secret, ownUuid, receiver, encrypt_base64_using_pubkey, get]);

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
    const canvasRef = useRef(null);
    const videoRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const lastFrameTimeRef = useRef(0);
    const noUpdateCountRef = useRef(0);
    const streamIdRef = useRef(stream?.id);
    const isInitializedRef = useRef(false);

    // Memoized track validation
    const trackInfo = useMemo(() => {
        if (!stream) return { hasActive: false, trackIds: '', videoTrackCount: 0 };
        
        const tracks = stream.getTracks();
        const videoTracks = tracks.filter(t => t.kind === 'video');
        const hasActive = videoTracks.some(track => 
            track.enabled && track.readyState === 'live' && !track.muted
        );
        const trackIds = tracks.map(t => t.id).sort().join(',');
        
        return { hasActive, trackIds, videoTrackCount: videoTracks.length };
    }, [stream]);

    // Optimized rendering function with throttling
    const renderFrame = useCallback(() => {
        if (!canvasRef.current || !videoRef.current) return;

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        const context = canvasElement.getContext("2d", { alpha: false });

        // Only render if video is ready and has content
        if (videoElement.readyState >= 3 && videoElement.videoWidth > 0) {
            // Check for new frame by comparing currentTime
            const currentTime = videoElement.currentTime;
            if (currentTime > 0 && currentTime !== lastFrameTimeRef.current) {
                // Reset stall counter
                noUpdateCountRef.current = 0;
                lastFrameTimeRef.current = currentTime;

                // Resize canvas if video dimensions changed
                if (canvasElement.width !== videoElement.videoWidth || 
                    canvasElement.height !== videoElement.videoHeight) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                }

                // Clear and draw new frame
                context.clearRect(0, 0, canvasElement.width, canvasElement.height);
                
                try {
                    context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                } catch (err) {
                    // Silently handle drawing errors (e.g., video not ready)
                }
            } else {
                // Increment stall counter
                noUpdateCountRef.current++;

                // After 5 seconds of no updates (300 frames), show stalled message
                if (noUpdateCountRef.current > 300) {
                    const hasActiveTracks = trackInfo.hasActive;
                    
                    if (!hasActiveTracks) {
                        context.fillStyle = '#1a1a1a';
                        context.fillRect(0, 0, canvasElement.width, canvasElement.height);
                        
                        context.font = '16px sans-serif';
                        context.fillStyle = '#ffffff';
                        context.textAlign = 'center';
                        context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);
                        
                        // Trigger UI update for cleanup
                        if (typeof window !== "undefined") {
                            window.dispatchEvent(new Event("remote-streams-changed"));
                        }
                    }
                }
            }
        }

        // Continue animation loop
        animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    }, [trackInfo.hasActive]);

    useEffect(() => {
        if (!stream || !canvasRef.current) return;

        const isNewStream = streamIdRef.current !== stream.id;
        const shouldReinitialize = isNewStream || !isInitializedRef.current;

        if (shouldReinitialize) {
            log(`Initializing video for stream ${stream.id}`, "debug", "Remote Video:");
            
            // Cancel any existing animation
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }

            // Clean up previous video element
            if (videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.load();
            }

            // Create or update video element
            let videoElement = videoRef.current || document.createElement("video");
            videoRef.current = videoElement;

            // Configure video element for optimal playback
            videoElement.srcObject = stream;
            videoElement.playsInline = true;
            videoElement.autoplay = true;
            videoElement.muted = true;
            videoElement.setAttribute('playsinline', '');
            videoElement.setAttribute('webkit-playsinline', '');

            // Enable video tracks
            stream.getVideoTracks().forEach(track => {
                if (!track.enabled) {
                    track.enabled = true;
                    log(`Enabled video track: ${track.id}`, "debug", "Remote Video:");
                }
            });

            // Set up track ended handlers
            stream.getTracks().forEach(track => {
                track.onended = () => {
                    log(`Track ${track.id} ended`, "debug", "Remote Video:");
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("remote-streams-changed"));
                    }
                };
            });

            // Start video playback
            videoElement.play().catch(error => {
                log(`Video play failed for stream ${stream.id}: ${error.message}`, "debug", "Remote Video:");
            });

            // Initialize canvas
            const canvasElement = canvasRef.current;
            const context = canvasElement.getContext("2d", { alpha: false });
            
            if (!trackInfo.hasActive) {
                // Show placeholder for inactive streams
                canvasElement.width = 640;
                canvasElement.height = 360;
                context.fillStyle = '#1a1a1a';
                context.fillRect(0, 0, canvasElement.width, canvasElement.height);
                context.font = '16px sans-serif';
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.fillText('Screen sharing ended', canvasElement.width / 2, canvasElement.height / 2);
            }

            // Reset frame tracking
            lastFrameTimeRef.current = 0;
            noUpdateCountRef.current = 0;
            streamIdRef.current = stream.id;
            isInitializedRef.current = true;

            // Start rendering loop
            renderFrame();
        }

        // Cleanup function
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
            
            // Don't stop the stream tracks here to prevent breaking for other components
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [stream, trackInfo.hasActive, renderFrame]);

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