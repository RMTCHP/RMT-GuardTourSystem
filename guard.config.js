const API_URL = "https://script.google.com/macros/s/AKfycbwlpmO-jSlrpN_m2OaKLQ1sUy0Ka0HvneRjGrD-DNFwYn_ZY2KHDw6zPj978WsovDQ/exec";

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


