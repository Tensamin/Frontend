// Package Imports
import { useRef, useState, useEffect, useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { log, sha256 } from "@/lib/utils";
import ls from "@/lib/localStorageManager";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useUsersContext } from "@/components/context/users";
import { useEncryptionContext } from "@/components/context/encryption";

// Main
export function VoiceCall() {
    let { privateKeyHash } = useCryptoContext();
    let { currentCall, setCurrentCall, ownUuid } = useUsersContext();
    let { encrypt_base64_using_aes, decrypt_base64_using_aes } =
        useEncryptionContext();

    let peerConnections = useRef(new Map());
    let remoteAudioRefs = useRef(new Map());
    let localStream = useRef(null);

    let [connectedPeers, setConnectedPeers] = useState([]);
    let [identified, setIdentified] = useState(false);

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

            if (localStream.current) {
                log(
                    `Adding local tracks to peer connection for ${remoteUserId}.`,
                    "debug",
                    "Voice WebSocket:",
                );
                localStream.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStream.current);
                });
            } else {
                log(
                    `NO LOCAL STREAM AVAILABLE TO ADD FOR ${remoteUserId}. This should not happen if identification logic is correct.`,
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
                event.streams[0].getTracks().forEach((track) => {
                    log(
                        `Adding remote track (${track.kind}) from ${remoteUserId}.`,
                        "debug",
                        "Voice WebSocket:",
                    );
                    remoteStream.addTrack(track);
                });
                setConnectedPeers((prev) =>
                    Array.from(new Set([...prev, remoteUserId])),
                );
            };

            if (isInitiator) {
                pc.onnegotiationneeded = async () => {
                    log(
                        `Negotiation needed for ${remoteUserId} (isInitiator: true). Creating offer...`,
                        "debug",
                        "Voice WebSocket:",
                    );
                    try {
                        let offer = await pc.createOffer();
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

    useEffect(() => {
        setCurrentCall((prevData) => ({
            ...prevData,
            users: connectedPeers,
        }));
    }, [connectedPeers]);

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
                        let sdp_obj = new RTCSessionDescription(
                            JSON.parse(sdp_payload),
                        );
                        await pc.setRemoteDescription(sdp_obj);

                        if (sdp_obj.type === "offer") {
                            let answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);

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

            if (localStream.current) {
                localStream.current.getTracks().forEach((track) => track.stop());
                localStream.current = null;
                log("Stopped local media tracks.", "debug", "Voice WebSocket:");
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