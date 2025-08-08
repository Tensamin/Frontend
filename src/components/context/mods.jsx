"use client";

// Package Imports
import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";
import { usePageContext } from "@/components/context/page";

// Main
let ModsContext = createContext();

// Use Context Function
export function useModsContext() {
    let context = useContext(ModsContext);
    if (context === undefined) {
        throw new Error(
            "useModsContext must be used within a ModsProvider",
        );
    }
    return context;
}

// Provider
export function ModsProvider({ children }) {
    let [mods, setMods] = useState([{src: "/test.js", name: "Test", enabled: true}]);
    let [failed, setFailed] = useState([])

    let pageContext = usePageContext();

    useEffect(() => {
        mods.forEach(async mod => {
            if (mod.enabled) {
                fetch(mod.src)
                    .then(response => response.text())
                    .then(data => {
                        try {
                            let contexts = {
                                "usePageContext": pageContext,
                            };

                            let funcOptions = [];
                            let options = [];
                            JSON.parse(data.split("\n")[0]).forEach(option => {
                                funcOptions.push(contexts[option]);
                                options.push(option)
                            });

                            let modCode = new Function(options, data.replace((data.split("\n")[0]), ""));
                            
                            try {
                                modCode(funcOptions);
                            } catch (err) {
                                setFailed((prev) => [
                                    ...prev,
                                    { name: mod.name, error: err.message },
                                ])
                                console.log(`Failed to load [${mod.name}] [Execution]: ${err.message}`)
                            }
                        } catch (err) {
                            setFailed((prev) => [
                                ...prev,
                                {name: mod.name, error: err.message},
                            ])
                            console.log(`Failed to load [${mod.name}] [Invalid Structure]: ${err.message}`)
                        }
                    })
            } else {
                console.log("Did not load: " + mod.name);
            };
        })
    }, [mods])

    return (
        <ModsContext.Provider
            value={{
                mods,
                setMods,
            }}
        >
            {children}
        </ModsContext.Provider>
    );
}