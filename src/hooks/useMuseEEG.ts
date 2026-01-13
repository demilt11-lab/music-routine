/// <reference path="../types/web-bluetooth.d.ts" />
import { useState, useCallback, useRef, useEffect } from "react";

export interface EEGReading {
  alpha: number;    // 8-12 Hz - relaxation, calm focus
  beta: number;     // 12-30 Hz - active thinking, concentration
  theta: number;    // 4-8 Hz - drowsiness, meditation
  gamma: number;    // 30-100 Hz - higher cognitive functions
  delta: number;    // 0.5-4 Hz - deep sleep
  timestamp: Date;
}

export interface MuseDevice {
  id: string;
  name: string;
  connected: boolean;
  batteryLevel?: number;
  signalQuality: "good" | "medium" | "poor" | "unknown";
}

export interface MuseEEGState {
  isSupported: boolean;
  isScanning: boolean;
  isConnected: boolean;
  device: MuseDevice | null;
  error: string | null;
  currentReading: EEGReading | null;
  focusScore: number;
  relaxationScore: number;
  meditationScore: number;
}

interface UseMuseEEGReturn {
  state: MuseEEGState;
  scanForMuse: () => Promise<void>;
  disconnect: () => void;
  onEEGUpdate: (callback: (reading: EEGReading) => void) => void;
}

// Muse headband Bluetooth UUIDs
const MUSE_SERVICE_UUID = "0000fe8d-0000-1000-8000-00805f9b34fb";
const MUSE_CONTROL_UUID = "273e0001-4c4d-454d-96be-f03bac821358";
const MUSE_EEG_TP9_UUID = "273e0003-4c4d-454d-96be-f03bac821358";  // Left ear
const MUSE_EEG_AF7_UUID = "273e0004-4c4d-454d-96be-f03bac821358";  // Left forehead
const MUSE_EEG_AF8_UUID = "273e0005-4c4d-454d-96be-f03bac821358";  // Right forehead
const MUSE_EEG_TP10_UUID = "273e0006-4c4d-454d-96be-f03bac821358"; // Right ear
const MUSE_PPG_UUID = "273e000b-4c4d-454d-96be-f03bac821358";      // Heart rate (PPG)
const MUSE_BATTERY_UUID = "273e000c-4c4d-454d-96be-f03bac821358";

// Band power indices
const DELTA_BAND = { min: 1, max: 4 };
const THETA_BAND = { min: 4, max: 8 };
const ALPHA_BAND = { min: 8, max: 12 };
const BETA_BAND = { min: 12, max: 30 };
const GAMMA_BAND = { min: 30, max: 50 };

