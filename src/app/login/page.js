"use client";

// Package Imports
import { useState, useRef } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import * as Icon from "lucide-react";

// Lib Imports
import { endpoint } from '@/lib/endpoints';
import { sha256, log } from "@/lib/utils"

// Components
import { Card, CardContent } from "@/components/ui/card"
import { EncryptionProvider } from '@/components/context/encryption';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

// Helper Functions
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsText(file);
  });
}

async function deriveWrappingKey(id) {
  let options = await fetch(endpoint.webauthn_login_options + id)
    .then(response => response.json())
    .then(data => {
      return data.options;
    })

  let assertion = await startAuthentication(options);
  let ext = assertion.getClientExtensionResults();
  let rawKey = ext.hmacGetSecret;

  return window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrapAndStorePrivateKey(privateKey, wrapKey) {
  let iv = window.crypto.getRandomValues(new Uint8Array(12));
  let pt = new TextEncoder().encode(privateKey);
  let ct = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    pt
  );
  let store = [
    iv.toString("base64"),
    ct.toString("base64"),
  ].join('|');
  localStorage.setItem('auth_private_key', store);
}

// Wrapper
export default function EncryptionWrapper() {
  return (
    <EncryptionProvider>
      <LoginForm />
    </EncryptionProvider>
  )
}

// Main
export function LoginForm() {
  let [username, setUsername] = useState("");
  let [privateKey, setPrivateKey] = useState("");
  let privateKeyFileRef = useRef(null);

  async function login(useExistingPasskey) {
    try {
      let uuid;
      let options;
      let salt;
      let verified;

      await fetch(endpoint.username_to_uuid + username)
        .then(response => response.json())
        .then(data => {
          if (data.type === "error") {
            throw new Error(data.log.message)
          } else {
            uuid = data.data.uuid;
          }
        });

      if (useExistingPasskey) {
        await fetch(endpoint.webauthn_login_options + uuid)
          .then(response => response.json())
          .then(data => {
            if (data.type === "error") {
              throw new Error(data.log.message)
            } else {
              options = data.data.options;
              salt = data.data.salt;
            }
          });
      } else {
        await fetch(endpoint.webauthn_register_options + uuid, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            private_key_hash: await sha256(privateKey)
          })
        })
          .then(response => response.json())
          .then(data => {
            if (data.type === "error") {
              throw new Error(data.log.message)
            } else {
              options = data.data.options;
              salt = data.data.salt;
            }
          });
      }

      let attestation;
      if (useExistingPasskey) {
        attestation = await startAuthentication(options);
      } else {
        attestation = await startRegistration(options);
      }

      await fetch((useExistingPasskey ? endpoint.webauthn_login_verify : endpoint.webauthn_register_verify) + uuid, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: useExistingPasskey ? JSON.stringify({ attestation }) : JSON.stringify({ private_key_hash: await sha256(privateKey), attestation })
      })
        .then(response => response.json())
        .then(data => {
          if (data.type === "error") {
            verified = false;
            throw new Error(data.log.message)
          } else {
            verified = true;
          }
        })

      if (verified) {
        let wrapKey = await deriveWrappingKey(uuid);
        await wrapAndStorePrivateKey(privateKey, wrapKey)
        alert("Finish")
        return;
        window.location.href = "/";
      }
    } catch (err) {
      log(err.message, "showError")
    }
  }

  function handleUsernameChange(event) {
    setUsername(event.target.value.toLowerCase())
  }

  async function handlePrivateKeyFileChange(files) {
    if (files[0]) {
      setPrivateKey(await readFileAsText(files[0]));
    }
  }

  function handlePrivateKeyClick() {
    privateKeyFileRef.current.click();
  }

  return (
    <div className="flex flex-col justify-center items-center w-full h-screen">
      <Card className="w-auto h-auto">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="alarm"
              value={username}
              onChange={handleUsernameChange}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="private-key">Private Key</Label>
            <div
              className="w-full h-20 border rounded-lg bg-input/30 flex"
              onClick={handlePrivateKeyClick}
            >
              <input
                ref={privateKeyFileRef}
                onChange={(e) => handlePrivateKeyFileChange(Array.from(e.target.files || []))}
                className="hidden"
                id="private-key-file"
                type="file"
              />
              <div className="h-full w-auto flex items-center pl-3">
                {privateKey === "" ? <Icon.FileKey size={30} strokeWidth={1} />
                  : <Icon.FileCheck size={30} strokeWidth={1} />}
              </div>
              <div className="h-full w-full flex flex-col items-center justify-center text-xs">
                {privateKey === "" ? (
                  <>
                    <p>Drag & Drop your private key</p>
                    <p>It will never leave your device.</p>
                  </>
                ) : <p>Private Key selected!</p>}
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2 w-full">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                login(false)
              }}
            >
              Add Device
            </Button>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                login(true)
              }}
            >
              Add Device with existing passkey
            </Button>
            <p className="text-[11px] text-center">If this is your first device click "Add Device"</p>
          </div>
        </CardContent>
      </Card>
      <br />
      <p className='text-[11px] text-muted-foreground'>By clicking "Add device" or "Add Device with existing passkey"</p> <p className='text-[11px] text-muted-foreground'> you agree to our <a href={endpoint.tos} className='underline'>Terms of Service</a> and <a href={endpoint.pp} className='underline'>Privacy Policy.</a></p>
    </div>
  )
}