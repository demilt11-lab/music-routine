// Web Bluetooth API Type Definitions

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  addEventListener(type: 'advertisementreceived', listener: (event: BluetoothAdvertisingEvent) => void): void;
  removeEventListener(type: 'gattserverdisconnected', listener: () => void): void;
  removeEventListener(type: 'advertisementreceived', listener: (event: BluetoothAdvertisingEvent) => void): void;
  watchAdvertisements(options?: WatchAdvertisementsOptions): Promise<void>;
  forget(): Promise<void>;
}

interface WatchAdvertisementsOptions {
  signal?: AbortSignal;
}

interface BluetoothAdvertisingEvent extends Event {
  device: BluetoothDevice;
  uuids: string[];
  name?: string;
  rssi?: number;
  txPower?: number;
  manufacturerData?: Map<number, DataView>;
  serviceData?: Map<string, DataView>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  device: BluetoothDevice;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  service: BluetoothRemoteGATTService;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
}

type BluetoothServiceUUID = string | number;
type BluetoothCharacteristicUUID = string | number;

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  exclusionFilters?: BluetoothRequestDeviceFilter[];
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
  name?: string;
  namePrefix?: string;
  manufacturerId?: number;
  serviceDataUUID?: BluetoothServiceUUID;
}

interface BluetoothAvailabilityChangedEvent extends Event {
  value: boolean;
}

interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  addEventListener(type: 'availabilitychanged', listener: (event: BluetoothAvailabilityChangedEvent) => void): void;
  removeEventListener(type: 'availabilitychanged', listener: (event: BluetoothAvailabilityChangedEvent) => void): void;
}

interface Navigator {
  bluetooth: Bluetooth;
}

export {};
