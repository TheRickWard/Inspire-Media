// Sound-desk player screen. Music is kept on this device (IndexedDB) so the
// player works with no internet; the page itself is kept by sw.js.
import { formatTime, isAudioFile, latePosition, parseTrackName, readZip, sortImported } from "/player/core.mjs";

const $ = (id) => document.getElementById(id);
const audio = $("audio");

// ---------- Saved music (IndexedDB) ----------
const DB_NAME = "inspire-sound-desk";
let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("tracks", { keyPath: "id" });
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function tx(stores, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    const result = fn(t);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("Saving was cancelled."));
  });
}
const reqValue = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function loadSaved() {
  const d = await db();
  const t = d.transaction(["tracks", "meta"], "readonly");
  const [tracks, name] = await Promise.all([
    reqValue(t.objectStore("tracks").getAll()),
    reqValue(t.objectStore("meta").get("listName")),
  ]);
  return { tracks: tracks.sort((a, b) => a.pos - b.pos), name: name ?? "" };
}
// Save positions (and flags) of every track, without rewriting the music.
async function savePositions() {
  await tx(["tracks"], "readwrite", (t) => {
    const store = t.objectStore("tracks");
    tracks.forEach((tr, i) => {
      tr.pos = i;
      store.put(tr);
    });
  });
}

// ---------- State ----------
let tracks = []; // { id, pos, fileName, order, item, performer, blob, late, played }
let listName = "";
let current = null; // id of the loaded track (playing or paused), from the list or the USB panel
let usbFiles = []; // music chosen in the USB / folder panel: played from there, never saved to the list
let usbFolder = "";
let lastFinished = null; // id of the song played most recently
let confirmClear = false;
let confirmRemove = null;
let audioCtx = null;
let gain = null;
let wakeLock = null;

// The next song not yet played, after the one playing (or the one played last).
function nextTrack() {
  const from = tracks.findIndex((t) => t.id === (current ?? lastFinished)) + 1;
  return tracks.slice(from).find((t) => !t.played && t.id !== current) ?? tracks.find((t) => !t.played && t.id !== current) ?? null;
}
const describe = (t) => [t.item ? `Item ${t.item}` : "", t.performer, t.detail ?? ""].filter(Boolean).join(" – ");

function notice(text, kind = "") {
  const n = $("notice");
  n.hidden = !text;
  n.textContent = text ?? "";
  n.className = `notice ${kind}`;
  n.setAttribute("role", kind === "error" ? "alert" : "status");
}

