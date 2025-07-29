// Package Imports
import { useRef, useEffect, useState } from "react";
import { Ring } from "ldrs/react";
import "ldrs/react/Ring.css";

// Context Imports
import { useMessageContext } from "@/components/context/messages";

// Components
import { Card } from "@/components/ui/card";
import { Message, MessageLoading } from "@/components/page/chat/message";
import { MessageSend } from "@/components/page/chat/send";

// Main
export function Main({ data }) {
  let containerRef = useRef(null);
  let { messages, resetReceiver, navbarLoading, loadMoreMessages, setLoadMoreMessages, moreMessagesLoadedOnce, loadedAllMessages } = useMessageContext();

  useEffect(() => {
    resetReceiver(data);
  }, [data]);

  let messagesMap = new Map();
  messages.forEach((message) => {
    messagesMap.set(message.id, message);
  });

  let loadingMessages = [
    {
      id: 1, subMessages: [
        "",
        "",
      ]
    },
    {
      id: 2, subMessages: [
        "",
      ]
    },
    {
      id: 3, subMessages: [
        "",
        "",
      ]
    },
    {
      id: 4, subMessages: [
        "",
        "",
        "",
        "",
      ]
    },
    {
      id: 5, subMessages: [
        ""
      ]
    },
    {
      id: 6, subMessages: [
        "",
        "",
      ]
    },
    {
      id: 7, subMessages: [
        "",
        "",
      ]
    },
    {
      id: 8, subMessages: [
        "",
      ]
    },
    {
      id: 9, subMessages: [
        "",
        "",
      ]
    },
  ]

  useEffect(() => {
    if (!moreMessagesLoadedOnce) {
      let container = containerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, navbarLoading]);

  useEffect(() => {
    let container = containerRef.current;
    if (container) {
      const handleScroll = () => {
        if (container.scrollTop === 0) {
          setLoadMoreMessages(true)
        }
      };

      container.addEventListener("scroll", handleScroll);

      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  }, []);

  return (
    <div className="w-full rounded-xl h-full flex flex-col gap-2">
      <Card
        className="flex items-center font-normal flex-col overflow-y-auto flex-grow gap-0 px-2.5 py-0"
        ref={containerRef}
      >
        {loadedAllMessages ? (
          <p className="p-2 text-sm">Loaded all messages.</p>
        ) : null}
        {loadMoreMessages && !loadedAllMessages ? (
          <>
            {loadingMessages.map((message) => (
              <MessageLoading
                key={message.id}
                message={message}
              />
            ))}
          </>
        ) : null}
        {navbarLoading ? (
          <>
            {messages.map((message) => (
              <MessageLoading
                key={message.id}
                message={message}
              />
            ))}
          </>
        ) : (
          <>
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
              />
            ))}
          </>
        )}
      </Card>
      <MessageSend />
    </div>
  );
}