export function useMuseEEG(): UseMuseEEGReturn {
  const [state, setState] = useState<MuseEEGState>({
    isSupported: typeof navigator !== "undefined" && "bluetooth" in navigator,
    isScanning: false,
    isConnected: false,
    device: null,
    error: null,
    currentReading: null,
    focusScore: 0,
    relaxationScore: 0,
    meditationScore: 0,
  });

  const bluetoothDeviceRef = useRef<any>(null);
  const gattServerRef = useRef<any>(null);
  const eegCallbackRef = useRef<((reading: EEGReading) => void) | null>(null);
  const characteristicsRef = useRef<any[]>([]);
  const eegBufferRef = useRef<number[][]>([[], [], [], []]);
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onEEGUpdate = useCallback((callback: (reading: EEGReading) => void) => {
    eegCallbackRef.current = callback;
  }, []);

  // Calculate band power from raw EEG samples using simple moving average
  const calculateBandPower = useCallback((samples: number[], sampleRate: number = 256): Record<string, number> => {
    if (samples.length < 256) {
      return { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 };
    }

    // Simple power calculation using variance in frequency bands
    // In a real implementation, this would use FFT
    const recent = samples.slice(-256);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
    
    // Simulate band powers based on signal characteristics
    // Higher variance typically indicates more beta/gamma activity
    const totalPower = Math.sqrt(variance);
    
    return {
      delta: Math.max(0, 1 - totalPower / 100) * 4,
      theta: Math.max(0, (50 - Math.abs(totalPower - 50)) / 50) * 8,
      alpha: Math.max(0, (30 - Math.abs(totalPower - 30)) / 30) * 12,
      beta: Math.min(totalPower / 20, 30),
      gamma: Math.min(totalPower / 10, 50),
    };
  }, []);

  // Calculate cognitive metrics from EEG bands
  const calculateMetrics = useCallback((reading: EEGReading): { focus: number; relaxation: number; meditation: number } => {
    const total = reading.alpha + reading.beta + reading.theta + reading.gamma + reading.delta + 0.001;
    
    // Focus = beta / (theta + alpha) ratio - higher beta relative to slower waves indicates focus
    const focusRatio = reading.beta / (reading.theta + reading.alpha + 0.001);
    const focus = Math.min(100, Math.max(0, focusRatio * 30));
    
    // Relaxation = alpha / beta ratio - higher alpha relative to beta indicates relaxation
    const relaxationRatio = reading.alpha / (reading.beta + 0.001);
    const relaxation = Math.min(100, Math.max(0, relaxationRatio * 25));
    
    // Meditation = (alpha + theta) / (beta + gamma) - slow waves dominating indicates meditation
    const meditationRatio = (reading.alpha + reading.theta) / (reading.beta + reading.gamma + 0.001);
    const meditation = Math.min(100, Math.max(0, meditationRatio * 20));
    
    return { focus, relaxation, meditation };
  }, []);

  // Process EEG data from raw samples
  const processEEGData = useCallback(() => {
    const buffers = eegBufferRef.current;
    if (buffers.every(b => b.length < 128)) return;

    // Average power across all channels
    const channelPowers = buffers.map(samples => calculateBandPower(samples));
    
    const avgPower = {
      delta: channelPowers.reduce((a, c) => a + c.delta, 0) / 4,
      theta: channelPowers.reduce((a, c) => a + c.theta, 0) / 4,
      alpha: channelPowers.reduce((a, c) => a + c.alpha, 0) / 4,
      beta: channelPowers.reduce((a, c) => a + c.beta, 0) / 4,
      gamma: channelPowers.reduce((a, c) => a + c.gamma, 0) / 4,
    };

    const reading: EEGReading = {
      alpha: avgPower.alpha,
      beta: avgPower.beta,
      theta: avgPower.theta,
      gamma: avgPower.gamma,
      delta: avgPower.delta,
      timestamp: new Date(),
    };

    const metrics = calculateMetrics(reading);

    setState(prev => ({
      ...prev,
      currentReading: reading,
      focusScore: Math.round(metrics.focus),
      relaxationScore: Math.round(metrics.relaxation),
      meditationScore: Math.round(metrics.meditation),
    }));

    if (eegCallbackRef.current) {
      eegCallbackRef.current(reading);
    }

    // Keep buffer size manageable
    buffers.forEach(b => {
      if (b.length > 512) b.splice(0, 256);
    });
  }, [calculateBandPower, calculateMetrics]);

  // Parse Muse EEG packet
  const parseEEGPacket = (dataView: DataView, channelIndex: number) => {
    // Muse sends 12 samples per packet, each as 12-bit values
    const samples: number[] = [];
    
    for (let i = 0; i < dataView.byteLength - 1; i += 2) {
      if (i + 1 < dataView.byteLength) {
        const value = dataView.getUint16(i, false);
        // Convert to microvolts (approximate)
        const microvolts = (value - 2048) * 0.48828125;
        samples.push(microvolts);
      }
    }
    
    eegBufferRef.current[channelIndex].push(...samples);
  };

  const handleEEGNotification = useCallback((channelIndex: number) => (event: Event) => {
    const target = event.target as any;
    const value = target?.value;
    
    if (value) {
      parseEEGPacket(value, channelIndex);
    }
  }, []);

  const scanForMuse = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: "Web Bluetooth is not supported in this browser" }));
      return;
    }

    setState(prev => ({ ...prev, isScanning: true, error: null }));

    try {
      const nav = navigator as any;
      
      // Request Muse device
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { namePrefix: "Muse" },
          { services: [MUSE_SERVICE_UUID] },
        ],
        optionalServices: [
          MUSE_SERVICE_UUID,
          MUSE_CONTROL_UUID,
          MUSE_EEG_TP9_UUID,
          MUSE_EEG_AF7_UUID,
          MUSE_EEG_AF8_UUID,
          MUSE_EEG_TP10_UUID,
          MUSE_BATTERY_UUID,
        ],
      });

      if (!device) {
        setState(prev => ({ ...prev, isScanning: false }));
        return;
      }

      bluetoothDeviceRef.current = device;

      // Listen for disconnection
      device.addEventListener("gattserverdisconnected", () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          device: prev.device ? { ...prev.device, connected: false } : null,
          currentReading: null,
          focusScore: 0,
          relaxationScore: 0,
          meditationScore: 0,
        }));
        
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current);
        }
      });

      // Connect to GATT server
      const server = await device.gatt.connect();
      gattServerRef.current = server;

      // Get Muse service
      const service = await server.getPrimaryService(MUSE_SERVICE_UUID);

      // Get control characteristic and start streaming
      try {
        const controlChar = await service.getCharacteristic(MUSE_CONTROL_UUID);
        
        // Send start command to Muse (version 2 protocol)
        const startCmd = new TextEncoder().encode("p50\n");
        await controlChar.writeValue(startCmd);
        
        // Send preset command
        const presetCmd = new TextEncoder().encode("p21\n");
        await controlChar.writeValue(presetCmd);
      } catch (e) {
        console.log("Control characteristic not available, continuing...");
      }

      // Subscribe to EEG channels
      const eegUUIDs = [MUSE_EEG_TP9_UUID, MUSE_EEG_AF7_UUID, MUSE_EEG_AF8_UUID, MUSE_EEG_TP10_UUID];
      
      for (let i = 0; i < eegUUIDs.length; i++) {
        try {
          const char = await service.getCharacteristic(eegUUIDs[i]);
          await char.startNotifications();
          char.addEventListener("characteristicvaluechanged", handleEEGNotification(i));
          characteristicsRef.current.push(char);
        } catch (e) {
          console.log(`EEG channel ${i} not available`);
        }
      }

      // Start processing interval
      processingIntervalRef.current = setInterval(processEEGData, 250);

      const museDevice: MuseDevice = {
        id: device.id,
        name: device.name || "Muse Headband",
        connected: true,
        signalQuality: "unknown",
      };

      setState(prev => ({
        ...prev,
        isScanning: false,
        isConnected: true,
        device: museDevice,
        error: null,
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect to Muse";
      setState(prev => ({
        ...prev,
        isScanning: false,
        error: errorMessage.includes("cancelled") ? null : errorMessage,
      }));
    }
  }, [state.isSupported, handleEEGNotification, processEEGData]);

  const disconnect = useCallback(() => {
    // Stop processing
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }

    // Stop notifications
    characteristicsRef.current.forEach(char => {
      try {
        char.stopNotifications();
      } catch (e) {}
    });
    characteristicsRef.current = [];

    // Disconnect GATT
    if (gattServerRef.current?.connected) {
      gattServerRef.current.disconnect();
    }

    // Clear buffers
    eegBufferRef.current = [[], [], [], []];

    setState(prev => ({
      ...prev,
      isConnected: false,
      device: prev.device ? { ...prev.device, connected: false } : null,
      currentReading: null,
      focusScore: 0,
      relaxationScore: 0,
      meditationScore: 0,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    scanForMuse,
    disconnect,
    onEEGUpdate,
  };
}
