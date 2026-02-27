import { useState, useCallback, useEffect } from "react";

type PermissionState = "granted" | "denied" | "prompt" | "unavailable";

interface UseBluetoothPermissionReturn {
  permissionState: PermissionState;
  requestPermission: () => Promise<void>;
}

export function useBluetoothPermission(): UseBluetoothPermissionReturn {
  const [permissionState, setPermissionState] = useState<PermissionState>("unavailable");

  useEffect(() => {
    (async () => {
      try {
        if (!navigator.permissions) {
          setPermissionState("unavailable");
          return;
        }
        const status = await navigator.permissions.query({ name: "bluetooth" as PermissionName });
        setPermissionState(status.state as PermissionState);
        status.onchange = () => setPermissionState(status.state as PermissionState);
      } catch {
        setPermissionState("unavailable");
      }
    })();
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      // Triggering requestDevice prompts the permission dialog
      const nav = navigator as any;
      if (nav.bluetooth) {
        await nav.bluetooth.requestDevice({ acceptAllDevices: true });
      }
    } catch {
      // User cancelled or not supported — re-check
      try {
        const status = await navigator.permissions.query({ name: "bluetooth" as PermissionName });
        setPermissionState(status.state as PermissionState);
      } catch {
        // leave as-is
      }
    }
  }, []);

  return { permissionState, requestPermission };
}
