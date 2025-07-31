// Package Imports
import { clsx } from "clsx";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge"

// Main
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export let statusColors = {
  IOTA_OFFLINE: "bg-gray-400",
  USER_OFFLINE: "bg-gray-400",
  ONLINE: "bg-green-500",
  DND: "bg-red-500",
  IDLE: "bg-yellow-500",
  WC: "bg-white"
}

export function downloadString(filename, content) {
  let blob = new Blob([content], { type: 'text/plain' });
  let link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function convertDisplayNameToInitials(displayName) {
  if (!displayName || typeof displayName !== "string") {
    return "";
  }

  let words = displayName.split(" ").filter(Boolean);

  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  } else {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
}

export function capitalizeFirstLetter(str) {
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function log(msg, type, title) {
  if (msg !== "") {
    let debug = localStorage.getItem('debug') === 'true';
    switch (type) {
      case 'error':
        console.error(msg)
        if (debug) toast.error(msg.toString())
        break;

      case 'showError':
        console.error(msg)
        toast.error(msg.toString())
        break;

      case 'warning':
        if (debug) console.warn(title || "Debug:", msg)
        toast.warning(msg)
        break;

      case 'success':
        if (debug) console.log(title || "Debug:", msg)
        toast.success(msg)
        break;

      case 'info':
        if (debug) console.log(title || "Debug:", msg)
        if (debug) toast.info(msg)
        break;

      case 'debug':
        if (debug) console.log(title || "Debug:", msg)
        break;

      default:
        break;
    }
  }
}

export function isUuid(str) {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  return uuidRegex.test(str);
}

export function isHexColor(str) {
  if (typeof str !== "string" || str.length === 0) {
    return false;
  }

  let hexColorRegex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

  return hexColorRegex.test(str);
}

export function getDisplayFromUsername(username, display_name) {
  if (display_name === "") {
    return capitalizeFirstLetter(username)
  } else {
    return display_name
  }
}

export async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!")
  } catch (err) {
    log(err.message, "showError")
  }
}

export function adjustAvatar(base64Input, bypass = false, quality = 80) {
  if (bypass || !base64Input) {
    return Promise.resolve(base64Input);
  }

  return new Promise((resolve, reject) => {
    let img = new Image();
    img.src = base64Input;

    img.onload = () => {
      let canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      let ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get 2D canvas context.'));
      }

      ctx.drawImage(img, 0, 0);

      let compressedBase64 = canvas.toDataURL('image/webp', quality / 100);
      resolve(compressedBase64);
    };

    img.onerror = (error) => {
      reject(new Error('Failed to load the input image. ' + error));
    };
  });
}

export function formatUserStatus(statusString) {
  if (typeof statusString !== 'string' || statusString.length === 0) {
    return '';
  }

  let parts = statusString.split('_');

  let formattedParts = parts.map((part) =>
    capitalizeFirstLetter(part.toLowerCase()),
  );

  return formattedParts.join(' ');
}

export async function sha256(message) {
  let encoder = new TextEncoder();
  let data = encoder.encode(message);
  let hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createPasskey(userId) {
  let creds = await navigator.credentials.create({
    publicKey: {
      challenge: btoa("alar"),
      rp: { name: "Tensamin" },
      user: {
        id: userId,
        name: userId,
        displayName: "Tensamin",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        requireResidentKey: true,
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  });

  localStorage.setItem(
    "passkey_id",
    creds.id,
  );

  return creds.id;
}

export async function getDerivedKey(passkey_id) {
  try {
    let creds = await navigator.credentials.get({
      publicKey: {
        challenge: btoa("alar"),
        allowCredentials: [
          {
            type: "public-key",
            id: passkey_id,
          },
        ],
        userVerification: "required",
      },
    });

    let signature = creds.response.signature;

    let derivedKey = await sha256(signature);
    return derivedKey;
  } catch (err) {
    throw new Error(`Could not get signature: ${err.message}`);
  }
}