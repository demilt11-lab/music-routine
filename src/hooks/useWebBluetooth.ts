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
  isReconnecting: boolean;
  device: BluetoothDevice | null;
  availableDevices: BluetoothDevice[];
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
const HEART_RATE_UUID_FULL = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT = "heart_rate_measurement";
const BATTERY_SERVICE = "battery_service";
const BATTERY_LEVEL = "battery_level";

function isCapacitorIOS(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.() &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  } catch {
    return false;
  }
}

function detectBluetoothSupport(): { supported: boolean; reason?: string } {
  if (typeof navigator === "undefined") {
    return { supported: false, reason: "Not running in a browser environment." };
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // On native Capacitor iOS, don't show unsupported — HealthKit handles it
  if (isIOS && isCapacitorIOS()) {
    return { supported: false, reason: undefined };
  }

  if (isIOS) {
    return {
      supported: false,
      reason: "Web Bluetooth is not supported on iOS browsers. On iPhone/iPad: install the BioMusic app and use Apple Watch via HealthKit, OR tap Manual Entry below to log your heart rate from the Apple Health app.",
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

async function retryGattOp<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = err?.message || "";
    if (msg.includes("GATT operation failed") || msg.includes("NetworkError")) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        return await fn();
      } catch (retryErr: any) {
        throw new Error(`${label}: ${retryErr?.message || "retry failed"}`);
      }
    }
    throw new Error(`${label}: ${msg}`);
  }
}

