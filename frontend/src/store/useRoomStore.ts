import { create } from 'zustand';

interface RoomStore {
  roomId: string | null;
  viewerCount: number;
  isPresenter: boolean;
  isViewer: boolean;
  setRoom: (roomId: string, role: 'presenter' | 'viewer') => void;
  setViewerCount: (count: number) => void;
  resetRoom: () => void;
}

const initialState: {
  roomId: string | null;
  viewerCount: number;
  isPresenter: boolean;
  isViewer: boolean;
} = {
  roomId: null,
  viewerCount: 0,
  isPresenter: false,
  isViewer: false,
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,

  setRoom: (roomId, role) =>
    set({
      roomId,
      isPresenter: role === 'presenter',
      isViewer: role === 'viewer',
    }),

  setViewerCount: (viewerCount) => set({ viewerCount }),

  resetRoom: () => set(initialState),
}));
