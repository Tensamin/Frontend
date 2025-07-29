"use client";

// Package Imports
import { 
  createContext, 
  useState, 
  useContext, 
  useEffect, 
} from "react";
import { useRouter } from "next/navigation"

// Lib Imports
import { log } from "@/lib/utils"
import { sha256, decrypt_base64_using_aes } from "@/lib/encryption"

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
  let router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      router.push("/login");
      return;
    }

    let fetchAndDecryptPrivateKey = async () => {
      try {
        let encrypted_private_key = localStorage.getItem("private_key");
        let encrypted_iota_id = localStorage.getItem("iota_id");
        let uuid = localStorage.getItem("uuid");

        if (!encrypted_private_key || !encrypted_iota_id || !uuid) {
          if (window.location.pathname !== "/login") {
            router.push("/login");
            return;
          }
        } else {
          try {
            let creds = await navigator.credentials.get({
              publicKey: {
                challenge: btoa("alar"),
                rp: { name: "Tensamin" },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
              },
            });

            let decryptedKey = await decrypt_base64_using_aes(
              encrypted_private_key,
              creds.id,
            );

            let decryptedIotaUUID = await decrypt_base64_using_aes(
              encrypted_iota_id,
              creds.id,
            );

            let privateKeyHash = await sha256(decryptedKey)

            setPrivateKeyHash(privateKeyHash);
            setPrivateKey(decryptedKey);
            setIotaUUID(decryptedIotaUUID)
          } catch (err) {
            log(err.message, "error")
            localStorage.removeItem("passkey_id");
            localStorage.removeItem("private_key");
            localStorage.removeItem("iota_id");
            localStorage.removeItem("uuid");
            router.push("/login");
          }
        }
      } catch (error) {
        router.push("/login");
      } finally {
        setIsInitialized(true);
      }
    };

    fetchAndDecryptPrivateKey();
  }, []);

  if (!isInitialized) {
    return <Loading />;
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