export function useWebBluetooth(): UseWebBluetoothReturn {
  const detection = detectBluetoothSupport();

  const [state, setState] = useState<WebBluetoothState>({
    isSupported: detection.supported,
    isScanning: false,
    isConnected: false,
    isReconnecting: false,
    device: null,
    availableDevices: [],
    error: null,
    lastHeartRate: null,
    unsupportedReason: detection.reason,
  });

  const rawDeviceRef = useRef<any>(null);
  const gattServer = useRef<any>(null);
  const heartRateCallback = useRef<((heartRate: number) => void) | null>(null);
  const characteristicRef = useRef<any>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // Bluetooth availability listener
  useEffect(() => {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) return;
    const bt = (navigator as any).bluetooth;
    const handler = (e: any) => {
      setState((prev) => ({
        ...prev,
        isSupported: e.value ?? true,
        unsupportedReason: e.value ? undefined : "Bluetooth has been turned off.",
      }));
    };
    try {
      bt.addEventListener("availabilitychanged", handler);
    } catch { /* not supported in all browsers */ }
    return () => {
      try { bt.removeEventListener("availabilitychanged", handler); } catch {}
    };
  }, []);

  const onHeartRateChange = useCallback((callback: (heartRate: number) => void) => {
    heartRateCallback.current = callback;
  }, []);

  const parseHeartRate = (value: DataView): number => {
    if (!value || value.byteLength < 2) return 0;
    const flags = value.getUint8(0);
    const is16Bit = flags & 0x01;
    if (is16Bit) {
      if (value.byteLength < 3) return 0;
      return value.getUint16(1, true);
    }
    return value.getUint8(1);
  };

  const handleHeartRateNotification = useCallback((event: Event) => {
    const target = event.target as any;
    const value = target?.value;
    if (value) {
      const heartRate = parseHeartRate(value);
      if (heartRate >= 35 && heartRate <= 210) {
        setState((prev) => ({ ...prev, lastHeartRate: heartRate }));
        heartRateCallback.current?.(heartRate);
      } else if (heartRate !== 0) {
        console.warn("[WebBluetooth] Rejected out-of-range HR reading:", heartRate);
      }
    }
  }, []);

  const connectToGatt = useCallback(async (btDevice: any): Promise<boolean> => {
    try {
      if (!btDevice?.gatt) {
        throw new Error("Device does not support GATT. Please try a different device.");
      }

      const server: any = await retryGattOp(() => btDevice.gatt.connect(), "GATT connect");
      gattServer.current = server;

      const heartRateService: any = await retryGattOp(
        () => server.getPrimaryService(HEART_RATE_SERVICE),
        "Heart Rate service"
      );
      const heartRateChar: any = await retryGattOp(
        () => heartRateService.getCharacteristic(HEART_RATE_MEASUREMENT),
        "Heart Rate characteristic"
      );
      characteristicRef.current = heartRateChar;

      await retryGattOp(() => heartRateChar.startNotifications(), "Start notifications");
      heartRateChar.addEventListener("characteristicvaluechanged", handleHeartRateNotification);

      // Optional battery
      let batteryLevel: number | undefined;
      try {
        const batteryService: any = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryChar: any = await batteryService.getCharacteristic(BATTERY_LEVEL);
        const batteryValue = await batteryChar.readValue();
        batteryLevel = batteryValue.getUint8(0);
      } catch { /* Battery service not available */ }

      reconnectAttempts.current = 0;
      setState((prev) => ({
        ...prev,
        isConnected: true,
        isReconnecting: false,
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
      setState((prev) => ({ ...prev, error: msg, isReconnecting: false }));
      return false;
    }
  }, [handleHeartRateNotification]);

  // Auto-reconnect with exponential backoff
  const attemptReconnect = useCallback(async () => {
    const device = rawDeviceRef.current;
    if (!device || reconnectAttempts.current >= maxReconnectAttempts) {
      setState((prev) => ({
        ...prev,
        isReconnecting: false,
        isConnected: false,
        device: prev.device ? { ...prev.device, connected: false } : null,
        error: reconnectAttempts.current >= maxReconnectAttempts
          ? "Failed to reconnect after multiple attempts. Please re-scan."
          : prev.error,
      }));
      reconnectAttempts.current = 0;
      return;
    }

    const attempt = reconnectAttempts.current;
    reconnectAttempts.current += 1;
    const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s

    setState((prev) => ({ ...prev, isReconnecting: true }));
    await new Promise((r) => setTimeout(r, delay));

    const success = await connectToGatt(device);
    if (!success && reconnectAttempts.current < maxReconnectAttempts) {
      attemptReconnect();
    }
  }, [connectToGatt]);

  const handleDisconnect = useCallback(() => {
    gattServer.current = null;
    setState((prev) => ({
      ...prev,
      isConnected: false,
      device: prev.device ? { ...prev.device, connected: false } : null,
    }));
    attemptReconnect();
  }, [attemptReconnect]);

  const scanForDevices = useCallback(async () => {
    if (!state.isSupported) {
      const reason = state.unsupportedReason || "Web Bluetooth is not supported in this browser. Try Chrome on desktop or Android.";
      setState((prev) => ({
        ...prev,
        error: reason,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isScanning: true, error: null }));

    try {
      const nav = navigator as any;

      let device: any;
      try {
        device = await nav.bluetooth.requestDevice({
          filters: [
            { services: [HEART_RATE_SERVICE] },
            { services: [HEART_RATE_UUID_FULL] },
          ],
          optionalServices: [BATTERY_SERVICE],
        });
      } catch (filterError: any) {
        if (filterError?.name === "NotFoundError" || filterError?.message?.includes("cancel")) {
          throw filterError;
        }
        device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [HEART_RATE_SERVICE, HEART_RATE_UUID_FULL, BATTERY_SERVICE],
        });
      }

      if (device) {
        rawDeviceRef.current = device;
        reconnectAttempts.current = 0;

        device.addEventListener("gattserverdisconnected", handleDisconnect);

        const discoveredDevice: BluetoothDevice = {
          id: device.id,
          name: device.name || "Unknown Device",
          type: "heart_rate",
          connected: false,
        };

        setState((prev) => ({
          ...prev,
          isScanning: false,
          device: discoveredDevice,
          availableDevices: prev.availableDevices.some((d) => d.id === device.id)
            ? prev.availableDevices
            : [...prev.availableDevices, discoveredDevice],
        }));

        await connectToGatt(device);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to scan for devices";
      const isCancelled = errorMessage.includes("cancel") || (error as any)?.name === "NotFoundError";
      setState((prev) => ({
        ...prev,
        isScanning: false,
        error: isCancelled ? null : errorMessage,
      }));
    }
  }, [state.isSupported, handleDisconnect, connectToGatt]);

  const connect = useCallback(async (): Promise<boolean> => {
    if (rawDeviceRef.current) {
      return connectToGatt(rawDeviceRef.current);
    }
    await scanForDevices();
    return false; // actual connection status handled async
  }, [scanForDevices, connectToGatt]);

  const disconnect = useCallback(() => {
    reconnectAttempts.current = maxReconnectAttempts; // prevent auto-reconnect

    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener("characteristicvaluechanged", handleHeartRateNotification);
      characteristicRef.current.stopNotifications().catch(() => {});
    }

    if (gattServer.current?.connected) {
      gattServer.current.disconnect();
    }

    gattServer.current = null;
    characteristicRef.current = null;

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isReconnecting: false,
      device: prev.device ? { ...prev.device, connected: false } : null,
      lastHeartRate: null,
    }));
  }, [handleHeartRateNotification]);

  useEffect(() => {
    return () => {
      reconnectAttempts.current = maxReconnectAttempts;
      disconnect();
    };
  }, [disconnect]);

  return { state, scanForDevices, connect, disconnect, onHeartRateChange };
}
