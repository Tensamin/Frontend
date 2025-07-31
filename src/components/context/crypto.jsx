"use client";

// Package Imports
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef, // Import useRef
} from "react";
import { useRouter } from "next/navigation";

// Lib Imports
import { log } from "@/lib/utils";
import { sha256, decrypt_base64_using_aes } from "@/lib/encryption";
import ls from "@/lib/localStorageManager";

// Components
import { Loading } from "@/components/loading/content";

// Main
let CryptoContext = createContext();

// Use Context Function
export function useCryptoContext() {
  let context = useContext(CryptoContext);
  if (context === undefined) {
    throw new Error("useCryptoContext must be used within a CryptoProvider");
  }
  return context;
}

// Provider
export function CryptoProvider({ children }) {
  let [privateKey, setPrivateKey] = useState("pending");
  let [privateKeyHash, setPrivateKeyHash] = useState("pending");
  let [IotaUUID, setIotaUUID] = useState("pending");
  let [isInitialized, setIsInitialized] = useState(false);
  let retryCountRef = useRef(0);
  let MAX_PASSKEY_RETRIES = 5;

  let router = useRouter();

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    let fetchAndDecryptPrivateKey = async () => {
      if (!isMounted) {
        return;
      }

      if (typeof window === "undefined" || !window.localStorage) {
        if (isMounted) {
          router.push("/login");
          setIsInitialized(true);
        }
        return;
      }

      let encrypted_private_key = ls.get("private_key");
      let encrypted_iota_id = ls.get("iota_id");
      let uuid = ls.get("uuid");

      if (!encrypted_private_key || !encrypted_iota_id || !uuid) {
        if (window.location.pathname !== "/login") {
          if (isMounted) {
            router.push("/login");
          }
        }
        if (isMounted) {
          setIsInitialized(true);
        }
        return;
      }

      try {
        let creds = await navigator.credentials.get({
          publicKey: {
            challenge: btoa("alar"),
            rp: { name: "Tensamin" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          },
        });

        retryCountRef.current = 0;

        let decryptedKey = await decrypt_base64_using_aes(
          encrypted_private_key,
          creds.id,
        );

        let decryptedIotaUUID = await decrypt_base64_using_aes(
          encrypted_iota_id,
          creds.id,
        );

        let privateKeyHash = await sha256(decryptedKey);

        if (isMounted) {
          setPrivateKeyHash(privateKeyHash);
          setPrivateKey(decryptedKey);
          setIotaUUID(decryptedIotaUUID);
          setIsInitialized(true);
        }
      } catch (err) {
        log(err.message, "debug", "Crypto Provider:");

        if (!isMounted) {
          return;
        }

        retryCountRef.current += 1;

        if (retryCountRef.current >= MAX_PASSKEY_RETRIES) {
          ls.remove("passkey_id");
          ls.remove("private_key");
          ls.remove("iota_id");
          ls.remove("uuid");
          if (isMounted) {
            router.push("/login");
            setIsInitialized(true);
          }
        } else {
          timeoutId = setTimeout(() => {
            fetchAndDecryptPrivateKey();
          }, 500);
        }
      }
    };

    fetchAndDecryptPrivateKey();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router]);

  if (!isInitialized) {
    return <Loading message={"Authenticating..."}/>;
  }

  if (privateKey === null) {
    router.push("/login");
    return null;
  }

  return (
    <CryptoContext.Provider value={{ privateKey, privateKeyHash, IotaUUID }}>
      {children}
    </CryptoContext.Provider>
  );
}