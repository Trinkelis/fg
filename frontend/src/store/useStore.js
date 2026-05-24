import { create } from 'zustand';

const useStore = create((set, get) => ({
  media:       null,   // { file, name, type, localUrl, actualW, actualH }
  mediaType:   null,   // 'video' | 'audio' | 'image'
  operations:  {},     // { [id]: { enabled: bool, params: {} } }
  isProcessing:false,
  progress:    0,
  output:      null,   // { url, name, isBlob }
  currentTime: 0,
  duration:    0,
  activeCategory: 'video',
  activeOp:    null,

  loadMedia(file) {
    const prev = get().media;
    if (prev?.localUrl) URL.revokeObjectURL(prev.localUrl);
    const url  = URL.createObjectURL(file);
    const type = file.type.startsWith('video/') ? 'video'
               : file.type.startsWith('audio/') ? 'audio'
               : 'image';
    set({ media:{ file, name:file.name, type, localUrl:url, actualW:null, actualH:null },
          mediaType:type, operations:{}, output:null,
          currentTime:0, duration:0, activeOp:null });
  },

  setMediaDims(w, h) {
    set(s => ({ media: s.media ? { ...s.media, actualW:w, actualH:h } : null }));
  },

  setOperation(id, params) {
    set(s => ({
      operations: {
        ...s.operations,
        [id]: { enabled: s.operations[id]?.enabled ?? true,
                params: { ...(s.operations[id]?.params || {}), ...params } },
      },
    }));
  },

  enableOperation(id, defaultParams) {
    set(s => ({
      operations: {
        ...s.operations,
        [id]: { enabled:true, params: s.operations[id]?.params || { ...defaultParams } },
      },
    }));
  },

  toggleOperation(id) {
    set(s => ({
      operations: {
        ...s.operations,
        [id]: { ...s.operations[id], enabled: !s.operations[id]?.enabled },
      },
    }));
  },

  resetOperation(id) {
    set(s => { const o = { ...s.operations }; delete o[id]; return { operations:o }; });
  },

  setIsProcessing: v => set({ isProcessing:v }),
  setProgress:     v => set({ progress:v }),
  setOutput:       o => set({ output:o }),
  setCurrentTime:  t => set({ currentTime:t }),
  setDuration:     d => set({ duration:d }),
  setActiveCategory: c => set({ activeCategory:c }),
  setActiveOp: id => set(s => ({ activeOp: s.activeOp === id ? null : id })),
}));

export default useStore;
