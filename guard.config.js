const API_URL = "https://script.google.com/macros/s/AKfycbz4pyRObSzSc-wwc1TONzRFAbfsbM2l3c9xSDQ4KSn0esapVLGfIe-qVO-VbuIm0_w/exec";

const STORAGE = {
  SESSION: "guardtour.session",
  QUEUE: "guardtour.queue",
  SYNC_META: "guardtour.syncmeta"
};

const state = {
  guard: null,
  shifts: [],
  shiftProgressMap: {},
  activeShift: null,
  activePlan: [],
  currentRound: 1,
  selectedPlanKey: "",
  scannedQr: "",
  gps: null,
  checkinPassed: false,
  checkpointPhoto: "",
  incidentPhoto: "",
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





