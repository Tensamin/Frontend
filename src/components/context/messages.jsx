"use client";

// Package Imports
import {
  createContext,
  useState,
  useContext,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { toast } from "sonner";

// Lib Imports
import { endpoint } from "@/lib/endpoints";
import { getDisplayFromUsername, log } from "@/lib/utils";
import {
  decrypt_base64_using_privkey,
  encrypt_base64_using_aes,
  decrypt_base64_using_aes,
} from "@/lib/encryption";

// Context Imports
import { useCryptoContext } from "@/components/context/crypto";
import { useWebSocketContext } from "@/components/context/websocket";
import { useUsersContext } from "@/components/context/users";

// Main
let MessageContext = createContext();
let initialMessages = 30;

// Use Context Function
export function useMessageContext() {
  let context = useContext(MessageContext);
  if (context === undefined) {
    throw new Error(
      "useMessageContext must be used within a MessageProvider",
    );
  }
  return context;
}

// Provider
export function MessageProvider({ children }) {
  let { privateKey } = useCryptoContext();
  let { get, makeChatTop } = useUsersContext();
  let { send, connected, message } = useWebSocketContext();

  let [receiver, setReceiver] = useState("");
  let [receiverPublicKey, setReceiverPublicKey] = useState("");
  let [messages, setMessages] = useState([]);
  let [messagesAmount, setMessagesAmount] = useState(initialMessages);
  let [sharedSecret, setSharedSecret] = useState("");
  let [failedMessages, setFailedMessages] = useState(0);
  let [navbarLoading, setNavbarLoading] = useState(false);
  let [navbarLoadingMessage, setNavbarLoadingMessage] = useState(false);
  let [loadMoreMessages, setLoadMoreMessages] = useState(false);
  let [moreMessagesLoadedOnce, setMoreMessagesLoadedOnce] = useState(false);
  let [loadedAllMessages, setLoadedAllMessages] = useState(false);
  let navbarLoadingTimeoutRef = useRef(null);

  // Notifications
  let [notificationPermission, setNotificationPermission] = useState("default");
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    } else {
      console.warn("Notifications are not supported by this browser.");
    }
  }, []);

  let requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return { success: false, message: "Notifications are not supported by this browser." };
    }

    try {
      let permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        return { success: true, message: "Notifications enabled!" };
      } else {
        return { success: false, message: "Notifications have been denied!" };
      }
    } catch (err) {
      return "Error requesting notification permission: " + err.message;
    }
  });

  function sendNotification(sender, body, icon) {
    if (!("Notification" in window)) {
      log("Notifications are not supported by this browser.", "warning");
      return;
    }

    if (notificationPermission === "granted") {
      new Notification(sender, {
        body: body,
        icon: icon,
      });
    } else {
      toast.info(`${sender} sent you a message, enable notifications in the settings!`)
    }
  }

  // Main Stuff
  class Message {
    constructor(msgData) {
      this.id = msgData.id ? parseInt(msgData.id, 10) : Date.now();
      this.sender = msgData.sender;

      this.subMessages = [];

      if (msgData.content) {
        this.subMessages.push({
          content: msgData.content,
          sendToServer: msgData.sendToServer || false,
        });
      } else if (Array.isArray(msgData.messages)) {
        this.subMessages = msgData.messages;
      }
    }

    addSubMessage(content, sendToServer) {
      this.subMessages.push({ content, sendToServer });
    }
  }

  let updateNavbarLoading = useCallback((isLoading) => {
    if (navbarLoadingTimeoutRef.current) {
      clearTimeout(navbarLoadingTimeoutRef.current);
      navbarLoadingTimeoutRef.current = null;
    }

    if (isLoading) {
      setNavbarLoading(true);
    } else {
      navbarLoadingTimeoutRef.current = setTimeout(() => {
        setNavbarLoading(false);
      }, 500);
    }
  }, []);

  function resetReceiver(newReceiver) {
    setReceiver(newReceiver);
    setSharedSecret("");
    setReceiverPublicKey("");
    setFailedMessages(0);
    setLoadMoreMessages(false);
    setMessagesAmount(30);
    setMoreMessagesLoadedOnce(false);
    setLoadedAllMessages(false);
  }

  function removeSecondsFromUnixTimestamp(oldTime) {
    let middleTime = Math.floor(oldTime / 1000 / 60);
    let newTime = middleTime * 60 * 1000;
    return newTime;
  }

  async function processAndAddMessage(id, sender, content) {
    try {
      addMessage({
        id: id,
        sender: sender,
        content: atob(await decrypt_base64_using_aes(content, sharedSecret)),
        sendToServer: false,
      });
    } catch (err) {
      let stringErr = err.toString();
      if (
        stringErr === "OperationError" ||
        stringErr ===
        "OperationError: The operation failed for an operation-specific reason"
      ) {
        setFailedMessages((prev) => prev + 1);
      } else {
        log(stringErr, "error");
      }
    }
  }

  // addMessage Function
  let addMessage = useCallback((newMessageData) => {
    setMessages((prevMessages) => {
      let messageAppended = false;

      let updatedMessages = prevMessages.map((msgGroup) => {
        if (
          msgGroup.sender === newMessageData.sender &&
          removeSecondsFromUnixTimestamp(msgGroup.id) ===
          removeSecondsFromUnixTimestamp(newMessageData.id)
        ) {
          let newMsgGroup = new Message({
            id: msgGroup.id,
            sender: msgGroup.sender,
            messages: [...msgGroup.subMessages],
          });

          newMsgGroup.addSubMessage(
            newMessageData.content,
            newMessageData.sendToServer || false,
          );
          messageAppended = true;
          return newMsgGroup;
        }
        return msgGroup;
      });

      if (messageAppended) {
        return updatedMessages;
      } else {
        return [...prevMessages, new Message(newMessageData)];
      }
    });
  }, []);

  // Local add function for building chunk messages (replicates addMessage logic but returns new array instead of setting state)
  function addToChunk(chunk, newMessageData) {
    let messageAppended = false;

    let updatedChunk = chunk.map((msgGroup) => {
      if (
        msgGroup.sender === newMessageData.sender &&
        removeSecondsFromUnixTimestamp(msgGroup.id) ===
        removeSecondsFromUnixTimestamp(newMessageData.id)
      ) {
        let newMsgGroup = new Message({
          id: msgGroup.id,
          sender: msgGroup.sender,
          messages: [...msgGroup.subMessages],
        });

        newMsgGroup.addSubMessage(
          newMessageData.content,
          newMessageData.sendToServer || false,
        );
        messageAppended = true;
        return newMsgGroup;
      }
      return msgGroup;
    });

    if (messageAppended) {
      return updatedChunk;
    } else {
      return [...chunk, new Message(newMessageData)];
    }
  }

  // Loading of more messages
  useEffect(() => {
    if (loadMoreMessages && !loadedAllMessages) {
      updateNavbarLoading(true);
      setNavbarLoadingMessage("Loading more messages.");
      send(
        "message_get",
        {
          message: "Getting messages",
          log_level: 0,
        },
        {
          chat_partner_id: receiver,
          loaded_messages: messagesAmount,
          message_amount: initialMessages,
        },
      ).then(async (data) => {
        setMoreMessagesLoadedOnce(true)

        if (typeof(data.message_chunk) === "undefined") {
          setNavbarLoadingMessage("");
          updateNavbarLoading(false);
          setLoadMoreMessages(false);
          setLoadedAllMessages(true);
        } else {
          let sortedChunk = [...data.message_chunk].sort(
            (a, b) => a.message_time - b.message_time,
          );

          // Decrypt all messages in the chunk
          const decryptedChunks = await Promise.all(
            sortedChunk.map(async (chunk) => {
              try {
                const decryptedContent = atob(
                  await decrypt_base64_using_aes(
                    chunk.message_content,
                    sharedSecret,
                  ),
                );
                return {
                  id: chunk.message_time,
                  sender: chunk.sender_is_me
                    ? localStorage.getItem("uuid")
                    : receiver,
                  content: decryptedContent,
                  sendToServer: false,
                };
              } catch (err) {
                let stringErr = err.toString();
                if (
                  stringErr === "OperationError" ||
                  stringErr ===
                  "OperationError: The operation failed for an operation-specific reason"
                ) {
                  setFailedMessages((prev) => prev + 1);
                } else {
                  log(stringErr, "error");
                }
                return null; // Skip failed decryptions
              }
            }),
          );

          let chunkMessages = [];
          decryptedChunks.forEach((data) => {
            if (data) {
              chunkMessages = addToChunk(chunkMessages, data);
            }
          });

          setMessages((prev) => [...chunkMessages, ...prev]);
          setNavbarLoadingMessage("");
          updateNavbarLoading(false);
          setMessagesAmount((prev) => prev + initialMessages);
          setLoadMoreMessages(false);
        }
      });
    }
  }, [loadMoreMessages, loadedAllMessages]);

  // Initial Loading of Messages
  useEffect(() => {
    if (receiver !== "") {
      setMessages([]);
      if (receiverPublicKey === "") {
        updateNavbarLoading(true);
        setNavbarLoadingMessage("Loading receivers public key.");
        get(receiver).then((data) => {
          setReceiverPublicKey(data.public_key);
          setNavbarLoadingMessage("");
          updateNavbarLoading(false);
        });
      }
      if (sharedSecret === "") {
        updateNavbarLoading(true);
        setNavbarLoadingMessage("Loading shared secret.");
        send(
          "shared_secret_get",
          {
            message: `${localStorage.getItem("uuid")} requested shared secret of ${receiver}`,
            log_level: 1,
          },
          {
            user_id: receiver,
          },
        ).then(async (data) => {
          setSharedSecret(
            await decrypt_base64_using_privkey(
              data.shared_secret_own,
              privateKey,
            ),
          );
          setNavbarLoadingMessage("");
          updateNavbarLoading(false);
        });
      }
      if (sharedSecret !== "") {
        updateNavbarLoading(true);
        setNavbarLoadingMessage("Loading messages.");
        send(
          "message_get",
          {
            message: "Getting messages",
            log_level: 0,
          },
          {
            chat_partner_id: receiver,
            loaded_messages: 0,
            message_amount: initialMessages,
          },
        ).then(async (data) => {
          let sortedChunk = [...data.message_chunk].sort(
            (a, b) => a.message_time - b.message_time,
          );

          await Promise.all(
            sortedChunk.map(async (chunk) => {
              await processAndAddMessage(
                chunk.message_time,
                chunk.sender_is_me
                  ? localStorage.getItem("uuid")
                  : receiver,
                chunk.message_content,
              );
            }),
          );
          setNavbarLoadingMessage("");
          updateNavbarLoading(false);
        });
      }
    }
  }, [receiver, sharedSecret, receiverPublicKey]);

  // Live Messages
  useEffect(() => {
    async function doStuff() {
      if (connected && message !== null && message.type === "message_live") {
        let messageSender = message.data.sender_id;
        let messageMessage = message.data.message
        if (messageSender === receiver) {
          await processAndAddMessage(
            message.data.send_time,
            messageSender,
            messageMessage,
          );
        } else {
          get(messageSender).then(async (data) => {
            let tmpSharedSecret;
            await send(
              "shared_secret_get",
              {
                message: `${localStorage.getItem("uuid")} requested shared secret of ${receiver}`,
                log_level: 0,
              },
              {
                user_id: messageSender,
              },
            ).then(async (data) => {
              tmpSharedSecret = await decrypt_base64_using_privkey(
                data.shared_secret_own,
                privateKey,
              );
            });
            makeChatTop(messageSender)
            sendNotification(data.display, atob(await decrypt_base64_using_aes(messageMessage, tmpSharedSecret)), data.avatar)
          });
        }
      }
    }
    doStuff();
  }, [message, connected, receiver]);

  // Message Sending stuff
  useEffect(() => {
    if (receiver !== "" && sharedSecret !== "") {
      messages.forEach(async (msgGroup, groupIdx) => {
        let subMessageToSendIndex = msgGroup.subMessages.findIndex(
          (subMsg) => subMsg.sendToServer,
        );

        if (subMessageToSendIndex !== -1) {
          let subMessage = msgGroup.subMessages[subMessageToSendIndex];
          try {
            let encrypted_message = await encrypt_base64_using_aes(
              btoa(subMessage.content),
              sharedSecret,
            );

            await send(
              "message",
              {
                message: "",
                log_level: -1,
              },
              {
                receiver_id: receiver,
                message_content: encrypted_message,
              },
            );

            setMessages((prevMessages) => {
              let newPrevMessages = [...prevMessages];
              let targetGroup = newPrevMessages[groupIdx];

              if (targetGroup) {
                let updatedGroup = new Message({
                  id: targetGroup.id,
                  sender: targetGroup.sender,
                  messages: [...targetGroup.subMessages],
                });

                if (updatedGroup.subMessages[subMessageToSendIndex]) {
                  updatedGroup.subMessages[subMessageToSendIndex] = {
                    ...updatedGroup.subMessages[subMessageToSendIndex],
                    sendToServer: false,
                  };
                }
                newPrevMessages[groupIdx] = updatedGroup;
              }
              return newPrevMessages;
            });
          } catch (err) {
            log(err.message, "error");
          }
        }
      });
    }
  }, [messages, privateKey, receiverPublicKey, receiver, sharedSecret]);

  // Navbar Loading Timeout thing
  useEffect(() => {
    return () => {
      if (navbarLoadingTimeoutRef.current) {
        clearTimeout(navbarLoadingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <MessageContext.Provider
      value={{
        messages,
        addMessage,
        setReceiver,
        receiver,
        sharedSecret,
        resetReceiver,
        failedMessages,
        setFailedMessages,
        navbarLoading,
        navbarLoadingMessage,
        loadMoreMessages,
        setLoadMoreMessages,
        moreMessagesLoadedOnce,
        setMoreMessagesLoadedOnce,
        loadedAllMessages,
        setLoadedAllMessages,
        sendNotification,
        requestNotificationPermission,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
}