// ---------- Screen ----------
function render() {
  const loaded = current ? findTrack(current) : null;
  const locked = !!loaded; // a song is playing or paused: no other song can start
  const playing = locked && !audio.paused;
  const next = nextTrack();

  $("listName").textContent = tracks.length
    ? `${listName || "Music"} · ${tracks.length} ${tracks.length === 1 ? "song" : "songs"} · ${tracks.filter((t) => t.played).length} played`
    : "No music loaded";
  $("empty").hidden = tracks.length > 0;
  $("lateBtn").disabled = tracks.length === 0;
  $("clearBtn").disabled = tracks.length === 0 || locked;
  $("clearBtn").textContent = confirmClear ? `Yes, remove all ${tracks.length}` : "Clear list";
  $("clearBtn").className = confirmClear ? "btn btn-danger" : "btn btn-quiet";

  // The big controls are for the list; a USB song has its own small player in the left panel.
  const fromList = locked && !loaded.usb;
  const now = document.querySelector(".now");
  now.className = `now ${fromList ? (playing ? "playing" : "paused") : ""}`;
  $("nowLabel").textContent = fromList ? (playing ? "Now playing" : "Paused") : locked ? "USB / folder song loaded" : "Ready";
  $("nowTitle").textContent = fromList ? describe(loaded) : locked ? "Use the small player in the USB / folder panel" : tracks.length ? "Choose a song to play" : "Load music to begin";
  $("pauseBtn").disabled = !fromList;
  $("pauseBtn").textContent = fromList && !playing ? "Resume" : "Pause";
  $("stopBtn").disabled = !fromList;
  $("restartBtn").disabled = !fromList;
  const usbNow = locked && loaded.usb;
  $("usbNow").hidden = !usbNow;
  $("usbNow").className = `usb-now ${playing ? "playing" : "paused"}`;
  $("usbNowLabel").textContent = playing ? "Now playing" : "Paused";
  $("usbNowTitle").textContent = usbNow ? loaded.fileName.replace(/\.[a-z0-9]+$/i, "") : "";
  $("usbPause").textContent = playing ? "Pause" : "Resume";
  $("nextTitle").textContent = next ? describe(next) : tracks.length ? "End of the list" : "–";
  $("playNextBtn").disabled = locked || !next;

  renderUsb(locked, playing);

  const list = $("list");
  list.replaceChildren(
    ...tracks.map((t, i) => {
      const li = document.createElement("li");
      li.className = `row${t.id === current ? " current" : ""}${!locked && next && t.id === next.id ? " next" : ""}${t.played ? " played" : ""}`;
      const playBtn = button(t.id === current ? (playing ? "On air" : "Paused") : "Play", "play", () => play(t.id));
      playBtn.disabled = locked;
      playBtn.setAttribute("aria-label", `Play ${describe(t)}`);
      const item = document.createElement("span");
      item.className = "item";
      item.textContent = t.item ?? (t.order != null ? String(t.order) : "–");
      const who = document.createElement("span");
      who.className = "who";
      const strong = document.createElement("strong");
      strong.textContent = t.performer;
      if (t.late) strong.append(tag("Late", "tag-late"));
      if (t.played) strong.append(tag("Played", "tag-played"));
      const small = document.createElement("small");
      small.textContent = t.detail || t.fileName;
      small.title = t.fileName;
      who.append(strong, small);
      const tools = document.createElement("span");
      tools.className = "tools";
      const up = button("▲", "tool", () => move(i, -1));
      up.disabled = i === 0;
      up.setAttribute("aria-label", `Move ${describe(t)} up`);
      const down = button("▼", "tool", () => move(i, 1));
      down.disabled = i === tracks.length - 1;
      down.setAttribute("aria-label", `Move ${describe(t)} down`);
      const mark = button(t.played ? "Unplay" : "✓", "tool", () => togglePlayed(t.id));
      mark.setAttribute("aria-label", t.played ? `Mark ${describe(t)} not played` : `Mark ${describe(t)} played`);
      const remove = button(confirmRemove === t.id ? "Remove?" : "✕", `tool${confirmRemove === t.id ? " confirm" : ""}`, () => removeTrack(t.id));
      remove.disabled = t.id === current;
      remove.setAttribute("aria-label", `Remove ${describe(t)}`);
      tools.append(up, down, mark, remove);
      li.append(playBtn, item, who, tools);
      return li;
    }),
  );
  updateTime();
}
function button(text, className, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}
function tag(text, cls) {
  const s = document.createElement("span");
  s.className = `tag ${cls}`;
  s.textContent = text;
  return s;
}
function updateTime() {
  const d = audio.duration;
  const loaded = current ? findTrack(current) : null;
  const show = (on, el, rem, bar) => {
    const c = on ? audio.currentTime : 0;
    $(el).textContent = formatTime(c);
    $(rem).textContent = on && Number.isFinite(d) ? `−${formatTime(d - c)}` : "";
    $(bar).style.width = on && d > 0 ? `${Math.min(100, (c / d) * 100)}%` : "0";
  };
  show(!!loaded && !loaded.usb, "elapsed", "remaining", "progressBar");
  show(!!loaded?.usb, "usbElapsed", "usbRemaining", "usbProgressBar");
}

