import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  Droplets,
  FlaskConical,
  LineChart as LineChartIcon,
  Trash2,
  Upload,
  Waves,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { createClient } from "@supabase/supabase-js";

type Aquarium = {
  id: string;
  name: string;
  liters: number;
};

type FertilizerLog = {
  id: string;
  aquariumId: string;
  date: string;
  fertilizer: string;
  amount: string;
};

type WaterLog = {
  id: string;
  aquariumId: string;
  date: string;
  no3: string;
  no2: string;
  ph: string;
  o2: string;
};

type WaterChangeLog = {
  id: string;
  aquariumId: string;
  date: string;
  amount: string;
};

type Logs = {
  fertilizer: FertilizerLog[];
  water: WaterLog[];
  waterChange: WaterChangeLog[];
};

type CloudState = {
  selectedAquarium: string;
  logs: Logs;
};

const AQUARIUMS: Aquarium[] = [
  { id: "aq200", name: "Aquarium 200 L", liters: 200 },
  { id: "aq126", name: "Aquarium 126 L", liters: 126 },
];

const FERTILIZER_PLAN: Record<number, string[]> = {
  0: ["Tagesdünger"],
  1: ["NPK", "Tagesdünger"],
  2: ["Ferropol", "Tagesdünger"],
  3: ["NPK", "Tagesdünger"],
  4: ["Ferropol", "Tagesdünger"],
  5: ["NPK", "Tagesdünger"],
  6: ["Tagesdünger"],
};

const WEEKDAYS = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const STORAGE_KEY = "aquarium-logbuch-v7";
const SUPABASE_URL = "https://sgaqakrwhtwjuyywkhor.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnYXFha3J3aHR3anV5eXdraG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODIwNDEsImV4cCI6MjA4OTI1ODA0MX0.bUd2adZkzKKYSvxAQqeqwQEnaY85PCXCgZ5bkdjO4sM";
const CLOUD_ROW_ID = "shared";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function emptyLogs(): Logs {
  return {
    fertilizer: [],
    water: [],
    waterChange: [],
  };
}

function toLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayISO(): string {
  return toLocalISO(new Date());
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const d = new Date(`${dateString}T00:00:00`);
  return d.toLocaleDateString("de-DE");
}

