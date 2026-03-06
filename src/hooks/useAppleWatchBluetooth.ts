import { useState, useCallback, useRef } from "react";

interface UseAppleWatchBluetoothReturn {
  isSupported: boolean;
  isIOSSafari: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  heartRate: number | null;
  deviceName: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

function detectIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS|Chrome/.test(ua);
  return isIOS && isSafari;
}

function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function useAppleWatchBluetooth(): UseAppleWatchBluetoothReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serverRef = useRef<BluetoothRemoteGATTServer | null>(null);
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);

  const isIOSSafari = detectIOSSafari();
  const isSupported = isWebBluetoothSupported();

  const handleHRNotification = useCallback((event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    // HR format: bit 0 of flags byte — 0 = uint8, 1 = uint16
    const flags = value.getUint8(0);
    const is16Bit = flags & 0x01;
    const hr = is16Bit ? value.getUint16(1, true) : value.getUint8(1);
    setHeartRate(hr);
  }, []);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError("Web Bluetooth is not available in this browser.");
      return;
    }
    if (isIOSSafari) {
      setError("Web Bluetooth is not supported on iOS Safari. Use the BioMusic iOS app or sync via Apple Health.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
        optionalServices: ["battery_service", "device_information"],
      });

      setDeviceName(device.name || "Unknown Device");

      device.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        setHeartRate(null);
        setDeviceName(null);
      });

      const server = await device.gatt!.connect();
      serverRef.current = server;

      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");
      charRef.current = characteristic;

      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleHRNotification);

      setIsConnected(true);
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        setError("No heart rate device found. Make sure your device is nearby and in pairing mode.");
      } else if (err.name === "SecurityError") {
        setError("Bluetooth permission was denied.");
      } else if (err.message?.includes("User cancelled")) {
        setError(null); // user just closed the dialog
      } else {
        setError(err.message || "Failed to connect to device.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isSupported, isIOSSafari, handleHRNotification]);

  const disconnect = useCallback(() => {
    if (charRef.current) {
      charRef.current.removeEventListener("characteristicvaluechanged", handleHRNotification);
      try { charRef.current.stopNotifications(); } catch {}
      charRef.current = null;
    }
    if (serverRef.current?.connected) {
      serverRef.current.disconnect();
    }
    serverRef.current = null;
    setIsConnected(false);
    setHeartRate(null);
    setDeviceName(null);
    setError(null);
  }, [handleHRNotification]);

  return {
    isSupported,
    isIOSSafari,
    isConnected,
    isConnecting,
    heartRate,
    deviceName,
    error,
    connect,
    disconnect,
  };
}
