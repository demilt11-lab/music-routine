/// <reference path="../types/web-bluetooth.d.ts" />
import { useState, useCallback, useRef, useEffect } from "react";

export interface BluetoothDevice {
  id: string;
  name: string;
  type: "heart_rate" | "fitness_band" | "unknown";
  connected: boolean;
  batteryLevel?: number;
}

export interface WebBluetoothState {
  isSupported: boolean;
  isScanning: boolean;
  isConnected: boolean;
  device: BluetoothDevice | null;
  error: string | null;
  lastHeartRate: number | null;
  unsupportedReason?: string;
}

interface UseWebBluetoothReturn {
  state: WebBluetoothState;
  scanForDevices: () => Promise<void>;
  connect: (deviceId?: string) => Promise<boolean>;
  disconnect: () => void;
  onHeartRateChange: (callback: (heartRate: number) => void) => void;
}

const HEART_RATE_SERVICE = "heart_rate";
const HEART_RATE_MEASUREMENT = "heart_rate_measurement";
const BATTERY_SERVICE = "battery_service";
const BATTERY_LEVEL = "battery_level";

function detectBluetoothSupport(): { supported: boolean; reason?: string } {
  if (typeof navigator === "undefined") {
    return { supported: false, reason: "Not running in a browser environment." };
  }

  // Detect iOS (Safari never supports Web Bluetooth)
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) {
    return {
      supported: false,
      reason: "Web Bluetooth is not available on iOS. Use the Manual Heart Rate input below to log readings from your Apple Watch.",
    };
  }

  if (!("bluetooth" in navigator)) {
    return {
      supported: false,
      reason: "Your browser doesn't support Web Bluetooth. Try Chrome, Edge, or Opera on desktop/Android.",
    };
  }

  return { supported: true };
}

export function useWebBluetooth(): UseWebBluetoothReturn {
  const detection = detectBluetoothSupport();

  const [state, setState] = useState<WebBluetoothState>({
    isSupported: detection.supported,
    isScanning: false,
    isConnected: false,
    device: null,
    error: null,
    lastHeartRate: null,
    unsupportedReason: detection.reason,
  });

  // Keep the raw browser BluetoothDevice separate — never overwrite with plain objects
  const rawDeviceRef = useRef<any>(null);
  const gattServer = useRef<any>(null);
  const heartRateCallback = useRef<((heartRate: number) => void) | null>(null);
  const characteristicRef = useRef<any>(null);

  const onHeartRateChange = useCallback((callback: (heartRate: number) => void) => {
    heartRateCallback.current = callback;
  }, []);

  const parseHeartRate = (value: DataView): number => {
    const flags = value.getUint8(0);
    const is16Bit = flags & 0x01;
    return is16Bit ? value.getUint16(1, true) : value.getUint8(1);
  };

  const handleHeartRateNotification = useCallback((event: Event) => {
    const target = event.target as any;
    const value = target?.value;
    if (value) {
      const heartRate = parseHeartRate(value);
      setState(prev => ({ ...prev, lastHeartRate: heartRate }));
      heartRateCallback.current?.(heartRate);
    }
  }, []);

  const connectToGatt = async (btDevice: any): Promise<boolean> => {
    try {
      if (!btDevice?.gatt) {
        throw new Error("Device does not support GATT. Please try a different device.");
      }

      const server = await btDevice.gatt.connect();
      gattServer.current = server;

      // Get Heart Rate Service
      const heartRateService = await server.getPrimaryService(HEART_RATE_SERVICE);
      const heartRateChar = await heartRateService.getCharacteristic(HEART_RATE_MEASUREMENT);
      characteristicRef.current = heartRateChar;

      await heartRateChar.startNotifications();
      heartRateChar.addEventListener("characteristicvaluechanged", handleHeartRateNotification);

      // Try to get battery level (optional)
      let batteryLevel: number | undefined;
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL);
        const batteryValue = await batteryChar.readValue();
        batteryLevel = batteryValue.getUint8(0);
      } catch {
        // Battery service not available on this device
      }

      setState(prev => ({
        ...prev,
        isConnected: true,
        device: {
          id: btDevice.id,
          name: btDevice.name || "Unknown Device",
          type: "heart_rate",
          connected: true,
          batteryLevel,
        },
        error: null,
      }));

      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to connect";
      setState(prev => ({ ...prev, error: msg }));
      return false;
    }
  };

  const scanForDevices = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: prev.unsupportedReason || "Web Bluetooth is not supported",
      }));
      return;
    }

    setState(prev => ({ ...prev, isScanning: true, error: null }));

    try {
      const nav = navigator as any;

      let device: any;
      try {
        // First attempt: filter by heart_rate service (most reliable)
        device = await nav.bluetooth.requestDevice({
          filters: [{ services: [HEART_RATE_SERVICE] }],
          optionalServices: [BATTERY_SERVICE],
        });
      } catch (filterError: any) {
        // If user cancelled, don't retry
        if (filterError?.name === "NotFoundError" || filterError?.message?.includes("cancel")) {
          throw filterError;
        }
        // Second attempt: accept all devices (lets user pick any BLE device)
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE],
        });
      }

      if (device) {
        rawDeviceRef.current = device;

        // Listen for disconnects
        device.addEventListener("gattserverdisconnected", () => {
          setState(prev => ({
            ...prev,
            isConnected: false,
            device: prev.device ? { ...prev.device, connected: false } : null,
          }));
          gattServer.current = null;
        });

        setState(prev => ({
          ...prev,
          isScanning: false,
          device: {
            id: device.id,
            name: device.name || "Unknown Device",
            type: "heart_rate",
            connected: false,
          },
        }));

        // Auto-connect
        await connectToGatt(device);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to scan for devices";
      const isCancelled = errorMessage.includes("cancel") || (error as any)?.name === "NotFoundError";
      setState(prev => ({
        ...prev,
        isScanning: false,
        error: isCancelled ? null : errorMessage,
      }));
    }
  }, [state.isSupported, handleHeartRateNotification]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (rawDeviceRef.current) {
      return connectToGatt(rawDeviceRef.current);
    }
    await scanForDevices();
    return state.isConnected;
  }, [scanForDevices, state.isConnected]);

  const disconnect = useCallback(() => {
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener("characteristicvaluechanged", handleHeartRateNotification);
      characteristicRef.current.stopNotifications().catch(() => {});
    }

    if (gattServer.current?.connected) {
      gattServer.current.disconnect();
    }

    gattServer.current = null;
    characteristicRef.current = null;

    setState(prev => ({
      ...prev,
      isConnected: false,
      device: prev.device ? { ...prev.device, connected: false } : null,
      lastHeartRate: null,
    }));
  }, [handleHeartRateNotification]);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return { state, scanForDevices, connect, disconnect, onHeartRateChange };
}
