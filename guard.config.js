const API_URL = "https://script.google.com/macros/s/AKfycbyAmnKZikesQN8uHEKZQKUZ1nzjl1h0ZBHAy6eGKahqQK8dNNI4Pyopn73DAzDNU6g/exec";

const STORAGE = {
  SESSION: "guardtour.session",
  QUEUE: "guardtour.queue",
  SYNC_META: "guardtour.syncmeta"
};

const state = {
  guard: null,
  shifts: [],
  shiftProgressMap: {},
  shiftProgressMetaMap: {},
  activeShift: null,
  activePlan: [],
  currentRound: 1,
  selectedPlanKey: "",
  scannedQr: "",
  gps: null,
  checkinPassed: false,
  checkpointPhoto: "",
  incidentPhoto: "",
  incidentEvidenceItems: [],
  activeIncidentCaptureId: "",
  incidentMode: "NONE",
  checkpointQrMap: {},
  checkpointMetaMap: {},
  doneCheckpointCounter: {},
  scanner: null,
  queue: [],
  syncing: false,
  lastSync: "-",
  suppressLoading: false,
  summaryCacheDate: "",
  summaryCache: null
};

const el = {};
let loadingCount = 0;