// ---------- USB / folder panel ----------
// Plays music straight from a USB stick or folder. Nothing is copied to the
// device or added to the list; the files are only remembered until the page closes.
function findTrack(id) {
  return tracks.find((t) => t.id === id) ?? usbFiles.find((t) => t.id === id) ?? null;
}
function renderUsb(locked, playing) {
  $("usbFolder").textContent = usbFiles.length
    ? `${usbFolder ? `${usbFolder} · ` : ""}${usbFiles.length} ${usbFiles.length === 1 ? "song" : "songs"}`
    : "Nothing chosen yet";
  $("usbClear").hidden = usbFiles.length === 0;
  $("usbClear").disabled = usbFiles.some((t) => t.id === current);
  $("usbList").replaceChildren(
    ...usbFiles.map((t) => {
      const li = document.createElement("li");
      li.className = `usb-row${t.id === current ? " current" : ""}`;
      const playBtn = button(t.id === current ? (playing ? "On air" : "Paused") : "Play", "play play-small", () => play(t.id));
      playBtn.disabled = locked;
      playBtn.setAttribute("aria-label", `Play ${t.fileName}`);
      const name = document.createElement("span");
      name.className = "usb-name";
      name.textContent = t.fileName.replace(/\.[a-z0-9]+$/i, "");
      name.title = t.path || t.fileName;
      li.append(playBtn, name);
      return li;
    }),
  );
}
function chooseUsb(files) {
  const music = files.filter((f) => isAudioFile(f.webkitRelativePath || f.name));
  if (!music.length) {
    notice("No music files (MP3, M4A, WAV or AAC) were found in what you chose.", "error");
    return;
  }
  const stamp = Date.now().toString(36);
  usbFolder = (music[0].webkitRelativePath || "").split("/")[0];
  usbFiles = music
    .map((f, i) => ({ id: `usb-${stamp}-${i}`, fileName: f.name, path: f.webkitRelativePath || f.name, blob: f, ...parseTrackName(f.name), usb: true }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  notice(`${usbFiles.length} ${usbFiles.length === 1 ? "song" : "songs"} ready in the USB / folder panel. They play straight from there and aren't added to the list.`, "ok");
  render();
}
for (const id of ["usbFolderInput", "usbFilesInput"]) {
  $(id).addEventListener("change", (ev) => {
    const files = [...ev.target.files];
    ev.target.value = "";
    if (files.length) chooseUsb(files);
  });
}
$("usbFolderBtn").addEventListener("click", () => $("usbFolderInput").click());
$("usbFilesBtn").addEventListener("click", () => $("usbFilesInput").click());
$("usbClear").addEventListener("click", () => {
  if (usbFiles.some((t) => t.id === current)) return;
  usbFiles = [];
  usbFolder = "";
  render();
});
// Folder choosing isn't available on every device (e.g. some iPads): offer files only there.
if (!("webkitdirectory" in document.createElement("input"))) $("usbFolderBtn").hidden = true;

// ---------- Playing ----------
function setupAudio() {
  // Volume goes through Web Audio, because iPads ignore a player's own volume setting.
  if (audioCtx || !window.AudioContext) return;
  try {
    audioCtx = new AudioContext();
    gain = audioCtx.createGain();
    audioCtx.createMediaElementSource(audio).connect(gain).connect(audioCtx.destination);
  } catch {
    audioCtx = null;
    gain = null;
  }
  applyVolume();
}
function applyVolume() {
  const v = Number($("volume").value);
  $("volumeValue").textContent = `${v}%`;
  const level = (v / 100) ** 2; // feels even across the slider
  if (gain) gain.gain.value = level;
  else audio.volume = level;
}

async function play(id) {
  if (current) return; // locked while a song is loaded
  const t = findTrack(id);
  if (!t) return;
  setupAudio();
  if (audioCtx?.state === "suspended") await audioCtx.resume().catch(() => {});
  confirmClear = false;
  confirmRemove = null;
  current = id;
  if (audio.src) URL.revokeObjectURL(audio.src);
  audio.src = URL.createObjectURL(t.blob);
  try {
    await audio.play();
    notice("");
    keepAwake(true);
  } catch {
    current = null;
    audio.removeAttribute("src");
    notice(`Couldn't play "${t.fileName}". The file may be damaged or in a format this device can't play.`, "error");
  }
  render();
}
function stop() {
  if (!current) return;
  audio.pause();
  audio.currentTime = 0;
  finish(true);
}
function finish(markPlayed) {
  const t = tracks.find((x) => x.id === current);
  if (t && markPlayed && !t.played) {
    t.played = true;
    tx(["tracks"], "readwrite", (x) => x.objectStore("tracks").put(t)).catch(() => {});
  }
  if (t) lastFinished = current; // a USB song doesn't move "Up next"
  current = null;
  if (audio.src) URL.revokeObjectURL(audio.src);
  audio.removeAttribute("src");
  audio.load();
  keepAwake(false);
  render();
}
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported: fine */ }
}

