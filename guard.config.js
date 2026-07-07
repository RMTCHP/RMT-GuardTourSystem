const API_URL = "https://script.google.com/macros/s/AKfycby5hEIim-I0KCEsZsprWne8clnsBBOhyACbw6kzagoHfpEjecLlYjb240sYB2wUUTg/exec";

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









