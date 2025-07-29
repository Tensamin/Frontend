"use client";

// Package Imports
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { v7 } from "uuid"

// Lib Imports
import { log, getDisplayFromUsername } from "@/lib/utils";
import { endpoint } from "@/lib/endpoints";

// Main
let UsersContext = createContext();

// Use Context Function
export function useUsersContext() {
    let context = useContext(UsersContext);
    if (context === undefined) {
        throw new Error(
            "useUsersContext must be used within a UsersProvider",
        );
    }
    return context;
}

// Provider
export function UsersProvider({ children }) {
    let [fetchedUsers, setFetchedUsers] = useState({});
    let [userStates, setUserStates] = useState({})
    let [chatsArray, setChatsArray] = useState([])
    let [voiceStatus, setVoiceStatus] = useState({
        ping: 1,
        status: "CONNECTED"
    })

    function getUserState(uuid) {
        if (userStates[uuid]) {
            return userStates[uuid]
        } else {
            return "none"
        }
    }

    function setUserState(uuid, state) {
        setUserStates((prevUsers) => ({
            ...prevUsers,
            [uuid]: state,
        }));
    }

    function makeChatTop(uuid) {
        let newArray = [...chatsArray];
        let indexToMove = newArray.findIndex((item) => item.user_id === uuid);
        if (indexToMove > 0) {
            let [itemToMove] = newArray.splice(indexToMove, 1);
            newArray.unshift(itemToMove)
            setChatsArray(newArray)
        }
    }

    async function get(uuid) {
        if (fetchedUsers[uuid]) {
            log("User already fetched: " + uuid, "debug")
            return fetchedUsers[uuid];
        } else {
            let fetchedUser = await fetch(`${endpoint.user}${uuid}`)
                .then((response) => response.json())
                .then((data) => {
                    if (data.type !== "error") {
                        return data.data;
                    } else {
                        log(data.log.message, "error");
                        return null;
                    }
                })
                .catch((error) => {
                    log(
                        `Network error fetching user ${uuid}: ${error.message}`,
                        "error",
                    );
                    return null;
                });

            if (!fetchedUser) {
                return undefined;
            }

            let userToStore = {
                uuid: uuid,
                created_at: fetchedUser.created_at,
                username: fetchedUser.username,
                display: getDisplayFromUsername(fetchedUser.username, fetchedUser.display),
                avatar: fetchedUser.avatar,
                about: atob(fetchedUser.about),
                status: fetchedUser.status,
                public_key: fetchedUser.public_key,
                sub_level: fetchedUser.sub_level,
                sub_end: fetchedUser.sub_end,
            };

            setFetchedUsers((prevUsers) => ({
                ...prevUsers,
                [uuid]: userToStore,
            }));

            return userToStore;
        }
    }

    return (
        <UsersContext.Provider
            value={{
                get,
                fetchedUsers,
                userStates,
                getUserState,
                setUserState,
                setUserStates,
                chatsArray,
                setChatsArray,
                makeChatTop,
                voiceStatus,
                setVoiceStatus,
            }}
        >
            {children}
        </UsersContext.Provider>
    );
}