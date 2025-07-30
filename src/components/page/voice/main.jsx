import { useRef, useState, useEffect, useCallback } from "react";
import { endpoint } from "@/lib/endpoints";
import { useCryptoContext } from "@/components/context/crypto";
import { log } from "@/lib/utils";
import { VoiceModal } from "@/components/page/root/user-modal/main"

export function Main({ data }) {
    let { privateKeyHash } = useCryptoContext();

    let peerConnections = useRef(new Map());
    let remoteAudioRefs = useRef(new Map());
    let ws = useRef(null);
    let localStream = useRef(null);

    let [connectedPeers, setConnectedPeers] = useState([]);
    let [identified, setIdentified] = useState(false);
    let [isMediaReady, setIsMediaReady] = useState(false);

    let localUserId = localStorage.getItem("uuid");
    let connected = ws.current.readyState === WebSocket.OPEN

    // WebSocket Send Function
    let send = useCallback((data) => {
        if (ws.current && connected) {
            ws.current.send(JSON.stringify(data));
        } else {
            log("WebSocket not open", "error", "Voice WebSocket:");
        }
    }, []);

    // Get Mic as soon as voice call loads
    useEffect(() => {
        let getMedia = async () => {
            try {
                let stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
                localStream.current = stream;
                setIsMediaReady(true);
            } catch (err) {
                log(err.message, "error", "Voice WebSocket:");
            }
        };

        getMedia();
    }, []);

    // WebSocket
    useEffect(() => {
        if (!ws.current) {
            ws.current = new WebSocket(endpoint.call_wss);

            ws.current.onopen = () => {
                log("Voice connected", "debug", "Voice WebSocket:")
            };

            ws.current.onmessage = async (event) => {
                let message = JSON.parse(event.data);

                switch (message.type) {
                    case "identification_response":
                        setIdentified(true);
                        break;

                    case "client_connected":
                        let newUser = message.data.user_id;
                        if (newUser !== localUserId) {
                            log(
                                `${newUser}: Init P2P Connection`,
                                "debug",
                                "Voice WebSocket:",
                            );
                            await createNewPeerConnection(newUser, true);
                        }
                        break;
                    case "webrtc_sdp":
                        let sdp_payload_b64 = message.data.payload;
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
                            let sdp_obj = new RTCSessionDescription(JSON.parse(sdp_payload));
                            await pc.setRemoteDescription(sdp_obj);

                            if (sdp_obj.type === "offer") {
                                let answer = await pc.createAnswer();
                                await pc.setLocalDescription(answer);

                                send({
                                    type: "webrtc_sdp",
                                    data: {
                                        payload: btoa(JSON.stringify(answer)),
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
                        let ice_payload_b64 = message.data.payload;
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

                        let pcForCandidate = peerConnections.current.get(ice_sender);
                        if (pcForCandidate && ice_payload) {
                            try {
                                await pcForCandidate.addIceCandidate(
                                    new RTCIceCandidate(JSON.parse(ice_payload)),
                                );
                            } catch (err) {
                                log(
                                    err.message,
                                    "error",
                                    "Voice WebSocket:",
                                );
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

            ws.current.onclose = () => {
                log("Voice disconnected", "debug", "Voice WebSocket:");
                ws.current = null;
            };

            ws.current.onerror = (err) => {
                log(err.message, "error", "Voice WebSocket:");
            };
        }

        return () => {
            if (ws.current) {
                log(
                    "Cleaning up WebSocket connection.",
                    "debug",
                    "Voice WebSocket:",
                );
                ws.current.close();
                ws.current = null;
            }

            log("Closing and clearing all peer connections.", "debug", "Voice WebSocket:");
            peerConnections.current.forEach((pc, userId) => {
                log(`Closing PC for ${userId}.`, "debug", "Voice WebSocket:");
                pc.close();
            });
            peerConnections.current.clear();
            remoteAudioRefs.current.clear();
            setConnectedPeers([]);
            setIdentified(false);
            setIsMediaReady(false);
            if (localStream.current) {
                localStream.current.getTracks().forEach(track => track.stop());
                localStream.current = null;
                log(
                    "Stopped local media tracks.",
                    "debug",
                    "Voice WebSocket:",
                );
            }
        };
    }, []);

    useEffect(() => {
        if (
            isMediaReady &&
            ws.current &&
            ws.current.readyState === WebSocket.OPEN &&
            !identified
        ) {
            log(
                "Local media ready and WebSocket open. Sending identification.",
                "debug",
                "Voice WebSocket:",
            );
            send({
                type: "identification",
                data: {
                    call_id: "de4e60d7-dccc-4987-b322-feba1921fa70",
                    user_id: localStorage.getItem("uuid"),
                    private_key_hash: privateKeyHash,
                },
            });
        }
    }, [isMediaReady, identified, privateKeyHash, send]);

    let createNewPeerConnection = async (remoteUserId, isInitiator) => {
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
            iceServers: [{ urls: ["stun:stun.omikron.methanium.net:5349"] }],
            iceCandidatePoolSize: 10,
        });
        peerConnections.current.set(remoteUserId, pc);
        log(`New RTCPeerConnection created for ${remoteUserId}.`, "debug", "Voice WebSocket:");

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

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                log(
                    `Generated ICE candidate for ${remoteUserId}.`,
                    "debug",
                    "Voice WebSocket:",
                );
                send({
                    type: "webrtc_ice",
                    data: {
                        payload: btoa(JSON.stringify(event.candidate)),
                        receiver_id: remoteUserId,
                    },
                });
                log(`Sent ICE candidate to ${remoteUserId}.`, "debug", "Voice WebSocket:");
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
            setConnectedPeers((prev) => Array.from(new Set([...prev, remoteUserId])));
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
                            payload: btoa(JSON.stringify(offer)),
                            receiver_id: remoteUserId,
                        },
                    });
                    log(`Sent offer SDP to ${remoteUserId}.`, "debug", "Voice WebSocket:");
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
                setConnectedPeers((prev) => prev.filter((id) => id !== remoteUserId));
            } else if (pc.connectionState === "connected") {
                log(
                    `Successfully connected to ${remoteUserId}.`,
                    "debug",
                    "Voice WebSocket:",
                );
            }
        };

        return pc;
    };

    return (
        <div className="flex flex-col">
            <div>
                <h3>Remote Participants:</h3>
                {connectedPeers.length === 0 ? (
                    <p>No remote participants connected.</p>
                ) : (
                    <p>{connectedPeers.length} Users connected</p>
                )}
                {connectedPeers.map((peerId) => {
                    let remoteStream = remoteAudioRefs.current.get(peerId);
                    let [display, setDisplay] = useState("...")
                    let [username, setUsername] = useState("...")
                    let [avatar, setAvatar] = useState("...")

                    useEffect(() => {
                        get(peerId)
                        .then(data => {
                            setDisplay(data.display)
                            setUsername(data.username)
                            setAvatar(data.avatar)
                        })
                    }, [peerId])

                    return (
                        <div key={peerId}>
                            <VoiceModal 
                                display={display}
                                username={username}
                                avatar={avatar}
                            />
                            <p>Connected to: {peerId}</p>
                            {remoteStream && (
                                <audio
                                    ref={(el) => {
                                        if (el) el.srcObject = remoteStream;
                                    }}
                                    autoPlay
                                    controls
                                    hidden
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            <p>Stuff: {data}</p>
            <p>Your User ID: {localUserId}</p>
            <p>{identified ? "You are identified" : "You are not identified"}</p>
            <p>{isMediaReady ? "Local media is ready" : "Awaiting local media"}</p>
        </div>
    );
}