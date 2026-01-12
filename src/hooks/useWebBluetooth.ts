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
}

interface UseWebBluetoothReturn {
  state: WebBluetoothState;
  scanForDevices: () => Promise<void>;
  connect: (deviceId?: string) => Promise<boolean>;
  disconnect: () => void;
  onHeartRateChange: (callback: (heartRate: number) => void) => void;
}

// Standard Bluetooth Heart Rate Service UUID
const HEART_RATE_SERVICE = "heart_rate";
const HEART_RATE_MEASUREMENT = "heart_rate_measurement";
const BATTERY_SERVICE = "battery_service";
const BATTERY_LEVEL = "battery_level";

export function useWebBluetooth(): UseWebBluetoothReturn {
  const [state, setState] = useState<WebBluetoothState>({
    isSupported: typeof navigator !== "undefined" && "bluetooth" in navigator,
    isScanning: false,
    isConnected: false,
    device: null,
    error: null,
    lastHeartRate: null,
  });

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServer = useRef<any>(null);
  const heartRateCallback = useRef<((heartRate: number) => void) | null>(null);
  const characteristicRef = useRef<any>(null);

  const onHeartRateChange = useCallback((callback: (heartRate: number) => void) => {
    heartRateCallback.current = callback;
  }, []);

  const parseHeartRate = (value: DataView): number => {
    // Heart Rate Measurement characteristic format
    // First byte contains flags
    const flags = value.getUint8(0);
    const is16Bit = flags & 0x01;
    
    // Heart rate value is in byte 1 (or bytes 1-2 if 16-bit)
    if (is16Bit) {
      return value.getUint16(1, true);
    }
    return value.getUint8(1);
  };

  const handleHeartRateNotification = useCallback((event: Event) => {
    const target = event.target as any;
    const value = target?.value;
    
    if (value) {
      const heartRate = parseHeartRate(value);
      setState(prev => ({ ...prev, lastHeartRate: heartRate }));
      
      if (heartRateCallback.current) {
        heartRateCallback.current(heartRate);
      }
    }
  }, []);

  const scanForDevices = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: "Web Bluetooth is not supported in this browser" }));
      return;
    }

    setState(prev => ({ ...prev, isScanning: true, error: null }));

    try {
      // Request device with heart rate service
      const nav = navigator as any;
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [HEART_RATE_SERVICE] },
          // Also accept devices by name patterns (common fitness devices)
          { namePrefix: "Polar" },
          { namePrefix: "Wahoo" },
          { namePrefix: "Garmin" },
          { namePrefix: "Fitbit" },
          { namePrefix: "WHOOP" },
          { namePrefix: "Apple Watch" },
          { namePrefix: "Mi Band" },
          { namePrefix: "Galaxy Watch" },
        ],
        optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE],
      });

      if (device) {
        const deviceInfo = {
          id: device.id,
          name: device.name || "Unknown Device",
          type: "heart_rate" as const,
          connected: false,
        };

        bluetoothDeviceRef.current = device;
        
        // Add disconnect listener
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
          device: deviceInfo,
        }));

        // Auto-connect after discovery
        await connectToDevice(device);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to scan for devices";
      setState(prev => ({
        ...prev,
        isScanning: false,
        error: errorMessage.includes("cancelled") ? null : errorMessage,
      }));
    }
  }, [state.isSupported]);

  const connectToDevice = async (device: { id: string; name: string; type: string; connected: boolean }): Promise<boolean> => {
    try {
      // Get the actual BluetoothDevice from the browser
      const nav = navigator as any;
      const btDevice = await nav.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [BATTERY_SERVICE],
      });

      if (!btDevice.gatt) {
        throw new Error("GATT server not available");
      }

      const server = await btDevice.gatt.connect();
      gattServer.current = server;

      // Get Heart Rate Service
      const heartRateService = await server.getPrimaryService(HEART_RATE_SERVICE);
      const heartRateChar = await heartRateService.getCharacteristic(HEART_RATE_MEASUREMENT);
      characteristicRef.current = heartRateChar;

      // Start notifications
      await heartRateChar.startNotifications();
      heartRateChar.addEventListener("characteristicvaluechanged", handleHeartRateNotification);

      // Try to get battery level
      let batteryLevel: number | undefined;
      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic(BATTERY_LEVEL);
        const batteryValue = await batteryChar.readValue();
        batteryLevel = batteryValue.getUint8(0);
      } catch {
        // Battery service not available
      }

      const updatedDevice = {
        ...device,
        type: device.type as "heart_rate" | "fitness_band" | "unknown",
        connected: true as const,
        batteryLevel,
      };

      bluetoothDeviceRef.current = updatedDevice;
      setState(prev => ({
        ...prev,
        isConnected: true,
        device: updatedDevice,
        error: null,
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect";
      setState(prev => ({ ...prev, error: errorMessage }));
      return false;
    }
  };

  const connect = useCallback(async (): Promise<boolean> => {
    if (!state.device) {
      await scanForDevices();
      return state.isConnected;
    }
    return connectToDevice(state.device);
  }, [state.device, state.isConnected, scanForDevices]);

  const disconnect = useCallback(() => {
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener(
        "characteristicvaluechanged",
        handleHeartRateNotification
      );
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    scanForDevices,
    connect,
    disconnect,
    onHeartRateChange,
  };
}
