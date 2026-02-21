import { create } from 'zustand';
import type { ConnectionStatus, Sentence, TranslatorStore } from '../types';

const initialState: {
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  showTranscription: boolean;
  sentences: Sentence[];
  currentInterimSource: string;
  currentInterimTranslation: string;
  lastError: string | null;
} = {
  isRecording: false,
  connectionStatus: 'disconnected',
  showTranscription: true,
  sentences: [],
  currentInterimSource: '',
  currentInterimTranslation: '',
  lastError: null,
};

export const useTranslatorStore = create<TranslatorStore>((set) => ({
  ...initialState,

  setRecording: (isRecording) => set({ isRecording }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  setShowTranscription: (showTranscription) => set({ showTranscription }),

  addSentence: (text, timestamp) =>
    set((state) => ({
      sentences: [
        ...state.sentences,
        { sourceText: text, translation: null, timestamp },
      ],
      currentInterimSource: '',
      currentInterimTranslation: '',
    })),

  setTranslation: (index, translation) =>
    set((state) => {
      const newSentences = [...state.sentences];
      const sentence = newSentences[index];
      if (!sentence) return state;
      newSentences[index] = { ...sentence, translation };
      return { sentences: newSentences };
    }),

  setInterimSource: (text) => set({ currentInterimSource: text }),

  setInterimTranslation: (text) => set({ currentInterimTranslation: text }),

  setError: (lastError) => set({ lastError }),

  reset: () => set(initialState),
}));
