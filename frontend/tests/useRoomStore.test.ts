import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../src/store/useRoomStore';

describe('useRoomStore', () => {
  beforeEach(() => {
    useRoomStore.getState().resetRoom();
  });

  it('starts with default state', () => {
    const state = useRoomStore.getState();
    expect(state.roomId).toBeNull();
    expect(state.viewerCount).toBe(0);
    expect(state.isPresenter).toBe(false);
    expect(state.isViewer).toBe(false);
  });

  it('setRoom with presenter role', () => {
    useRoomStore.getState().setRoom('ABC123', 'presenter');
    const state = useRoomStore.getState();
    expect(state.roomId).toBe('ABC123');
    expect(state.isPresenter).toBe(true);
    expect(state.isViewer).toBe(false);
  });

  it('setRoom with viewer role', () => {
    useRoomStore.getState().setRoom('ABC123', 'viewer');
    const state = useRoomStore.getState();
    expect(state.roomId).toBe('ABC123');
    expect(state.isPresenter).toBe(false);
    expect(state.isViewer).toBe(true);
  });

  it('setViewerCount updates viewer count', () => {
    useRoomStore.getState().setViewerCount(42);
    expect(useRoomStore.getState().viewerCount).toBe(42);
  });

  it('resetRoom restores initial state', () => {
    const store = useRoomStore.getState();
    store.setRoom('ABC123', 'presenter');
    store.setViewerCount(42);

    store.resetRoom();

    const state = useRoomStore.getState();
    expect(state.roomId).toBeNull();
    expect(state.viewerCount).toBe(0);
    expect(state.isPresenter).toBe(false);
    expect(state.isViewer).toBe(false);
  });
});
