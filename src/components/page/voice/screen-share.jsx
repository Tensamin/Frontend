import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import * as Icon from "lucide-react";

export default function ScreenShare({ onStart, onStop, isSharing }) {
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      videoRef.current.srcObject = stream;
      onStart && onStart(stream);
      setError(null);
    } catch (err) {
      setError("Screen sharing failed: " + err.message);
    }
  };

  const handleStop = () => {
    if (videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    onStop && onStop();
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      <div className="flex gap-2">
        <Button onClick={handleStart} disabled={isSharing} variant="outline">
          <Icon.Monitor /> Start Screen Share
        </Button>
        <Button onClick={handleStop} disabled={!isSharing} variant="outline">
          <Icon.X /> Stop
        </Button>
      </div>
      <video ref={videoRef} autoPlay playsInline className="w-full max-w-md rounded border mt-2" style={{ display: isSharing ? "block" : "none" }} />
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  );
}
