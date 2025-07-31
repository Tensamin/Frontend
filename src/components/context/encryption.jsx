"use client";

// Package Imports
import {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { v7 as uuidv7 } from "uuid";

// Lib Imports
import { log } from "@/lib/utils"

// Components
import { Loading } from "@/components/loading/content";

// Main
const EncryptionContext = createContext();

// Use Context Function
export function useEncryptionContext() {
  const context = useContext(EncryptionContext);
  if (context === undefined) {
    throw new Error("useEncryptionContext must be used within a EncryptionProvider");
  }
  return context;
}

// Provider
export function EncryptionProvider({ children }) {
  const [worker, setWorker] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  const requestResolvers = useRef(new Map());

  useEffect(() => {
    if (window.Worker) {
      const encryptionWorker = new Worker("/encryption.js");

      encryptionWorker.onmessage = (event) => {
        const { result, error, id } = event.data;

        if (requestResolvers.current.has(id)) {
          const { resolve, reject } = requestResolvers.current.get(id);

          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }

          requestResolvers.current.delete(id);
        }
      };

      setWorker(encryptionWorker);
      log("Encryption worker initialized and started.", "debug", "Encryption Provider:");

      return () => {
        requestResolvers.current.forEach(({ reject }) => {
          reject(new Error("EncryptionProvider unmounted."));
        });
        encryptionWorker.terminate();
        log("Encryption worker terminated.", "debug", "Encryption Provider:");
      };
    } else {
      setUnsupported(true);
    }
  }, []);

  const sendToWorker = useCallback(
    (data) => {
      if (!worker) {
        return Promise.reject(new Error("Worker is not initialized."));
      }

      return new Promise((resolve, reject) => {
        const id = uuidv7();

        const timeoutId = setTimeout(() => {
          if (requestResolvers.current.has(id)) {
            reject(new Error("Request to encryption worker timed out."));
            requestResolvers.current.delete(id);
          }
        }, 10000); // 10-second timeout

        requestResolvers.current.set(id, {
          resolve: (value) => {
            clearTimeout(timeoutId);
            resolve(value);
          },
          reject: (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
        });

        worker.postMessage({
          ...data,
          id: id,
        });
      });
    },
    [worker],
  );

  const encrypt_base64_using_aes = useCallback(
    async (data, key) => {
      return await sendToWorker({
        type: "encrypt_base64_using_aes",
        data,
        key,
      });
    },
    [sendToWorker],
  );

  const decrypt_base64_using_aes = useCallback(
    async (data, key) => {
      return await sendToWorker({
        type: "decrypt_base64_using_aes",
        data,
        key,
      });
    },
    [sendToWorker],
  );

  const encrypt_base64_using_pubkey = useCallback(
    async (data, key) => {
      return await sendToWorker({
        type: "encrypt_base64_using_pubkey",
        data,
        key,
      });
    },
    [sendToWorker],
  );

  const decrypt_base64_using_privkey = useCallback(
    async (data, key) => {
      return await sendToWorker({
        type: "decrypt_base64_using_privkey",
        data,
        key,
      });
    },
    [sendToWorker],
  );

  if (unsupported) {
    return <Loading message="This Browser is unsupported" error={true} />;
  }
  if (!worker) {
    return <Loading message="Initializing encryption worker..." />;
  }
  return (
    <EncryptionContext.Provider
      value={{
        encrypt_base64_using_aes,
        decrypt_base64_using_aes,
        encrypt_base64_using_pubkey,
        decrypt_base64_using_privkey,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}