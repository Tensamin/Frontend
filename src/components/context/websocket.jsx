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
import { log as logFunction } from "@/lib/utils";
import { endpoint } from "@/lib/endpoints";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useUsersContext } from "@/components/context/users";

// Main
let WebSocketContext = createContext(null);

// Use Context Function
export let useWebSocketContext = () => {
  let context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider",
    );
  }
  return context;
};

// Provider
export let WebSocketProvider = ({ children }) => {
  let pendingRequests = useRef(new Map());
  let responseTimeout = 10000;
  let { privateKeyHash, IotaUUID } = useCryptoContext();
  let { setUserState, setUserStates } = useUsersContext();
  let [iotaPing, setIotaPing] = useState("?");
  let [clientPing, setClientPing] = useState("?");
  let [identified, setIdentified] = useState(false);

  let [lastMessage, setLastMessage] = useState(null);

  let handleWebSocketMessage = useCallback((event) => {
    try {
      let message = JSON.parse(event.data);

      if (message.type !== "pong") {
        logFunction(message, "debug", "Client WebSocket (Received):")
      }

      switch (message.type) {
        case "identification_response":
          setIdentified(true)
          break;

        case "get_states":
          setUserStates(message.data.user_states)
          break;

        case "client_changed":
          setUserState(message.data.user_id, message.data.user_state)
          break;

        default:
          break;
      }

      setLastMessage(message);

      if (message.id && pendingRequests.current.has(message.id)) {
        let { resolve, reject, timeoutId } = pendingRequests.current.get(message.id);
        clearTimeout(timeoutId);
        pendingRequests.current.delete(message.id);

        if (message.type !== 'error') {
          resolve(message.data);
        } else {
          reject(new Error(`Received unknown response type '${message.type}' for request ID '${message.id}'.`));
        }
      }
      else logFunction(message.log.message, "info");

    } catch (err) {
      logFunction(err.message, "error")
    }
  }, []);

  let { sendMessage, readyState } = useWebSocket(
    endpoint.client_wss,
    {
      onOpen: () => logFunction("WebSocket connected", "info"),
      onClose: () => {
        logFunction("WebSocket disconnected", "info");
        pendingRequests.current.forEach(({ reject, timeoutId }) => {
          clearTimeout(timeoutId);
          reject(
            new Error('WebSocket connection closed before response was received.')
          );
        });
        pendingRequests.current.clear();
      },
      onMessage: handleWebSocketMessage,
      shouldReconnect: () => true,
      share: true,
      reconnectAttempts: 5,
      reconnectInterval: 3000,
    }
  );

  let connected = readyState === ReadyState.OPEN;

  let send = useCallback(async (requestType, log, data = {}) => {
    if (readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING) {
      throw new Error('WebSocket is not open. Connection is closed or closing, cannot send request.');
    }

    return new Promise((resolve, reject) => {
      let id = v7();

      let messageToSend = {
        id,
        type: requestType,
        log,
        data,
      };

      if (messageToSend.type !== "ping") {
        logFunction(messageToSend, "debug", "Client WebSocket (Sent):")
      }

      let timeoutId = setTimeout(() => {
        pendingRequests.current.delete(id);
        let timeoutError = new Error(`WebSocket request timed out for ID: ${id} (Type: ${requestType}) after ${responseTimeout}ms.`);
        reject(timeoutError);
      }, responseTimeout);

      pendingRequests.current.set(id, { resolve, reject, timeoutId });

      try {
        sendMessage(JSON.stringify(messageToSend));
      } catch (e) {
        clearTimeout(timeoutId);
        pendingRequests.current.delete(id);
        let sendError = new Error(`Failed to send WebSocket message: ${e.message}`);
        logFunction(sendError, 'error');
        reject(sendError);
      }
    });
  }, [sendMessage, readyState]);

  // Pings
  useEffect(() => {
    let interval;
    if (connected) {
      interval = setInterval(async () => {
        let time = Date.now()
        await send(
          "ping",
          {
            message: "Ping from Client",
            log_level: -1
          },
          {
            last_ping: time
          }
        ).then(data => {
          let newTime = Date.now()
          setClientPing(newTime - time)
          setIotaPing(data.ping_iota || "?")
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
    if (connected) {
      sendMessage(JSON.stringify({
        type: "identification",
        log: {
          message: "Client identifying",
          log_level: 0
        },
        data: {
          iota_id: IotaUUID,
          user_id: localStorage.getItem('uuid'),
          private_key_hash: privateKeyHash
        }
      })
      )
    } else {
      setIdentified(false);
    }
  }, [connected, sendMessage]);

  // Unmount thing
  useEffect(() => {
    return () => {
      pendingRequests.current.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        let unmountError = new Error('WebSocket provider unmounted before response was received.');
        logFunction(unmountError.toString(), 'error');
        reject(unmountError);
      });
      pendingRequests.current.clear();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{
      send,
      message: lastMessage,
      connected,
      identified,
      readyState,
      iotaPing,
      clientPing,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};