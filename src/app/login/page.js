"use client";

// Package Imports
import Image from "next/image";
import { toast } from "sonner";
import { useState } from "react";

// Lib Imports
import { log } from "@/lib/utils"
import { endpoint } from "@/lib/endpoints";
import { sha256, createPasskey, encrypt_base64_using_aes } from "@/lib/encryption";

// Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Main
async function readFileContent(file) {
  return await new Promise((resolve, reject) => {
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

export default function LoginForm() {
  let [formData, setFormData] = useState({ uuid: "", private_key: null, });
  let [isLoading, setIsLoading] = useState(false);
  let [useExistingPasskey, setUseExistingPasskey] = useState(false);

  // Main Stuff
  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.uuid || !formData.private_key) {
      toast("UUID or Private Key missing");
      return;
    }

    setIsLoading(true);

    try {
      let uuid = formData.uuid;

      let pem_private_key = await readFileContent(formData.private_key);

      let pemHeader = "-----BEGIN PRIVATE KEY-----";
      let pemFooter = "-----END PRIVATE KEY-----";
      let base64_private_key = pem_private_key.replace(pemHeader, "").replace(pemFooter, "").replace(/\s+/g, "");

      await fetch(endpoint.login, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uuid: uuid,
          private_key_hash: await sha256(base64_private_key),
        })
      })
        .then(response => response.json())
        .then(async data => {
          log(data.log.message, "info");
          if (data.type !== "error") {
            let encryption_value;

            if (useExistingPasskey) {
              let passkey = await navigator.credentials.get({
                publicKey: {
                  challenge: btoa("alar"),
                  rpId: window.location.hostname,
                  userVerification: 'preferred',
                  allowCredentials: [],
                  timeout: 60000
                },
              });
              encryption_value = passkey.id
              localStorage.setItem('passkey_id', encryption_value);
            } else {
              encryption_value = await createPasskey(uuid);
            }
            
            let encrypted_private_key = await encrypt_base64_using_aes(base64_private_key, encryption_value);
            let encrypted_iota_id = await encrypt_base64_using_aes(btoa(data.data.iota_id), encryption_value);
            localStorage.setItem('private_key', encrypted_private_key)
            localStorage.setItem('iota_id', encrypted_iota_id)
            localStorage.setItem('uuid', uuid)
            // Stay logged in: vanilla html
            // if (document.getElementById("stay-logged-in").checked) {
            //     document.cookie = `encryption_value=${encryption_value}; max-age=` + 30 * 24 * 60 * 60 + "; path=/; secure; samesite=strict";
            // }
            window.location.href = "/"
          } else {
            log(data.log.message, "showError")
          }
        })
        .catch(err => {
          log(err.message, "showError")
        })
    } catch (err) {
      log(err.message, "showError")
    } finally {
      setIsLoading(false);
    }
  };
  // End of Main Stuff

  function handleChange(e) {
    let { name, value, files } = e.target;

    if (name === "private_key" && files) {
      setFormData((prevData) => ({
        ...prevData,
        private_key: files[0] || null,
      }));
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  return (
    <div className="flex flex-col gap-6 h-screen justify-center items-center">
      <Card className="w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            <div className="flex justify-center gap-3 items-center">
              <Image
                src="/logo.png"
                width={35}
                height={35}
                alt="Logo"
                className="rounded"
              />
              <p>Tensamin</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="uuid">UUID</Label>
                <Input
                  type="text"
                  id="uuid"
                  name="uuid"
                  value={formData.uuid}
                  onChange={handleChange}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  required
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="private_key">Private Key</Label>
                  <a
                    href="https://docs.tensamin.methanium.net/security/regenerate-private-key"
                    className="ml-auto text-sm underline-offset-4 underline"
                  >
                    Lost your Private Key?
                  </a>
                </div>
                <Input
                  type="file"
                  id="private_key"
                  name="private_key"
                  onChange={handleChange}
                  className="text-xs"
                  required
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? "Logging in..." : "Login"}
              </Button>
              <Button type="submit" disabled={isLoading} className="w-full" variant={"outline"} onClick={() => setUseExistingPasskey(true)}>
                {isLoading ? "Logging in..." : "Login with existing Passkey"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
        By clicking Login, you agree to our{" "}
        <a href={endpoint.tos}>Terms of Service</a> and{" "}
        <a href={endpoint.pp}>Privacy Policy</a>.
      </div>
    </div>
  );
}