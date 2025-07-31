async function encrypt_base64_using_aes(base64String, password) {
  let decodedData = Uint8Array.from(atob(base64String), (c) =>
    c.charCodeAt(0),
  );

  let passwordEncoder = new TextEncoder();
  let passwordHash = await crypto.subtle.digest(
    "SHA-256",
    passwordEncoder.encode(password),
  );

  let derivedKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(passwordHash),
    { name: "AES-CBC", length: 256 },
    false,
    ["encrypt"],
  );

  let iv = crypto.getRandomValues(new Uint8Array(16));

  let encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    derivedKey,
    decodedData,
  );

  let combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  let base64Encrypted = btoa(String.fromCharCode(...combined));

  return base64Encrypted;
}

async function decrypt_base64_using_aes(base64EncryptedString, password) {
  let combinedDecoded = Uint8Array.from(
    atob(base64EncryptedString),
    (c) => c.charCodeAt(0),
  );

  let iv = combinedDecoded.slice(0, 16);
  let ciphertext = combinedDecoded.slice(16);

  let passwordEncoder = new TextEncoder();
  let passwordHash = await crypto.subtle.digest(
    "SHA-256",
    passwordEncoder.encode(password),
  );

  let derivedKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(passwordHash),
    { name: "AES-CBC", length: 256 },
    false,
    ["decrypt"],
  );

  let decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    derivedKey,
    ciphertext,
  );

  let decryptedData = new Uint8Array(decryptedBuffer);
  let originalBase64String = btoa(String.fromCharCode(...decryptedData));

  return originalBase64String;
}

async function encrypt_base64_using_pubkey(base64String, pemPublicKey) {
  let binaryDer = Uint8Array.from(atob(pemPublicKey), (c) =>
    c.charCodeAt(0)
  );

  // Import RSA public key
  let rsaKey = await crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  // Generate AES key
  let aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  // Export raw AES key and encrypt with RSA
  let rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  let encryptedAesKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaKey,
    rawAesKey
  );

  // Encrypt Base64 data with AES
  let iv = crypto.getRandomValues(new Uint8Array(12));
  // --- KEY CHANGE IS HERE ---
  // Decode the Base64 input data into a byte array
  let dataBytes = Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
  // ---

  let encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    dataBytes // Use the decoded byte array
  );

  // Prepare output (combines RSA-encrypted AES key + IV + AES-encrypted data)
  let payload = new Uint8Array(
    encryptedAesKey.byteLength + iv.byteLength + encryptedData.byteLength
  );

  payload.set(new Uint8Array(encryptedAesKey), 0);
  payload.set(iv, encryptedAesKey.byteLength);
  payload.set(
    new Uint8Array(encryptedData),
    encryptedAesKey.byteLength + iv.byteLength
  );

  return btoa(String.fromCharCode(...payload));
}

async function decrypt_base64_using_privkey(base64EncryptedString, pemPrivateKey) {
  let pemHeader = "-----BEGIN PRIVATE KEY-----";
  let pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = pemPrivateKey
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "");

  let keyBuffer = Uint8Array.from(atob(pemContents), (c) =>
    c.charCodeAt(0)
  ).buffer;

  try {
    let cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    let modulusLengthBits = cryptoKey.algorithm.modulusLength;

    let modulusLengthBytes = Math.ceil(modulusLengthBits / 8);

    let payload = Uint8Array.from(atob(base64EncryptedString), (c) =>
      c.charCodeAt(0)
    );

    if (payload.length < modulusLengthBytes + 12) {
      throw new Error("Invalid payload: too short");
    }

    let encryptedAesKey = payload.subarray(0, modulusLengthBytes);
    let iv = payload.subarray(modulusLengthBytes, modulusLengthBytes + 12);
    let ciphertext = payload.subarray(modulusLengthBytes + 12);

    let rawAesKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      cryptoKey,
      encryptedAesKey
    );

    let aesKey = await crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );
    let decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      aesKey,
      ciphertext
    );

    const textDecoder = new TextDecoder("utf-8");
    let finalResult = textDecoder.decode(decryptedData);
    return finalResult;

  } catch (error) {
    throw error;
  }
}

self.onmessage = async function (e) {
  let { type, data, key, id } = e.data;

  switch (type) {
    case "encrypt_base64_using_aes":
      let result1;

      try {
        result1 = await encrypt_base64_using_aes(data, key)
      } catch (err) {
        result1 = err.message
      }

      self.postMessage({ id: id, result: result1 });
      break;

    case "decrypt_base64_using_aes":
      let result2;

      try {
        result2 = await decrypt_base64_using_aes(data, key)
      } catch (err) {
        result2 = err.message
      }

      self.postMessage({ id: id, result: result2 });
      break;

    case "encrypt_base64_using_pubkey":
      let result3;

      try {
        result3 = await encrypt_base64_using_pubkey(data, key)
      } catch (err) {
        result3 = err.message
      }

      self.postMessage({ id: id, result: result3 });
      break;

    case "decrypt_base64_using_privkey":
      let result4;

      try {
        result4 = await decrypt_base64_using_privkey(data, key)
      } catch (err) {
        result4 = err.message
      }

      self.postMessage({ id: id, result: result4 });
      break;

    default:
      break;
  }
};