async function togglePause() {
  if (!current) return;
  if (audio.paused) {
    if (audioCtx?.state === "suspended") await audioCtx.resume().catch(() => {});
    await audio.play().catch(() => {});
  } else audio.pause();
  render();
}
function restart() {
  if (current) { audio.currentTime = 0; updateTime(); }
}
for (const [id, fn] of [["pauseBtn", togglePause], ["usbPause", togglePause], ["stopBtn", stop], ["usbStop", stop], ["restartBtn", restart], ["usbRestart", restart]]) {
  $(id).addEventListener("click", fn);
}
$("playNextBtn").addEventListener("click", () => { const n = nextTrack(); if (n) play(n.id); });
$("volume").addEventListener("input", () => {
  applyVolume();
  try { localStorage.setItem("soundDeskVolume", $("volume").value); } catch { /* ignore */ }
});
audio.addEventListener("timeupdate", updateTime);
audio.addEventListener("loadedmetadata", updateTime);
audio.addEventListener("ended", () => finish(true));
audio.addEventListener("pause", render);
audio.addEventListener("play", render);
document.addEventListener("visibilitychange", () => { if (!document.hidden && current && !audio.paused) keepAwake(true); });

// ---------- Changing the list ----------
async function move(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= tracks.length) return;
  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  render();
  await savePositions().catch(() => notice("Couldn't save the new order on this device.", "error"));
}
async function togglePlayed(id) {
  const t = tracks.find((x) => x.id === id);
  if (!t) return;
  t.played = !t.played;
  render();
  await tx(["tracks"], "readwrite", (x) => x.objectStore("tracks").put(t)).catch(() => {});
}
async function removeTrack(id) {
  if (id === current) return;
  if (confirmRemove !== id) { confirmRemove = id; render(); return; }
  confirmRemove = null;
  tracks = tracks.filter((t) => t.id !== id);
  await tx(["tracks"], "readwrite", (x) => x.objectStore("tracks").delete(id)).catch(() => {});
  await savePositions().catch(() => {});
  render();
}
$("clearBtn").addEventListener("click", async () => {
  if (current) return;
  if (!confirmClear) { confirmClear = true; render(); return; }
  confirmClear = false;
  await tx(["tracks", "meta"], "readwrite", (t) => { t.objectStore("tracks").clear(); t.objectStore("meta").clear(); });
  tracks = [];
  listName = "";
  notice("The list is cleared and the music removed from this device.", "ok");
  render();
});

// Turn chosen files (zips and/or music files) into tracks.
async function filesToTracks(files) {
  const found = [];
  const skipped = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip") {
      notice(`Opening ${f.name}…`);
      for (const e of await readZip(f)) found.push({ fileName: e.name, blob: e.blob });
    } else if (isAudioFile(f.name)) {
      found.push({ fileName: f.name, blob: f });
    } else skipped.push(f.name);
  }
  const stamp = Date.now().toString(36);
  return {
    skipped,
    tracks: found.map((f, i) => ({ id: `${stamp}-${i}-${Math.random().toString(36).slice(2, 8)}`, ...f, ...parseTrackName(f.fileName), late: false, played: false })),
  };
}
async function saveTracks(newTracks) {
  // One at a time, so a big event doesn't need all the music in memory at once.
  for (const [i, t] of newTracks.entries()) {
    notice(`Saving ${i + 1} of ${newTracks.length} to this device…`);
    await tx(["tracks"], "readwrite", (x) => x.objectStore("tracks").put(t));
  }
}
function storageError(e) {
  return e?.name === "QuotaExceededError"
    ? "This device ran out of space for the music. Free up some space, or load one session at a time."
    : e instanceof Error ? e.message : "Something went wrong loading the music.";
}
function busy(on) {
  $("loadBtn").disabled = on;
  $("lateBtn").disabled = on || tracks.length === 0;
}

