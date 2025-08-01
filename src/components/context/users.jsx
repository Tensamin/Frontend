"use client";

// Package Imports
import React, {
	createContext,
	useContext,
	useEffect,
	useState,
} from "react";
import { v7 } from "uuid";

// Lib Imports
import { log, getDisplayFromUsername } from "@/lib/utils";
import { endpoint } from "@/lib/endpoints";
import ls from "@/lib/localStorageManager";

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
	let [userStates, setUserStates] = useState({});
	let [chatsArray, setChatsArray] = useState([]);
	let [shouldCreateCall, setShouldCreateCall] = useState(false);
	let [gettingCalled, setGettingCalled] = useState(false);
	let [gettingCalledData, setGettingCalledData] = useState({});
	let [forceLoad, setForceLoad] = useState(false);
	let [currentCall, setCurrentCall] = useState({
		invite: false,
		connected: false,
		mute: ls.get("call_mute") === "true",
		deaf: ls.get("call_deaf") === "true",
		active_stream: true,
		id: v7(),
		secret: v7(),
		users: [],
	});
	let [newCallConnectionResolver, setNewCallConnectionResolver] = useState(null);
	let [stopCallConnectionResolver, setStopCallConnectionResolver] = useState(null);

	useEffect(() => {
		ls.set("call_mute", currentCall.mute ? "true" : "false");
		ls.set("call_deaf", currentCall.deaf ? "true" : "false");
	}, [currentCall.mute, currentCall.deaf]);

	useEffect(() => {
		if (currentCall.connected && currentCall.identified && newCallConnectionResolver) {
			newCallConnectionResolver();
			setNewCallConnectionResolver(null);
		}
	}, [currentCall.connected, currentCall.identified, newCallConnectionResolver]);

	useEffect(() => {
		if (!currentCall.connected && stopCallConnectionResolver) {
			stopCallConnectionResolver();
			setStopCallConnectionResolver(null);
		}
	}, [currentCall.connected, currentCall.identified, stopCallConnectionResolver]);

	async function startVoiceCall(id, secret, invite = false) {
		let connectionPromise = new Promise((resolve) => {
			setNewCallConnectionResolver(() => resolve);
		});

		if (typeof id !== "undefined" && typeof secret !== "undefined") {
			setCurrentCall((prevData) => ({
				...prevData,
				invite: invite,
				id: id,
				secret: secret,
			}));
		} else {
			setCurrentCall((prevData) => ({
				...prevData,
				invite: invite,
			}));
		}

		setShouldCreateCall(true);

		await connectionPromise;
	}

	async function stopVoiceCall() {
		let connectionPromise = new Promise((resolve) => {
			setStopCallConnectionResolver(() => resolve);
		});

		setShouldCreateCall(false);
		setCurrentCall((prevCall) => ({
			...prevCall,
			connected: false,
			id: v7(),
			secret: v7(),
			users: [],
		}));

		await connectionPromise;
	}

	function getUserState(uuid) {
		if (userStates[uuid]) {
			return userStates[uuid];
		} else {
			return "none";
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
			newArray.unshift(itemToMove);
			setChatsArray(newArray);
		}
	}

	async function get(uuid) {
		if (typeof uuid !== "undefined") {
			if (fetchedUsers[uuid]) {
				log("User already fetched: " + uuid, "debug");
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
					display: getDisplayFromUsername(
						fetchedUser.username,
						fetchedUser.display,
					),
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
		} else {
			return {};
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
				currentCall,
				setCurrentCall,
				shouldCreateCall,
				startVoiceCall,
				stopVoiceCall,
				forceLoad,
				setForceLoad,
				gettingCalled,
				setGettingCalled,
				gettingCalledData,
				setGettingCalledData,
				ownUuid: ls.get("auth_uuid"),
			}}
		>
			{children}
		</UsersContext.Provider>
	);
}