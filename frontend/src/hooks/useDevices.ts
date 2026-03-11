import { useCallback, useEffect, useState } from 'react';

export interface UseDevicesHook {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | undefined;
  setSelectedDeviceId: (id: string | undefined) => void;
  refreshDevices: () => Promise<void>;
}

export function useDevices(): UseDevicesHook {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | undefined>(
    () => localStorage.getItem('selectedMicDeviceId') ?? undefined
  );

  const refreshDevices = useCallback(async (): Promise<void> => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter((d) => d.kind === 'audioinput'));
  }, []);

  const setSelectedDeviceId = useCallback((id: string | undefined): void => {
    setSelectedDeviceIdState(id);
    if (id === undefined) {
      localStorage.removeItem('selectedMicDeviceId');
    } else {
      localStorage.setItem('selectedMicDeviceId', id);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  return { devices, selectedDeviceId, setSelectedDeviceId, refreshDevices };
}