$("loadBtn").addEventListener("click", () => {
  if (current) { notice("Stop the song that's playing before loading new music.", "error"); return; }
  if (tracks.length && !confirm(`Replace the ${tracks.length} songs in the list with new music?`)) return;
  $("loadInput").click();
});
$("loadInput").addEventListener("change", async (ev) => {
  const files = [...ev.target.files];
  ev.target.value = "";
  if (!files.length) return;
  busy(true);
  try {
    const { tracks: found, skipped } = await filesToTracks(files);
    if (!found.length) throw new Error("No music files (MP3, M4A, WAV or AAC) were found in what you chose.");
    const sorted = sortImported(found).map((t, i) => ({ ...t, pos: i }));
    await tx(["tracks", "meta"], "readwrite", (t) => { t.objectStore("tracks").clear(); t.objectStore("meta").clear(); });
    tracks = [];
    await saveTracks(sorted);
    tracks = sorted;
    listName = files.length === 1 ? files[0].name.replace(/\.zip$/i, "") : "Music";
    await tx(["meta"], "readwrite", (t) => t.objectStore("meta").put(listName, "listName"));
    navigator.storage?.persist?.().then(showStorage).catch(() => {});
    notice(`Loaded ${sorted.length} ${sorted.length === 1 ? "song" : "songs"} in running order.${skipped.length ? ` Skipped ${skipped.length} file(s) that aren't music.` : ""}`, "ok");
  } catch (e) {
    notice(storageError(e), "error");
    const saved = await loadSaved().catch(() => ({ tracks: [], name: "" }));
    tracks = saved.tracks;
    listName = saved.name;
  }
  busy(false);
  render();
  showStorage();
});

$("lateBtn").addEventListener("click", () => $("lateInput").click());
$("lateInput").addEventListener("change", async (ev) => {
  const files = [...ev.target.files];
  ev.target.value = "";
  if (!files.length) return;
  busy(true);
  try {
    const { tracks: found } = await filesToTracks(files);
    if (!found.length) throw new Error("No music files (MP3, M4A, WAV or AAC) were found in what you chose.");
    const placed = [];
    let atEnd = false;
    for (const t of sortImported(found)) {
      t.late = true;
      const at = latePosition(tracks, t);
      if (at === tracks.length) atEnd = true;
      tracks.splice(at, 0, t);
      placed.push(t.item ? `Item ${t.item}` : t.performer);
    }
    tracks.forEach((t, i) => { t.pos = i; });
    await saveTracks(found);
    await savePositions();
    notice(`Added ${placed.join(", ")}.${atEnd ? " Late music went to the end of the list: use ▲ ▼ to move it into place." : " Each was placed by its item number; use ▲ ▼ to adjust."}`, "ok");
  } catch (e) {
    notice(storageError(e), "error");
    const saved = await loadSaved().catch(() => ({ tracks: [], name: "" }));
    tracks = saved.tracks;
  }
  busy(false);
  render();
  showStorage();
});

// ---------- Footer: storage and offline ----------
async function showStorage() {
  try {
    const persisted = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    const mb = (est?.usage ?? 0) / 1024 / 1024;
    const used = mb ? ` (${mb < 10 ? mb.toFixed(1) : mb.toFixed(0)} MB used)` : "";
    $("storage").textContent = tracks.length
      ? `Music saved on this device${used}${persisted ? ", protected from automatic clean-up" : ""}.`
      : "";
  } catch { $("storage").textContent = ""; }
}
function showOnline() {
  $("offline").textContent = navigator.onLine ? "Online" : "Offline: everything still works";
}
window.addEventListener("online", showOnline);
window.addEventListener("offline", showOnline);

// Warn before closing the page mid-song.
window.addEventListener("beforeunload", (e) => { if (current) e.preventDefault(); });

// ---------- Start ----------
(async () => {
  try {
    const v = localStorage.getItem("soundDeskVolume");
    if (v !== null) $("volume").value = v;
  } catch { /* ignore */ }
  applyVolume();
  showOnline();
  try {
    const saved = await loadSaved();
    tracks = saved.tracks;
    listName = saved.name;
  } catch {
    notice("This browser won't let the player save music (private browsing can do this). Open it in a normal window or as the installed app.", "error");
  }
  render();
  showStorage();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/player/sw.js", { scope: "/player/" }).catch(() => {});
  }
})();
