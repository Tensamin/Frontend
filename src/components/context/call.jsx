"use client";

// Package Imports
import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback
} from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { v7 } from "uuid"

// Lib Imports
import { log, log as logFunction, sha256 } from "@/lib/utils";
import { endpoint } from "@/lib/endpoints";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useUsersContext } from "@/components/context/users";
import { useEncryptionContext } from "@/components/context/encryption";

// Config
let webrtc_servers = {
    iceServers: [
        { urls: ["stun:stun.omikron.methanium.net:5349"] },
    ],
    iceCandidatePoolSize: 10,
};

// Main
let CallContext = createContext(null);

// Use Context Function
export let useCallContext = () => {
    let context = useContext(CallContext);
    if (!context) {
        throw new Error(
            "useCallContext must be used within a CallProvider",
        );
    }
    return context;
};

// Provider
export let CallProvider = ({ children }) => {
    // WebSocket Send Function
    let pendingRequests = useRef(new Map());
    let responseTimeout = 10000;

    // Basic Functions
    let { encrypt_base64_using_aes, decrypt_base64_using_aes, encrypt_base64_using_pubkey } = useEncryptionContext();
    let { privateKeyHash } = useCryptoContext();
    let { ownUuid, get } = useUsersContext();

    // Calling Stuff
    let [createCall, setCreateCall] = useState(false);

    let [clientPing, setClientPing] = useState(0);
    let [connected, setConnected] = useState(false);

    let [callId, setCallId] = useState(null);
    let [callSecret, setCallSecret] = useState(null);
    let [identified, setIdentified] = useState(false);

    let [mute, setMute] = useState(ls.get("call_mute") === "true" || false);
    let [deaf, setDeaf] = useState(ls.get("call_deaf") === "true" || false);
    let [stream, setStream] = useState(false);

    // WebRTC
    let micStreamRef = useRef(null);
    let screenStreamRef = useRef(null);

    let micRefs = useRef(new Map());
    let screenRefs = useRef(new Map());
    let audioRefs = useRef(new Map()); // Separate ref for audio elements
    let audioStreamsRefs = useRef(new Map()); // Separate ref for audio streams

    let [connectedUsers, setConnectedUsers] = useState([]);
    let [streamingUsers, setStreamingUsers] = useState([]);

    // Main
    let toggleMute = useCallback(() => {
        setMute((prevMute) => {
            ls.set("call_mute", !prevMute);
            return !prevMute;
        });
    }, []);

    // Toggle Deaf
    let toggleDeaf = useCallback(() => {
        setDeaf((prevDeaf) => {
            ls.set("call_deaf", !prevDeaf);
            return !prevDeaf;
        });
    }, []);

    // Start Screen Stream
    let startScreenStream = useCallback(async (resolution = "1280x720", framerate = 30, audio = false) => {
        try {
            let stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: framerate, max: framerate },
                    width: { ideal: resolution.split("x")[0], max: resolution.split("x")[0] },
                    height: { ideal: resolution.split("x")[1], max: resolution.split("x")[1] }
                },
                audio: audio
            });

            screenStreamRef.current = stream;
            setStream(true);

            async function addScreenShareToPeers() {
                let addPromises = Array.from(screenRefs.current.entries()).map(async ([id, pc]) => {
                    try {
                        if (pc.connectionState !== 'connected' || pc.signalingState !== 'stable') {
                            return;
                        }

                        let videoTrack = stream.getVideoTracks()[0];
                        let audioTracks = stream.getAudioTracks();

                        let transceivers = pc.getTransceivers();
                        let videoTransceiver = transceivers.find(t =>
                            t.receiver && t.receiver.track && t.receiver.track.kind === 'video'
                        ) || transceivers.find(t => t.mid !== null && t.direction.includes('recv'));

                        if (videoTransceiver && videoTrack) {
                            await videoTransceiver.sender.replaceTrack(videoTrack);
                            videoTransceiver.direction = 'sendrecv';
                        }

                        audioTracks.forEach(track => {
                            pc.addTrack(track, stream);
                        });
                    } catch (err) {
                        logFunction(`Failed to add screen tracks to peer ${id}: ${err.message}`, "error", "Voice WebSocket:");
                    }
                });

                await Promise.allSettled(addPromises);
            }; await addScreenShareToPeers();

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenStream();
            });

            logFunction("Screen share started", "success");
            return stream;
        } catch (err) {
            setStream(false);
            log(err.message, "error");
        }
    }, []);

    // Stop Screen Stream
    let stopScreenStream = useCallback(() => {
        if (!screenStreamRef.current) {
            return;
        }

        let tracksToRemove = screenStreamRef.current.getTracks().map(track => ({
            id: track.id,
            kind: track.kind
        }));

        screenStreamRef.current.getTracks().forEach(track => {
            track.stop();
        });

        let removePromises = Array.from(screenRefs.current.entries()).map(async ([id, pc]) => {
            try {
                if (pc.connectionState === 'closed') return;

                let transceivers = pc.getTransceivers();
                let trackRemoved = false;

                tracksToRemove.forEach(trackInfo => {
                    if (trackInfo.kind === 'video') {
                        let videoTransceiver = transceivers.find(t =>
                            t.sender.track && t.sender.track.id === trackInfo.id
                        );

                        if (videoTransceiver) {
                            try {
                                videoTransceiver.sender.replaceTrack(null);
                                videoTransceiver.direction = 'recvonly';
                                trackRemoved = true;
                            } catch (err) {
                                logFunction(`Error resetting video transceiver for peer ${id}: ${err.message}`, "error", "Voice WebSocket:");
                            }
                        }
                    } else {
                        let senders = pc.getSenders();
                        let sender = senders.find(s => s.track && s.track.id === trackInfo.id);
                        if (sender) {
                            try {
                                pc.removeTrack(sender);
                                trackRemoved = true;
                            } catch (err) {
                                logFunction(`Error removing ${trackInfo.kind} track from peer ${id}: ${err.message}`, "error", "Voice WebSocket:");
                            }
                        }
                    }
                });

                if (trackRemoved && pc.signalingState === 'stable' && pc.connectionState === 'connected') {
                    await pc.setLocalDescription(pc.localDescription);
                }
            } catch (err) {
                logFunction(`Error stopping screen stream for peer ${id}: ${err.message}`, "error", "Voice WebSocket:");
            }
        });

        Promise.allSettled(removePromises);
        screenStreamRef.current = null;
        setStream(false);
    }, [])

    // Get Screen Stream
    let getScreenStream = useCallback((id) => {
        if (!id) {
            return screenStreamRef.current;
        }
        return screenRefs.current.get(id);
    }, []);

    // Get All Screen Streams
    let getAllScreenStreams = useCallback(() => {
        let streams = [];

        if (screenStreamRef.current && stream) {
            let localVideoTracks = screenStreamRef.current.getVideoTracks();
            let localHasActiveTracks = localVideoTracks.some(
                track => track.enabled && track.readyState === 'live'
            );

            if (localHasActiveTracks) {
                streams.push({
                    my_stream: true,
                    stream: screenStreamRef.current
                });
            }
        }

        screenRefs.current.forEach((stream, id) => {
            let videoTracks = stream.getVideoTracks();
            if (videoTracks && videoTracks.length > 0) {
                let hasActiveTracks = videoTracks.some(
                    track => track.enabled && track.readyState === 'live'
                );

                if (hasActiveTracks) {
                    streams.push({
                        type: 'remote',
                        peerId: id,
                        stream: stream
                    });
                } else {
                    videoTracks.forEach(track => {
                        if (track.readyState === 'ended' || !track.enabled) {
                            try {
                                stream.removeTrack(track);
                            } catch (err) {
                                // Ignore removal errors
                            }
                        }
                    });

                    if (stream.getVideoTracks().length > 0) {
                        streams.push({
                            type: 'remote',
                            peerId: id,
                            endingSoon: true,
                            stream: stream
                        });
                    }
                }
            }
        });

        return streams;
    }, [])

    // Handle WebSocket Messages
    let handleWebSocketMessage = useCallback(async (event) => {
        let message = JSON.parse(event.data);

        if (message.type !== "pong") {
            logFunction(message, "debug", "Call WebSocket (Received):")
        }

        switch (message.type) {
            case "client_connected":
                createP2PConnection(message.data.user_id, true);
                break;

            case "client_closed":
                if (screenRefs.current.has(message.data.user_id)) {
                    let screenPc = screenRefs.current.get(message.data.user_id);
                    screenPc.close();
                    screenRefs.current.delete(message.data.user_id);
                }

                if (micRefs.current.has(message.data.user_id)) {
                    let micPc = micRefs.current.get(message.data.user_id);
                    micPc.close();
                    micRefs.current.delete(message.data.user_id);
                }

                // Clean up audio references
                audioRefs.current.delete(message.data.user_id);
                audioStreamsRefs.current.delete(message.data.user_id);

                setConnectedUsers((prev) => prev.filter(userId => userId !== message.data.user_id));
                break;

            case "webrtc_sdp":
                let sdp_sender = message.data.sender_id;
                let sdp_isScreenShare = message.data.screen_share;
                let sdp_payload;

                try {
                    sdp_payload = atob(await decrypt_base64_using_aes(message.data.payload, callSecret));
                } catch (err) {
                    log(
                        `${sdp_sender}: ${err.message}`,
                        "error",
                        "Voice WebSocket:",
                    );
                    return;
                }

                let sdp_pc;
                if (sdp_isScreenShare) {
                    sdp_pc = screenRefs.current.get(sdp_sender);
                } else {
                    sdp_pc = micRefs.current.get(sdp_sender);
                }

                if (!sdp_pc) {
                    sdp_pc = await createP2PConnection(sdp_sender, false, sdp_isScreenShare);
                }

                try {
                    let sdp_obj = new RTCSessionDescription(
                        JSON.parse(sdp_payload),
                    );
                    await sdp_pc.setRemoteDescription(sdp_obj);
                    if (sdp_obj.type === "offer") {
                        let answer = await sdp_pc.createAnswer({
                            offerToReceiveAudio: !sdp_isScreenShare,
                            offerToReceiveVideo: sdp_isScreenShare,
                        });

                        await sdp_pc.setLocalDescription(answer);

                        send("webrtc_sdp", {
                            message: "Sending SDP Answer",
                            log_level: 0,
                        }, {
                            payload: await encrypt_base64_using_aes(
                                btoa(JSON.stringify(answer)),
                                callSecret,
                            ),
                            screen_share: sdp_isScreenShare,
                            receiver_id: sdp_sender,
                        }, false)

                        log(
                            `Answer sent to ${sdp_sender}`,
                            "success",
                        );
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
                let ice_sender = message.data.sender_id;
                let ice_isScreenShare = message.data.screen_share;
                let ice_payload;

                try {
                    ice_payload = atob(await decrypt_base64_using_aes(message.data.payload, callSecret));
                } catch (err) {
                    logFunction(`${ice_sender}: ${err.message}`, "error", "Voice WebSocket:");
                    return;
                }

                let ice_pc;
                if (ice_isScreenShare) {
                    ice_pc = screenRefs.current.get(ice_sender);
                } else {
                    ice_pc = micRefs.current.get(ice_sender);
                }

                if (ice_pc && ice_payload) {
                    try {
                        await ice_pc.addIceCandidate(
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

            case "start_stream":
                setStreamingUsers((prev) => {
                    if (!prev.includes(message.data.user_id)) {
                        return [...prev, message.data.user_id];
                    }
                    return prev;
                });
                break;

            case "end_stream":
                setStreamingUsers((prev) => prev.filter(userId => userId !== message.data.user_id));
                break;

            default:
                break;
        }

        if (message.id && pendingRequests.current.has(message.id)) {
            let { resolve, reject, timeoutId } = pendingRequests.current.get(message.id);
            clearTimeout(timeoutId);
            pendingRequests.current.delete(message.id);

            if (message.type !== 'error' || !identified) {
                resolve(message);
            } else {
                reject(new Error(`Received unknown response type '${message.type}' for request ID '${message.id}'.`));
            }
        } else logFunction(message.log.message, "info");
    }, []);

    // Init WebSocket
    let { sendMessage, readyState } = useWebSocket(
        createCall && callId && callSecret ? endpoint.call_wss : null,
        {
            onOpen: async () => {
                logFunction("Call connected", "info");
                micStreamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
            },
            onClose: () => {
                logFunction("Call disconnected", "info");
                pendingRequests.current.forEach(({ reject, timeoutId }) => {
                    clearTimeout(timeoutId);
                    reject(
                        new Error('Call WebSocket connection closed before response was received.')
                    );
                });
                pendingRequests.current.clear();

                setConnected(false);
                setIdentified(false);
                micRefs.current.clear();
                screenRefs.current.clear();
                audioRefs.current.clear();
                audioStreamsRefs.current.clear();
            },
            onMessage: handleWebSocketMessage,
            shouldReconnect: () => createCall && callId && callSecret,
            share: true,
            reconnectAttempts: 5,
            reconnectInterval: 3000,
        }
    );

    // Send Function
    let send = useCallback(async (requestType, log, data = {}, awaitResponse = true) => {
        if (readyState !== ReadyState.CLOSED && readyState !== ReadyState.CLOSING) {
            if (awaitResponse) {
                return new Promise((resolve, reject) => {
                    let id = v7();

                    let messageToSend = {
                        id,
                        type: requestType,
                        log,
                        data,
                    };

                    if (messageToSend.type !== "ping") {
                        logFunction(messageToSend, "debug", "Call WebSocket (Sent):")
                    }

                    let timeoutId = setTimeout(() => {
                        pendingRequests.current.delete(id);
                        let timeoutError = new Error(`Call WebSocket request timed out for ID: ${id} (Type: ${requestType}) after ${responseTimeout}ms.`);
                        reject(timeoutError);
                    }, responseTimeout);

                    pendingRequests.current.set(id, { resolve, reject, timeoutId });

                    try {
                        sendMessage(JSON.stringify(messageToSend));
                    } catch (e) {
                        clearTimeout(timeoutId);
                        pendingRequests.current.delete(id);
                        let sendError = new Error(`Failed to send Call WebSocket message: ${e.message}`);
                        logFunction(sendError, 'error');
                        reject(sendError);
                    }
                });
            } else {
                let messageToSend = {
                    type: requestType,
                    log,
                    data,
                };

                if (messageToSend.type !== "ping") {
                    logFunction(messageToSend, "debug", "Call WebSocket (Sent):")
                }

                sendMessage(JSON.stringify(messageToSend));
            }
        } else {
            logFunction("Call WebSocket not connected", "warning", "Voice WebSocket:");
        }
    }, [sendMessage, connected]);

    // Create P2P Connection
    let createP2PConnection = useCallback(async (id, isInitiator = false, isScreenShare = false) => {
        // Handle Existing Connections
        if (isScreenShare) {
            if (screenRefs.current.has(id)) {
                logFunction("Reusing existing screen share connection", "debug", "Voice WebSocket:");
                return screenRefs.current.get(id);
            }
        } else {
            if (micRefs.current.has(id)) {
                logFunction("Reusing existing mic connection", "debug", "Voice WebSocket:");
                return micRefs.current.get(id);
            }
        }

        // Create New Peer Connection
        let pc = new RTCPeerConnection(webrtc_servers);

        if (isScreenShare) {
            logFunction(`Creating new screen share connection for ${id}`, "debug", "Voice WebSocket:");
            screenRefs.current.set(id, pc);
        } else {
            logFunction(`Creating new mic connection for ${id}`, "debug", "Voice WebSocket:");
            micRefs.current.set(id, pc);
        }

        // Add Own Mic Stream
        if (micStreamRef.current && !isScreenShare) {
            logFunction(`Adding own mic stream for ${id}`, "debug", "Voice WebSocket:");
            micStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, micStreamRef.current);
            });
        }

        // Add Own Screen Stream
        if (screenStreamRef.current && isScreenShare) {
            logFunction(`Adding own screen stream for ${id}`, "debug", "Voice WebSocket:");
            let videoTransceiver = pc.addTransceiver('video', {
                direction: 'recvonly'
            });

            let videoTrack = screenStreamRef.current.getVideoTracks()[0];

            if (videoTrack) {
                await videoTransceiver.sender.replaceTrack(videoTrack);
                videoTransceiver.direction = 'sendrecv';
            }

            screenStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, screenStreamRef.current);
            });
        }

        // ICE Candidates
        pc.onicecandidate = async (event) => {
            if (event.candidate) {
                logFunction("Sending ICE Candidate", "debug", "Voice WebSocket:");
                send("webrtc_ice", {
                    message: "Sending ICE Candidate",
                    log_level: 0
                }, {
                    payload: await encrypt_base64_using_aes(
                        btoa(JSON.stringify(event.candidate)),
                        callSecret,
                    ),
                    screen_share: isScreenShare,
                    receiver_id: id,
                }, false);
            }
        };

        // Track Events
        pc.ontrack = (event) => {
            event.track.onended = async () => {
                if (isScreenShare) {
                    let stream = screenRefs.current.get(id);
                    if (stream) {
                        stream.removeTrack(event.track);
                        await send("end_stream", {
                            message: "Sending End Stream Status",
                            log_level: 0
                        }, {
                            user_id: id,
                        })
                    };
                } else {
                    let stream = audioStreamsRefs.current.get(id);
                    if (stream) {
                        stream.removeTrack(event.track);
                    };
                }
            }

            // Handle Tracks
            if (isScreenShare) {
                let stream = screenRefs.current.get(id);
                if (!stream) {
                    stream = new MediaStream();
                    screenRefs.current.set(id, stream);
                }

                event.track.enabled = true;
                stream.addTrack(event.track);
                send("start_stream", {
                    message: "Sending Start Stream Status",
                    log_level: 0
                }, {
                    user_id: id,
                });
            } else {
                let stream = audioStreamsRefs.current.get(id);
                if (!stream) {
                    stream = new MediaStream();
                    audioStreamsRefs.current.set(id, stream);
                }

                event.track.enabled = true;
                stream.addTrack(event.track);
                
                let audioElement = audioRefs.current.get(id);
                if (audioElement && stream instanceof MediaStream) {
                    audioElement.srcObject = stream;
                    logFunction(`Set audio stream for user ${id} (immediate)`, "debug");
                } else if (audioElement && stream) {
                    logFunction(`Invalid stream type for user ${id}: ${typeof stream}`, "warning");
                } else {
                    logFunction(`Audio element not yet available for user ${id}, will be set when element is created`, "debug");
                }
            }
        };

        if (isInitiator) {
            let negotiationInProgress = false;
            
            pc.onnegotiationneeded = async () => {
                if (pc.signalingState !== "stable" || negotiationInProgress) {
                    return;
                }

                // Check if we already have a remote description (meaning negotiation already happened)
                if (pc.remoteDescription) {
                    return;
                }

                negotiationInProgress = true;

                try {
                    let offer = await pc.createOffer({
                        offerToReceiveAudio: !isScreenShare,
                        offerToReceiveVideo: isScreenShare,
                    });

                    if (pc.signalingState !== "stable") {
                        return;
                    }

                    await pc.setLocalDescription(offer);

                    send("webrtc_sdp", {
                        message: "Sending SDP Offer",
                        log_level: 0
                    }, {
                        payload: await encrypt_base64_using_aes(
                            btoa(JSON.stringify(offer)),
                            callSecret,
                        ),
                        screen_share: isScreenShare,
                        receiver_id: id,
                    }, false);
                } finally {
                    negotiationInProgress = false;
                }
            }
        }

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
                if (isScreenShare) {
                    screenRefs.current.delete(id);
                } else {
                    micRefs.current.delete(id);
                    audioRefs.current.delete(id);
                    audioStreamsRefs.current.delete(id);
                }
            } else if (pc.connectionState === "connected") {
                logFunction(`Connected to ${id}`, "success");
                setConnectedUsers((prev) => {
                    if (!prev.includes(id)) {
                        return [...prev, id];
                    }
                    return prev;
                });
                
                // If this is a mic connection and we already have an audio stream, 
                // we need to ensure the audio element gets the stream when it's created
                if (!isScreenShare) {
                    setTimeout(() => {
                        let audioElement = audioRefs.current.get(id);
                        let stream = audioStreamsRefs.current.get(id);
                        if (audioElement && stream && stream instanceof MediaStream) {
                            audioElement.srcObject = stream;
                            logFunction(`Set audio stream for user ${id}`, "debug");
                        } else if (audioElement && stream) {
                            logFunction(`Invalid stream type for user ${id}: ${typeof stream}`, "warning");
                        }
                    }, 100);
                }
            }
        };

        return pc;
    }, [send, webrtc_servers, encrypt_base64_using_aes, callSecret]);

    // Update Connected State
    useEffect(() => {
        setConnected(readyState === ReadyState.OPEN);
    }, [readyState]);

    // Pings
    useEffect(() => {
        let interval;
        if (connected) {
            interval = setInterval(async () => {
                let time = Date.now()
                await send("ping",
                    {
                        message: "Ping from Client",
                        log_level: -1
                    },
                    {
                        last_ping: clientPing,
                    }
                ).then(() => {
                    let newTime = Date.now()
                    setClientPing(newTime - time)
                })
                    .catch(err => {
                        logFunction(err.message, "info")
                    })
            }, 10000);
        } else {
            clearInterval(interval);
        }

        return () => clearInterval(interval);
    }, [connected, send]);

    // Identification
    useEffect(() => {
        async function sendIdentification() {
            if (connected) {
                send("identification",
                    {
                        message: "Client identifying",
                        log_level: 0
                    },
                    {
                        call_id: callId,
                        user_id: ownUuid,
                        private_key_hash: privateKeyHash,
                        call_secret_sha: await sha256(callSecret),
                    })
                    .then(data => {
                        if (data.type === "identification_response") {
                            setIdentified(true)
                        } else {
                            setIdentified(false);
                        }
                    })
            } else {
                setIdentified(false);
            }
        }

        sendIdentification();
    }, [connected, send]);

    // Mute
    useEffect(() => {
        if (micStreamRef.current) {
            micStreamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = !mute;
            });
        }
    }, [mute]);

    // Unmount Cleanup
    useEffect(() => {
        return () => {
            pendingRequests.current.forEach(({ reject, timeoutId }) => {
                clearTimeout(timeoutId);
                let unmountError = new Error('WebSocket provider unmounted before response was received.');
                logFunction(unmountError.toString(), 'error');
                reject(unmountError);
            });
            pendingRequests.current.clear();

            micStreamRef.current?.getTracks().forEach(track => track.stop());
            screenStreamRef.current?.getTracks().forEach(track => track.stop());
            micRefs.current.clear();
            screenRefs.current.clear();
            audioRefs.current.clear();
            audioStreamsRefs.current.clear();
            setConnectedUsers([]);
            setStreamingUsers([]);
            setCreateCall(false);
            setCallId(null);
            setCallSecret(null);
            setIdentified(false);
            setClientPing("?");
            setConnected(false);
        };
    }, []);

    return (
        <CallContext.Provider value={{
            callId,
            setCallId,
            callSecret,
            setCallSecret,

            clientPing,
            connected,
            setCreateCall,

            mute,
            toggleMute,

            deaf,
            toggleDeaf,

            stream,
            startScreenStream,
            stopScreenStream,
            getScreenStream,
            getAllScreenStreams,

            connectedUsers,
            streamingUsers,
        }}>
            <div hidden>
                {connected ? connectedUsers.map((id) => (
                    <audio
                        key={id}
                        ref={(el) => {
                            if (el) {
                                audioRefs.current.set(id, el);
                                // Set the stream if it already exists
                                let stream = audioStreamsRefs.current.get(id);
                                if (stream && stream instanceof MediaStream) {
                                    el.srcObject = stream;
                                    logFunction(`Set existing audio stream for user ${id}`, "debug");
                                } else if (stream) {
                                    logFunction(`Invalid stream type for user ${id}: ${typeof stream}`, "warning");
                                }
                            } else {
                                audioRefs.current.delete(id);
                            }
                        }}
                        autoPlay
                        muted={deaf}
                        volume={1.0}
                    />
                )) : null}
            </div>
            {children}
        </CallContext.Provider>
    );
};