function toNumber(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const normalized = String(value).replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function App() {
  const [selectedAquarium, setSelectedAquarium] = useState<string>("aq200");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [logs, setLogs] = useState<Logs>(emptyLogs());
  const [cloudReady, setCloudReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>("Cloud wird verbunden …");
  const [hasLoadedCloud, setHasLoadedCloud] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fertilizerForm, setFertilizerForm] = useState({
    aquariumId: "aq200",
    date: todayISO(),
    fertilizer: "NPK",
    amount: "",
  });

  const [waterForm, setWaterForm] = useState({
    aquariumId: "aq200",
    date: todayISO(),
    no3: "",
    no2: "",
    ph: "",
    o2: "",
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setLogs(parsed.logs || emptyLogs());
      if (parsed.selectedAquarium) {
        setSelectedAquarium(parsed.selectedAquarium);
      }
      setSyncStatus("Lokale Daten geladen …");
    } catch (error) {
      console.error("Fehler beim Laden aus localStorage", error);
    }
  }, []);

  useEffect(() => {
    async function loadCloudState() {
      try {
        const { data, error } = await supabase
          .from("app_state")
          .select("id, data")
          .eq("id", CLOUD_ROW_ID)
          .maybeSingle();

        if (error) {
          console.error(error);
          setSyncStatus("Cloud-Fehler beim Laden");
          setCloudReady(true);
          setHasLoadedCloud(true);
          return;
        }

        if (data?.data) {
          const cloudData = data.data as CloudState;

          setLogs(cloudData.logs || emptyLogs());
          if (cloudData.selectedAquarium) {
            setSelectedAquarium(cloudData.selectedAquarium);
          }

          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              selectedAquarium: cloudData.selectedAquarium || "aq200",
              logs: cloudData.logs || emptyLogs(),
            })
          );

          setSyncStatus("Cloud-Daten geladen");
        } else {
          setSyncStatus("Noch keine Cloud-Daten – lokale Daten aktiv");
        }
      } catch (error) {
        console.error(error);
        setSyncStatus("Cloud nicht erreichbar");
      } finally {
        setCloudReady(true);
        setHasLoadedCloud(true);
      }
    }

    loadCloudState();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedAquarium, logs })
    );
  }, [selectedAquarium, logs]);

  useEffect(() => {
    if (!cloudReady || !hasLoadedCloud) return;

    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus("Synchronisiert …");

        const payload: CloudState = {
          selectedAquarium,
          logs,
        };

        const { error } = await supabase.from("app_state").upsert(
          {
            id: CLOUD_ROW_ID,
            data: payload,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error(error);
          setSyncStatus("Cloud-Fehler beim Speichern");
          return;
        }

        setSyncStatus("Cloud-Sync aktiv");
      } catch (error) {
        console.error(error);
        setSyncStatus("Cloud nicht erreichbar");
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [selectedAquarium, logs, cloudReady, hasLoadedCloud]);

  useEffect(() => {
    setFertilizerForm((prev) => ({ ...prev, aquariumId: selectedAquarium }));
    setWaterForm((prev) => ({ ...prev, aquariumId: selectedAquarium }));
  }, [selectedAquarium]);

  const today = new Date();
  const todayPlan = FERTILIZER_PLAN[today.getDay()] || [];

  const aquariumName =
    AQUARIUMS.find((a) => a.id === selectedAquarium)?.name || "Aquarium";

  const fertilizerLogs = useMemo(
    () =>
      logs.fertilizer
        .filter((x) => x.aquariumId === selectedAquarium)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [logs.fertilizer, selectedAquarium]
  );

  const waterLogs = useMemo(
    () =>
      logs.water
        .filter((x) => x.aquariumId === selectedAquarium)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [logs.water, selectedAquarium]
  );

  const waterChangeLogs = useMemo(
    () =>
      logs.waterChange
        .filter((x) => x.aquariumId === selectedAquarium)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [logs.waterChange, selectedAquarium]
  );

  const latestWater = waterLogs[0];
  const latestWaterChange = waterChangeLogs[0];

  const no3TrendText = useMemo(() => {
    if (waterLogs.length < 2)
      return "Noch nicht genug Messungen für einen Trend.";
    const sorted = [...waterLogs].sort((a, b) => a.date.localeCompare(b.date));
    const last = toNumber(sorted[sorted.length - 1]?.no3);
    const prev = toNumber(sorted[sorted.length - 2]?.no3);
    if (last == null || prev == null) return "Nitrat-Trend noch unklar.";
    const diff = last - prev;
    if (diff >= 10) return `NO3 deutlich gestiegen (+${diff}).`;
    if (diff >= 3) return `NO3 leicht gestiegen (+${diff}).`;
    if (diff <= -10) return `NO3 deutlich gefallen (${diff}).`;
    if (diff <= -3) return `NO3 leicht gefallen (${diff}).`;
    return "NO3 aktuell stabil.";
  }, [waterLogs]);

  const tasksToday = useMemo(() => {
    const tasks = [...todayPlan];
    if (today.getDay() === 1) tasks.push("Wasserwechsel");
    return tasks;
  }, [todayPlan, today]);

  const daysSinceWaterChange = useMemo(() => {
    if (!latestWaterChange?.date) return null;
    const last = new Date(`${latestWaterChange.date}T00:00:00`).getTime();
    const now = new Date(`${todayISO()}T00:00:00`).getTime();
    return Math.round((now - last) / (1000 * 60 * 60 * 24));
  }, [latestWaterChange]);

  const weekOverview = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - diffToMonday);

    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      date.setHours(12, 0, 0, 0);
      const iso = toLocalISO(date);
      const weekday = WEEKDAYS[date.getDay()];
      const plan = [...(FERTILIZER_PLAN[date.getDay()] || [])];
      if (date.getDay() === 1) plan.push("Wasserwechsel");

      const dayFertilizers = logs.fertilizer.filter(
        (entry) => entry.aquariumId === selectedAquarium && entry.date === iso
      );
      const dayWater = logs.water.find(
        (entry) => entry.aquariumId === selectedAquarium && entry.date === iso
      );
      const dayWaterChange = logs.waterChange.some(
        (entry) => entry.aquariumId === selectedAquarium && entry.date === iso
      );

      const doneTasks = plan.filter((task) => {
        if (task === "Wasserwechsel") return dayWaterChange;
        return dayFertilizers.some((entry) => entry.fertilizer === task);
      });

      return {
        iso,
        displayDate: date.toLocaleDateString("de-DE"),
        weekday,
        shortWeekday: weekday.slice(0, 2),
        plan,
        doneTasks,
        dayWater,
      };
    });
  }, [logs.fertilizer, logs.water, logs.waterChange, selectedAquarium]);

  const chartData = useMemo(() => {
    const now = new Date();
    const filtered = waterLogs.filter((entry) => {
      if (timeFilter === "all") return true;
      const d = new Date(`${entry.date}T00:00:00`);
      const past = new Date();
      if (timeFilter === "30") past.setDate(now.getDate() - 30);
      if (timeFilter === "90") past.setDate(now.getDate() - 90);
      if (timeFilter === "365") past.setDate(now.getDate() - 365);
      return d >= past;
    });

    return [...filtered]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: formatDate(entry.date),
        no3: toNumber(entry.no3),
        no2: toNumber(entry.no2),
        ph: toNumber(entry.ph),
        o2: toNumber(entry.o2),
      }));
  }, [waterLogs, timeFilter]);

  function addFertilizerLog() {
    if (!fertilizerForm.amount.trim()) return;
    const entry: FertilizerLog = {
      id: uid(),
      aquariumId: fertilizerForm.aquariumId,
      date: fertilizerForm.date,
      fertilizer: fertilizerForm.fertilizer,
      amount: fertilizerForm.amount,
    };
    setLogs((prev) => ({ ...prev, fertilizer: [entry, ...prev.fertilizer] }));
    setFertilizerForm((prev) => ({ ...prev, amount: "" }));
  }

  function quickLogToday(fertilizer: string) {
    const entry: FertilizerLog = {
      id: uid(),
      aquariumId: selectedAquarium,
      date: todayISO(),
      fertilizer,
      amount: "erledigt",
    };
    setLogs((prev) => ({ ...prev, fertilizer: [entry, ...prev.fertilizer] }));
  }

  function addWaterLog() {
    const entry: WaterLog = {
      id: uid(),
      aquariumId: waterForm.aquariumId,
      date: waterForm.date,
      no3: waterForm.no3,
      no2: waterForm.no2,
      ph: waterForm.ph,
      o2: waterForm.o2,
    };
    setLogs((prev) => ({ ...prev, water: [entry, ...prev.water] }));
    setWaterForm((prev) => ({ ...prev, no3: "", no2: "", ph: "", o2: "" }));
  }

  function quickLogWaterChange() {
    const entry: WaterChangeLog = {
      id: uid(),
      aquariumId: selectedAquarium,
      date: todayISO(),
      amount: "erledigt",
    };
    setLogs((prev) => ({ ...prev, waterChange: [entry, ...prev.waterChange] }));
  }

  function removeLog(type: keyof Logs, id: string) {
    setLogs((prev) => {
      if (type === "fertilizer") {
        return {
          ...prev,
          fertilizer: prev.fertilizer.filter((entry) => entry.id !== id),
        };
      }

      if (type === "water") {
        return {
          ...prev,
          water: prev.water.filter((entry) => entry.id !== id),
        };
      }

      return {
        ...prev,
        waterChange: prev.waterChange.filter((entry) => entry.id !== id),
      };
    });
  }

  function exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      selectedAquarium,
      logs,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aquarium-logbuch-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || ""));
        if (!data?.logs) {
          alert("Ungültige Backup-Datei.");
          return;
        }
        setLogs({
          fertilizer: data.logs.fertilizer || [],
          water: data.logs.water || [],
          waterChange: data.logs.waterChange || [],
        });
        if (data.selectedAquarium) setSelectedAquarium(data.selectedAquarium);
        alert("Backup erfolgreich importiert.");
      } catch {
        alert("Die Datei konnte nicht importiert werden.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div>
            <h1 style={styles.h1}>Aquarium Logbuch</h1>
            <p style={styles.sub}>
              Einfaches Handy-Log für Dünger, Wasserwerte und Wasserwechsel.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={styles.tabRow}>
              {AQUARIUMS.map((aq) => (
                <button
                  key={aq.id}
                  onClick={() => setSelectedAquarium(aq.id)}
                  style={{
                    ...styles.tab,
                    ...(selectedAquarium === aq.id ? styles.tabActive : {}),
                  }}
                >
                  {aq.name}
                </button>
              ))}
            </div>
            <div style={styles.buttonRowWrap}>
              <button style={styles.secondaryButton} onClick={exportBackup}>
                <Download size={16} /> Backup exportieren
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} /> Backup importieren
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={importBackup}
              />
            </div>
          </div>
        </div>

        <div style={styles.grid3}>
          <section style={styles.card}>
            <div style={styles.cardTitle}>
              <CalendarDays size={18} /> Dashboard
            </div>
            <div style={styles.tipBox}>
              <div style={styles.valueLabel}>Heute zu tun</div>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {tasksToday.map((task) => (
                  <div key={task} style={styles.taskRow}>
                    • {task}
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.infoRow}>
              <span>Letzter Wasserwechsel</span>
              <strong>
                {daysSinceWaterChange == null
                  ? "noch keiner"
                  : `vor ${daysSinceWaterChange} Tagen`}
              </strong>
            </div>
            <div style={styles.tipBox}>
              <div style={styles.valueLabel}>Nitrat-Trend</div>
              <strong>{no3TrendText}</strong>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardTitle}>
              <CalendarDays size={18} /> Heute
            </div>
            <div style={styles.muted}>
              {WEEKDAYS[today.getDay()]} · {today.toLocaleDateString("de-DE")}
            </div>
            <div style={styles.badgeRow}>
              {todayPlan.map((item) => (
                <span key={item} style={styles.badge}>
                  {item}
                </span>
              ))}
            </div>
            <div style={styles.columnGap}>
              <button
                style={styles.primaryButton}
                onClick={() => quickLogToday("NPK")}
              >
                NPK als erledigt speichern
              </button>
              <button
                style={styles.primaryButton}
                onClick={() => quickLogToday("Ferropol")}
              >
                Ferropol als erledigt speichern
              </button>
              <button
                style={styles.primaryButton}
                onClick={() => quickLogToday("Tagesdünger")}
              >
                Tagesdünger als erledigt speichern
              </button>
              {today.getDay() === 1 && (
                <button
                  style={styles.primaryButton}
                  onClick={quickLogWaterChange}
                >
                  Wasserwechsel als erledigt speichern
                </button>
              )}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardTitle}>
              <Droplets size={18} /> {aquariumName}
            </div>
            <div style={styles.infoRow}>
              <span>Letzte Messung</span>
              <strong>
                {latestWater ? formatDate(latestWater.date) : "noch keine"}
              </strong>
            </div>
            <div style={styles.infoRow}>
              <span>Letzter Wasserwechsel</span>
              <strong>
                {latestWaterChange
                  ? formatDate(latestWaterChange.date)
                  : "noch keiner"}
              </strong>
            </div>
            <div style={styles.valueGrid}>
              <div style={styles.valueCard}>
                <div style={styles.valueLabel}>NO3</div>
                <div style={styles.valueNum}>{latestWater?.no3 || "-"}</div>
              </div>
              <div style={styles.valueCard}>
                <div style={styles.valueLabel}>NO2</div>
                <div style={styles.valueNum}>{latestWater?.no2 || "-"}</div>
              </div>
              <div style={styles.valueCard}>
                <div style={styles.valueLabel}>pH</div>
                <div style={styles.valueNum}>{latestWater?.ph || "-"}</div>
              </div>
              <div style={styles.valueCard}>
                <div style={styles.valueLabel}>O₂</div>
                <div style={styles.valueNum}>{latestWater?.o2 || "-"}</div>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.cardTitle}>
              <LineChartIcon size={18} /> Überblick
            </div>
            <div style={styles.infoRow}>
              <span>Dünger-Einträge</span>
              <strong>{fertilizerLogs.length}</strong>
            </div>
            <div style={styles.infoRow}>
              <span>Wasser-Messungen</span>
              <strong>{waterLogs.length}</strong>
            </div>
            <div style={styles.infoRow}>
              <span>Wasserwechsel</span>
              <strong>{waterChangeLogs.length}</strong>
            </div>
            <div style={styles.tipBox}>
              Tipp: Auf dem Handy als Startbildschirm-App speichern. Über den
              Backup-Export kannst du deine Daten sichern.
            </div>
            <div style={styles.syncBox}>
              <strong>Sync:</strong> {syncStatus}
            </div>
          </section>
        </div>

        <div style={styles.grid2}>
          <section style={styles.card}>
            <div style={styles.sectionHead}>
              <div style={styles.cardTitle}>
                <FlaskConical size={18} /> Dünger eintragen
              </div>
            </div>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Datum
                <input
                  style={styles.input}
                  type="date"
                  value={fertilizerForm.date}
                  onChange={(e) =>
                    setFertilizerForm({
                      ...fertilizerForm,
                      date: e.target.value,
                    })
                  }
                />
              </label>
              <label style={styles.label}>
                Dünger
                <select
                  style={styles.input}
                  value={fertilizerForm.fertilizer}
                  onChange={(e) =>
                    setFertilizerForm({
                      ...fertilizerForm,
                      fertilizer: e.target.value,
                    })
                  }
                >
                  <option value="Ferropol">Ferropol</option>
                  <option value="NPK">NPK</option>
                  <option value="Tagesdünger">Tagesdünger</option>
                </select>
              </label>
              <label style={styles.label}>
                Menge
                <input
                  style={styles.input}
                  placeholder="z. B. 5 ml"
                  value={fertilizerForm.amount}
                  onChange={(e) =>
                    setFertilizerForm({
                      ...fertilizerForm,
                      amount: e.target.value,
                    })
                  }
                />
              </label>
              <button style={styles.primaryButton} onClick={addFertilizerLog}>
                Speichern
              </button>
            </div>

            <div style={styles.historyList}>
              {fertilizerLogs.length === 0 ? (
                <div style={styles.emptyBox}>
                  Noch keine Dünger-Einträge für dieses Aquarium.
                </div>
              ) : (
                fertilizerLogs.map((entry) => (
                  <div key={entry.id} style={styles.historyItemRow}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{entry.fertilizer}</div>
                      <div style={styles.smallMuted}>
                        {formatDate(entry.date)} · {entry.amount}
                      </div>
                    </div>
                    <button
                      style={styles.iconButton}
                      onClick={() => removeLog("fertilizer", entry.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionHead}>
              <div style={styles.cardTitle}>
                <Droplets size={18} /> Wasserwerte eintragen
              </div>
            </div>
            <div style={styles.formGrid}>
              <label style={styles.label}>
                Datum
                <input
                  style={styles.input}
                  type="date"
                  value={waterForm.date}
                  onChange={(e) =>
                    setWaterForm({ ...waterForm, date: e.target.value })
                  }
                />
              </label>
              <label style={styles.label}>
                NO3
                <input
                  style={styles.input}
                  value={waterForm.no3}
                  onChange={(e) =>
                    setWaterForm({ ...waterForm, no3: e.target.value })
                  }
                />
              </label>
              <label style={styles.label}>
                NO2
                <input
                  style={styles.input}
                  value={waterForm.no2}
                  onChange={(e) =>
                    setWaterForm({ ...waterForm, no2: e.target.value })
                  }
                />
              </label>
              <label style={styles.label}>
                pH
                <input
                  style={styles.input}
                  value={waterForm.ph}
                  onChange={(e) =>
                    setWaterForm({ ...waterForm, ph: e.target.value })
                  }
                />
              </label>
              <label style={styles.label}>
                O₂
                <input
                  style={styles.input}
                  value={waterForm.o2}
                  onChange={(e) =>
                    setWaterForm({ ...waterForm, o2: e.target.value })
                  }
                />
              </label>
              <button style={styles.primaryButton} onClick={addWaterLog}>
                Speichern
              </button>
            </div>

            <div style={styles.historyList}>
              {waterLogs.length === 0 ? (
                <div style={styles.emptyBox}>
                  Noch keine Wasserwerte für dieses Aquarium.
                </div>
              ) : (
                waterLogs.map((entry) => (
                  <div key={entry.id} style={styles.historyItemColumn}>
                    <div style={styles.historyHeader}>
                      <div style={{ fontWeight: 600 }}>
                        Messung vom {formatDate(entry.date)}
                      </div>
                      <button
                        style={styles.iconButton}
                        onClick={() => removeLog("water", entry.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div style={styles.valueGrid}>
                      <div style={styles.valueCard}>
                        <div style={styles.valueLabel}>NO3</div>
                        <div style={styles.valueNumSmall}>
                          {entry.no3 || "-"}
                        </div>
                      </div>
                      <div style={styles.valueCard}>
                        <div style={styles.valueLabel}>NO2</div>
                        <div style={styles.valueNumSmall}>
                          {entry.no2 || "-"}
                        </div>
                      </div>
                      <div style={styles.valueCard}>
                        <div style={styles.valueLabel}>pH</div>
                        <div style={styles.valueNumSmall}>
                          {entry.ph || "-"}
                        </div>
                      </div>
                      <div style={styles.valueCard}>
                        <div style={styles.valueLabel}>O₂</div>
                        <div style={styles.valueNumSmall}>
                          {entry.o2 || "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section style={styles.card}>
          <div style={styles.cardTitle}>
            <CalendarDays size={18} /> Wochenübersicht
          </div>
          <div style={styles.gridWeek}>
            {weekOverview.map((day) => (
              <div key={day.iso} style={styles.weekCard}>
                <div style={styles.weekCardHead}>
                  <div style={{ fontWeight: 700 }}>{day.shortWeekday}</div>
                  <div style={styles.smallMuted}>{day.displayDate}</div>
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {day.plan.length === 0 ? (
                    <div style={styles.smallMuted}>Keine Aufgaben</div>
                  ) : (
                    day.plan.map((task) => {
                      const done = day.doneTasks.includes(task);
                      return (
                        <div
                          key={task}
                          style={
                            done ? styles.weekTaskDone : styles.weekTaskOpen
                          }
                        >
                          {done ? "✓" : "○"} {task}
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  {day.dayWater ? (
                    <div style={styles.weekMeasureBox}>
                      Messung: NO3 {day.dayWater.no3 || "-"} · NO2{" "}
                      {day.dayWater.no2 || "-"} · pH {day.dayWater.ph || "-"} ·
                      O₂ {day.dayWater.o2 || "-"}
                    </div>
                  ) : (
                    <div style={styles.smallMuted}>Keine Messung</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>
            <CalendarDays size={18} /> Verlauf & Historie
          </div>
          <div style={styles.grid3}>
            <div>
              <div style={styles.subhead}>Alle Dünger-Einträge</div>
              <div style={styles.historyListTall}>
                {fertilizerLogs.length === 0 ? (
                  <div style={styles.emptyBox}>Noch keine Dünger-Historie.</div>
                ) : (
                  fertilizerLogs.map((entry) => (
                    <div key={entry.id} style={styles.historyItemRow}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {entry.fertilizer}
                        </div>
                        <div style={styles.smallMuted}>
                          {formatDate(entry.date)} · {entry.amount}
                        </div>
                      </div>
                      <button
                        style={styles.iconButton}
                        onClick={() => removeLog("fertilizer", entry.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div style={styles.subhead}>Alle Wasser-Messungen</div>
              <div style={styles.historyListTall}>
                {waterLogs.length === 0 ? (
                  <div style={styles.emptyBox}>Noch keine Wasser-Historie.</div>
                ) : (
                  waterLogs.map((entry) => (
                    <div key={entry.id} style={styles.historyItemColumn}>
                      <div style={styles.historyHeader}>
                        <div style={{ fontWeight: 600 }}>
                          Messung vom {formatDate(entry.date)}
                        </div>
                        <button
                          style={styles.iconButton}
                          onClick={() => removeLog("water", entry.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div style={styles.smallMuted}>
                        NO3 {entry.no3 || "-"} · NO2 {entry.no2 || "-"} · pH{" "}
                        {entry.ph || "-"} · O₂ {entry.o2 || "-"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div style={styles.subhead}>Alle Wasserwechsel</div>
              <div style={styles.historyListTall}>
                {waterChangeLogs.length === 0 ? (
                  <div style={styles.emptyBox}>
                    Noch keine Wasserwechsel-Historie.
                  </div>
                ) : (
                  waterChangeLogs.map((entry) => (
                    <div key={entry.id} style={styles.historyItemRow}>
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Waves size={16} /> Wasserwechsel
                        </div>
                        <div style={styles.smallMuted}>
                          {formatDate(entry.date)} · {entry.amount}
                        </div>
                      </div>
                      <button
                        style={styles.iconButton}
                        onClick={() => removeLog("waterChange", entry.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHead}>
            <div style={styles.cardTitle}>
              <LineChartIcon size={18} /> Wasserwerte-Verlauf
            </div>
            <div style={styles.buttonRowWrap}>
              <button
                style={
                  timeFilter === "all"
                    ? styles.primarySmallButton
                    : styles.secondarySmallButton
                }
                onClick={() => setTimeFilter("all")}
              >
                Alles
              </button>
              <button
                style={
                  timeFilter === "30"
                    ? styles.primarySmallButton
                    : styles.secondarySmallButton
                }
                onClick={() => setTimeFilter("30")}
              >
                30 Tage
              </button>
              <button
                style={
                  timeFilter === "90"
                    ? styles.primarySmallButton
                    : styles.secondarySmallButton
                }
                onClick={() => setTimeFilter("90")}
              >
                3 Monate
              </button>
              <button
                style={
                  timeFilter === "365"
                    ? styles.primarySmallButton
                    : styles.secondarySmallButton
                }
                onClick={() => setTimeFilter("365")}
              >
                1 Jahr
              </button>
            </div>
          </div>

          {chartData.length < 2 ? (
            <div style={styles.emptyBox}>
              Für ein Diagramm brauchst du mindestens 2 Messungen im
              ausgewählten Aquarium.
            </div>
          ) : (
            <>
              <div style={{ width: "100%", height: 340, marginTop: 8 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="no3"
                      name="NO3"
                      stroke="#2563eb"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="no2"
                      name="NO2"
                      stroke="#16a34a"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="ph"
                      name="pH"
                      stroke="#ea580c"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="o2"
                      name="O₂"
                      stroke="#7c3aed"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.grid3}>
                <div style={styles.tipBox}>
                  <div style={styles.valueLabel}>Pflegeplan</div>
                  <strong>Montag Wasserwechsel</strong>
                </div>
                <div style={styles.tipBox}>
                  <div style={styles.valueLabel}>Düngung</div>
                  <strong>NPK · Mo/Mi/Fr</strong>
                </div>
                <div style={styles.tipBox}>
                  <div style={styles.valueLabel}>Düngung</div>
                  <strong>Ferropol · Di/Do</strong>
                </div>
              </div>
              <div style={styles.smallMuted}>
                Das Diagramm zeigt die Entwicklung deiner eingetragenen
                Wochenwerte für {aquariumName}.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 16,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  h1: { margin: 0, fontSize: 32 },
  sub: { margin: "6px 0 0", color: "#475569" },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 16,
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  gridWeek: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
  },
  card: {
    background: "white",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)",
    display: "grid",
    gap: 12,
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    fontSize: 18,
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  muted: { color: "#64748b", fontSize: 14 },
  smallMuted: { color: "#64748b", fontSize: 13 },
  subhead: { fontWeight: 600, marginBottom: 8, color: "#334155" },
  badgeRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  badge: {
    background: "#e2e8f0",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 13,
  },
  columnGap: { display: "grid", gap: 8 },
  buttonRowWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
  primaryButton: {
    border: "none",
    borderRadius: 14,
    padding: "11px 14px",
    background: "#0f172a",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 14px",
    background: "white",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  primarySmallButton: {
    border: "none",
    borderRadius: 12,
    padding: "8px 10px",
    background: "#0f172a",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
  secondarySmallButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "8px 10px",
    background: "white",
    color: "#0f172a",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  tab: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 14px",
    background: "white",
    cursor: "pointer",
    fontWeight: 600,
  },
  tabActive: {
    background: "#0f172a",
    color: "white",
    borderColor: "#0f172a",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    background: "#f1f5f9",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 14,
  },
  valueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  valueCard: {
    background: "#fff",
    borderRadius: 14,
    padding: 12,
    boxShadow: "0 1px 4px rgba(15, 23, 42, 0.06)",
  },
  valueLabel: { color: "#64748b", fontSize: 12 },
  valueNum: { fontSize: 24, fontWeight: 700 },
  valueNumSmall: { fontSize: 18, fontWeight: 700 },
  tipBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 12,
    color: "#334155",
    background: "#f8fafc",
  },
  syncBox: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: 12,
    color: "#334155",
    background: "#eef2ff",
    fontSize: 14,
  },
  formGrid: {
    display: "grid",
    gap: 10,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 14,
    color: "#334155",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    boxSizing: "border-box",
  },
  historyList: {
    display: "grid",
    gap: 10,
    maxHeight: 360,
    overflowY: "auto",
    paddingRight: 2,
  },
  historyListTall: {
    display: "grid",
    gap: 10,
    maxHeight: 320,
    overflowY: "auto",
    paddingRight: 2,
  },
  historyItemRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "white",
  },
  historyItemColumn: {
    display: "grid",
    gap: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    background: "white",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  iconButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: 6,
    borderRadius: 10,
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 14,
    color: "#64748b",
    fontSize: 14,
  },
  taskRow: {
    background: "white",
    borderRadius: 10,
    padding: "8px 10px",
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },
  weekCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 12,
    display: "grid",
    gap: 8,
  },
  weekCardHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },
  weekTaskDone: {
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 13,
  },
  weekTaskOpen: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 13,
  },
  weekMeasureBox: {
    background: "white",
    borderRadius: 10,
    padding: "8px 10px",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    color: "#334155",
    lineHeight: 1.4,
  },
};

export default App;
