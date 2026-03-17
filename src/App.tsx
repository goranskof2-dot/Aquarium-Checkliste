import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Download,
  Droplets,
  FlaskConical,
  LineChart as LineChartIcon,
  Plus,
  RefreshCw,
  Sparkles,
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

type DosageMap = Record<
  string,
  {
    ferropol: string;
    npk: string;
    tages: string;
  }
>;

type CloudState = {
  selectedAquarium: string;
  logs: Logs;
  dosage?: DosageMap;
  aquariums?: Aquarium[];
};

type TabKey = "dashboard" | "fertilizer" | "water" | "history" | "chart";

const INITIAL_AQUARIUMS: Aquarium[] = [
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

const STORAGE_KEY = "aquarium-logbuch-v9";
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

function defaultDosage(aquariums: Aquarium[]): DosageMap {
  return aquariums.reduce<DosageMap>((acc, aq) => {
    acc[aq.id] = { ferropol: "", npk: "", tages: "" };
    return acc;
  }, {});
}

function mergeDosage(aquariums: Aquarium[], incoming?: DosageMap): DosageMap {
  const base = defaultDosage(aquariums);
  if (!incoming) return base;

  return aquariums.reduce<DosageMap>((acc, aq) => {
    acc[aq.id] = incoming[aq.id] || base[aq.id];
    return acc;
  }, {});
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

export default function App() {
  const [selectedAquarium, setSelectedAquarium] = useState<string>("aq200");
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const [aquariums, setAquariums] = useState<Aquarium[]>(INITIAL_AQUARIUMS);
  const [logs, setLogs] = useState<Logs>(emptyLogs());
  const [dosage, setDosage] = useState<DosageMap>(
    defaultDosage(INITIAL_AQUARIUMS)
  );

  const [cloudReady, setCloudReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>(
    "Cloud wird verbunden …"
  );
  const [hasLoadedCloud, setHasLoadedCloud] = useState<boolean>(false);

  const [showSplash, setShowSplash] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );

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
    const timer = window.setTimeout(() => {
      setShowSplash(false);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, []);
  
  useEffect(() => {
  if (Notification.permission !== "granted") return;

  const today = new Date();
  const day = today.getDay();
  const todayKey = today.toISOString().slice(0, 10);

  const lastShown = localStorage.getItem("lastReminder");

  if (lastShown === todayKey) return;

  let message = "";

  if (day === 1) {
    message = "Heute Wasserwechsel nicht vergessen 🌊";
  } else if ([1, 3, 5].includes(day)) {
    message = "Heute NPK düngen 🌿";
  } else if ([2, 4].includes(day)) {
    message = "Heute Ferropol düngen 🌱";
  }

  if (!message) return;

  navigator.serviceWorker.ready.then((reg) => {
    reg.showNotification("Aquarium Logbuch", {
      body: message,
      icon: "/icon-192.png",
    });

    localStorage.setItem("lastReminder", todayKey);
  });
}, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service Worker konnte nicht registriert werden:", err);
      });
    }
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      alert(
        "Benachrichtigungen werden auf diesem Gerät oder Browser nicht unterstützt."
      );
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      alert("Benachrichtigungen sind aktiviert.");
    } else if (permission === "denied") {
      alert("Benachrichtigungen wurden blockiert.");
    }
  }

  async function sendTestNotification() {
  if (!("Notification" in window)) {
    alert("Benachrichtigungen werden nicht unterstützt.");
    return;
  }

  if (Notification.permission !== "granted") {
    alert("Bitte zuerst Benachrichtigungen aktivieren.");
    return;
  }

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification("Aquarium Logbuch", {
        body: "Zeit für Dünger oder Wasserwechsel 🌊",
        icon: "/icon-192.png",
        tag: "aquarium-test",
      });

      console.log("Notification über Service Worker gesendet");
      return;
    }

    // Fallback
    new Notification("Aquarium Logbuch", {
      body: "Zeit für Dünger oder Wasserwechsel 🌊",
    });

  } catch (err) {
    console.error(err);
    alert("Fehler bei Benachrichtigung");
  }
}

  async function refreshCloudState() {
    try {
      setSyncStatus("Cloud wird neu geladen …");

      const { data, error } = await supabase
        .from("app_state")
        .select("id, data")
        .eq("id", CLOUD_ROW_ID)
        .maybeSingle();

      if (error) {
        console.error(error);
        setSyncStatus("Cloud-Fehler beim Laden");
        return;
      }

      if (data?.data) {
        const cloudData = data.data as CloudState;
        const cloudAquariums = cloudData.aquariums || INITIAL_AQUARIUMS;

        setAquariums(cloudAquariums);
        setLogs(cloudData.logs || emptyLogs());
        setDosage(mergeDosage(cloudAquariums, cloudData.dosage));

        if (cloudData.selectedAquarium) {
          setSelectedAquarium(cloudData.selectedAquarium);
        }

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            selectedAquarium: cloudData.selectedAquarium || "aq200",
            logs: cloudData.logs || emptyLogs(),
            dosage: mergeDosage(cloudAquariums, cloudData.dosage),
            aquariums: cloudAquariums,
          })
        );

        setSyncStatus("Cloud-Daten geladen");
      } else {
        setSyncStatus("Noch keine Cloud-Daten – lokale Daten aktiv");
      }
    } catch (error) {
      console.error(error);
      setSyncStatus("Cloud nicht erreichbar");
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const savedAquariums: Aquarium[] = parsed.aquariums || INITIAL_AQUARIUMS;

      setAquariums(savedAquariums);
      setLogs(parsed.logs || emptyLogs());
      setDosage(mergeDosage(savedAquariums, parsed.dosage));

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
          const cloudAquariums = cloudData.aquariums || INITIAL_AQUARIUMS;

          setAquariums(cloudAquariums);
          setLogs(cloudData.logs || emptyLogs());
          setDosage(mergeDosage(cloudAquariums, cloudData.dosage));

          if (cloudData.selectedAquarium) {
            setSelectedAquarium(cloudData.selectedAquarium);
          }

          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              selectedAquarium: cloudData.selectedAquarium || "aq200",
              logs: cloudData.logs || emptyLogs(),
              dosage: mergeDosage(cloudAquariums, cloudData.dosage),
              aquariums: cloudAquariums,
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
      JSON.stringify({ selectedAquarium, logs, dosage, aquariums })
    );
  }, [selectedAquarium, logs, dosage, aquariums]);

  useEffect(() => {
    if (!cloudReady || !hasLoadedCloud) return;

    const timeout = window.setTimeout(async () => {
      try {
        setSyncStatus("Synchronisiert …");

        const payload: CloudState = {
          selectedAquarium,
          logs,
          dosage,
          aquariums,
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
  }, [selectedAquarium, logs, dosage, aquariums, cloudReady, hasLoadedCloud]);

  useEffect(() => {
    setFertilizerForm((prev) => ({ ...prev, aquariumId: selectedAquarium }));
    setWaterForm((prev) => ({ ...prev, aquariumId: selectedAquarium }));
  }, [selectedAquarium]);

  const today = new Date();
  const todayPlan = FERTILIZER_PLAN[today.getDay()] || [];

  const aquariumName =
    aquariums.find((a) => a.id === selectedAquarium)?.name || "Aquarium";

  const activeDose = dosage[selectedAquarium] || {
    ferropol: "",
    npk: "",
    tages: "",
  };

  function updateDose(field: "ferropol" | "npk" | "tages", value: string) {
    setDosage((prev) => ({
      ...prev,
      [selectedAquarium]: {
        ...(prev[selectedAquarium] || { ferropol: "", npk: "", tages: "" }),
        [field]: value,
      },
    }));
  }

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

  function addAquarium() {
    const name = window.prompt("Name des neuen Aquariums?");
    if (!name || !name.trim()) return;

    const litersInput = window.prompt("Wie viele Liter?");
    if (!litersInput || !litersInput.trim()) return;

    const liters = Number(litersInput.replace(",", "."));
    if (Number.isNaN(liters) || liters <= 0) {
      alert("Bitte eine gültige Literzahl eingeben.");
      return;
    }

    const id = `aq-${Date.now()}`;
    const newAquarium: Aquarium = {
      id,
      name: name.trim(),
      liters,
    };

    setAquariums((prev) => [...prev, newAquarium]);
    setDosage((prev) => ({
      ...prev,
      [id]: { ferropol: "", npk: "", tages: "" },
    }));
    setSelectedAquarium(id);
  }

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
      dosage,
      aquariums,
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

        const importedAquariums: Aquarium[] =
          data.aquariums || INITIAL_AQUARIUMS;

        setAquariums(importedAquariums);
        setLogs({
          fertilizer: data.logs.fertilizer || [],
          water: data.logs.water || [],
          waterChange: data.logs.waterChange || [],
        });
        setDosage(mergeDosage(importedAquariums, data.dosage));

        if (data.selectedAquarium) setSelectedAquarium(data.selectedAquarium);

        alert("Backup erfolgreich importiert.");
      } catch {
        alert("Die Datei konnte nicht importiert werden.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  function renderSplash() {
  const fish = Array.from({ length: 28 }).map((_, index) => {
    const lane = index % 14;
    const isReverse = index % 5 === 0 || index % 6 === 0;
    const top = 6 + lane * 6.2;
    const delay = index * 0.16;
    const duration = 6.5 + (index % 6) * 0.9;
    const scale = 0.55 + (index % 5) * 0.16;
    const opacity = 0.28 + (index % 6) * 0.1;

    return (
      <div
        key={index}
        style={{
          ...styles.splashFish,
          top: `${top}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          opacity,
          transform: isReverse ? "scaleX(-1)" : "none",
        }}
      >
        <div
          style={{
            ...styles.splashFishInner,
            transform: `scale(${scale}) ${isReverse ? "scaleX(-1)" : ""}`,
          }}
        >
          <div style={styles.splashFishBody} />
          <div style={styles.splashFishTail} />
          <div style={styles.splashFishFinTop} />
          <div style={styles.splashFishFinBottom} />
          <div style={styles.splashFishEye} />
        </div>
      </div>
    );
  });

  return (
    <div style={styles.splashOverlay}>
      <div style={styles.splashGlowA} />
      <div style={styles.splashGlowB} />
      <div style={styles.splashGlowC} />

      <div style={styles.splashWaterGradientTop} />
      <div style={styles.splashWaterGradientBottom} />

      <div style={styles.bubbleLayer}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            style={{
              ...styles.bubble,
              left: `${4 + i * 4}%`,
              width: `${6 + (i % 4) * 4}px`,
              height: `${6 + (i % 4) * 4}px`,
              animationDelay: `${i * 0.22}s`,
              animationDuration: `${5 + (i % 5) * 0.9}s`,
              opacity: 0.16 + (i % 5) * 0.06,
            }}
          />
        ))}
      </div>

      <div style={styles.fishLane}>{fish}</div>

      <div style={styles.splashCenter}>
        <div style={styles.splashBadge}>AQUARIUM LOGBUCH</div>
        <h1 style={styles.splashTitle}>Dein Becken. Dein Rhythmus.</h1>
        <p style={styles.splashText}>
          Pflege, Wasserwerte und Dünger in einer ruhigen, modernen Ansicht.
        </p>
      </div>
    </div>
  );
}

  function renderDashboard() {
    return (
      <div style={styles.screenGrid}>
        <section style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.eyebrow}>Heute im Fokus</div>
              <div style={styles.heroTitle}>{aquariumName}</div>
              <div style={styles.heroSubtitle}>
                {WEEKDAYS[today.getDay()]} · {today.toLocaleDateString("de-DE")}
              </div>
            </div>
            <div style={styles.heroOrb}>
              <Droplets size={26} />
            </div>
          </div>

          <div style={styles.badgeRow}>
            {tasksToday.length === 0 ? (
              <span style={styles.badge}>Keine Aufgaben</span>
            ) : (
              tasksToday.map((item) => (
                <span key={item} style={styles.badgePrimary}>
                  {item}
                </span>
              ))
            )}
          </div>

          <div style={styles.heroActionGrid}>
            <button
              style={styles.primaryButton}
              onClick={() => quickLogToday("NPK")}
            >
              NPK erledigt
            </button>
            <button
              style={styles.primaryButton}
              onClick={() => quickLogToday("Ferropol")}
            >
              Ferropol erledigt
            </button>
            <button
              style={styles.primaryButton}
              onClick={() => quickLogToday("Tagesdünger")}
            >
              Tagesdünger erledigt
            </button>
            {today.getDay() === 1 && (
              <button
                style={styles.primaryButton}
                onClick={quickLogWaterChange}
              >
                Wasserwechsel erledigt
              </button>
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardTitle}>
            <CalendarDays size={18} /> Dashboard
          </div>

          <div style={styles.tipBox}>
            <div style={styles.valueLabel}>Heute zu tun</div>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {tasksToday.length === 0 ? (
                <div style={styles.taskRow}>Heute ist alles ruhig 🌿</div>
              ) : (
                tasksToday.map((task) => (
                  <div key={task} style={styles.taskRow}>
                    • {task}
                  </div>
                ))
              )}
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
            <Droplets size={18} /> Letzte Werte
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
            Tipp: Als Startbildschirm-App speichern und Benachrichtigungen
            aktivieren.
          </div>

          <div style={styles.syncBox}>
            <strong>Sync:</strong> {syncStatus}
          </div>
        </section>
      </div>
    );
  }

  function renderFertilizer() {
    return (
      <div style={styles.screenGrid}>
        <section style={styles.card}>
          <div style={styles.cardTitle}>
            <FlaskConical size={18} /> Standard-Dosierung
          </div>

          <div style={styles.tipBox}>
            Hier kannst du dir merken, wieviel du normalerweise in dieses
            Aquarium dosierst.
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Ferropol
              <input
                style={styles.input}
                placeholder="z. B. 10 ml"
                value={activeDose.ferropol}
                onChange={(e) => updateDose("ferropol", e.target.value)}
              />
            </label>

            <label style={styles.label}>
              NPK
              <input
                style={styles.input}
                placeholder="z. B. 8 ml"
                value={activeDose.npk}
                onChange={(e) => updateDose("npk", e.target.value)}
              />
            </label>

            <label style={styles.label}>
              Tagesdünger
              <input
                style={styles.input}
                placeholder="z. B. 5 ml"
                value={activeDose.tages}
                onChange={(e) => updateDose("tages", e.target.value)}
              />
            </label>
          </div>
        </section>

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
                    <div style={{ fontWeight: 700 }}>{entry.fertilizer}</div>
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
      </div>
    );
  }

  function renderWater() {
    return (
      <div style={styles.screenGrid}>
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
                    <div style={{ fontWeight: 700 }}>
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
                      <div style={styles.valueNumSmall}>{entry.no3 || "-"}</div>
                    </div>
                    <div style={styles.valueCard}>
                      <div style={styles.valueLabel}>NO2</div>
                      <div style={styles.valueNumSmall}>{entry.no2 || "-"}</div>
                    </div>
                    <div style={styles.valueCard}>
                      <div style={styles.valueLabel}>pH</div>
                      <div style={styles.valueNumSmall}>{entry.ph || "-"}</div>
                    </div>
                    <div style={styles.valueCard}>
                      <div style={styles.valueLabel}>O₂</div>
                      <div style={styles.valueNumSmall}>{entry.o2 || "-"}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div style={styles.screenGrid}>
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
                        <div style={{ fontWeight: 700 }}>
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
                        <div style={{ fontWeight: 700 }}>
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
                            fontWeight: 700,
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
      </div>
    );
  }

  function renderChart() {
    return (
      <div style={styles.screenGrid}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="no3"
                      name="NO3"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="no2"
                      name="NO2"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="ph"
                      name="pH"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="o2"
                      name="O₂"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ r: 3 }}
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
                Das Diagramm zeigt die Entwicklung deiner eingetragenen Werte
                für {aquariumName}.
              </div>
            </>
          )}
        </section>
      </div>
    );
  }
  
  return (
    <>
      <style>{`
  @keyframes swimAcross {
    0% {
      transform: translateX(-18vw) translateY(0px);
    }
    20% {
      transform: translateX(10vw) translateY(-6px);
    }
    40% {
      transform: translateX(35vw) translateY(5px);
    }
    60% {
      transform: translateX(62vw) translateY(-8px);
    }
    80% {
      transform: translateX(90vw) translateY(4px);
    }
    100% {
      transform: translateX(118vw) translateY(-3px);
    }
  }

  @keyframes bubbleUp {
    0% {
      transform: translateY(30px) translateX(0px) scale(0.8);
      opacity: 0;
    }
    20% {
      opacity: 0.22;
    }
    40% {
      transform: translateY(-20vh) translateX(6px) scale(0.95);
    }
    70% {
      transform: translateY(-50vh) translateX(-4px) scale(1.05);
    }
    100% {
      transform: translateY(-85vh) translateX(10px) scale(1.15);
      opacity: 0;
    }
  }

  @keyframes fadeSplash {
    0% {
      opacity: 0;
      transform: scale(1.015);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes pulseGlow {
    0% {
      transform: scale(1);
      opacity: 0.34;
    }
    50% {
      transform: scale(1.08);
      opacity: 0.58;
    }
    100% {
      transform: scale(1);
      opacity: 0.34;
    }
  }

  @keyframes fishWiggle {
    0% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(2deg);
    }
    50% {
      transform: rotate(0deg);
    }
    75% {
      transform: rotate(-2deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes centerFloat {
    0% {
      transform: translate(-50%, -50%);
    }
    50% {
      transform: translate(-50%, calc(-50% - 4px));
    }
    100% {
      transform: translate(-50%, -50%);
    }
  }
`}</style>

      {showSplash && renderSplash()}

      <div style={styles.page}>
        <div style={styles.containerWithBottomNav}>
          <div style={styles.topBar}>
            <div style={{ maxWidth: 720 }}>
              <h1 style={styles.h1}>Aquarium Logbuch</h1>
              <p style={styles.sub}>
                Ruhiges, modernes Pflege-Log für Dünger, Wasserwerte,
                Wasserwechsel und Verlauf.
              </p>

              <div style={styles.heroMetaRow}>
                <div style={styles.heroMetaChip}>
                  <Sparkles size={16} /> Ruhiger Pflege-Flow
                </div>
                <div style={styles.heroMetaChip}>
                  <RefreshCw size={16} /> {syncStatus}
                </div>

                <button style={styles.heroMetaButton} onClick={enableNotifications}>
                  <Bell size={16} />
                  {notificationPermission === "granted"
                    ? "Benachrichtigungen aktiv"
                    : notificationPermission === "denied"
                    ? "Benachrichtigungen blockiert"
                    : notificationPermission === "unsupported"
                    ? "Nicht unterstützt"
                    : "Benachrichtigungen aktivieren"}
                </button>

                {notificationPermission === "granted" && (
                  <button
                    style={styles.secondaryPillButton}
                    onClick={sendTestNotification}
                  >
                    Test senden
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={styles.tabRow}>
                {aquariums.map((aq) => (
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

                <button style={styles.addAquariumButton} onClick={addAquarium}>
                  <Plus size={16} />
                </button>
              </div>

              <div style={styles.buttonRowWrap}>
                <button style={styles.secondaryButton} onClick={refreshCloudState}>
                  <RefreshCw size={16} /> Aktualisieren
                </button>

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

          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "fertilizer" && renderFertilizer()}
          {activeTab === "water" && renderWater()}
          {activeTab === "history" && renderHistory()}
          {activeTab === "chart" && renderChart()}
        </div>

        <div style={styles.bottomNav}>
          <button
            style={{
              ...styles.bottomNavButton,
              ...(activeTab === "dashboard" ? styles.bottomNavButtonActive : {}),
            }}
            onClick={() => setActiveTab("dashboard")}
          >
            <CalendarDays size={18} />
            <span>Start</span>
          </button>

          <button
            style={{
              ...styles.bottomNavButton,
              ...(activeTab === "fertilizer" ? styles.bottomNavButtonActive : {}),
            }}
            onClick={() => setActiveTab("fertilizer")}
          >
            <FlaskConical size={18} />
            <span>Dünger</span>
          </button>

          <button
            style={{
              ...styles.bottomNavButton,
              ...(activeTab === "water" ? styles.bottomNavButtonActive : {}),
            }}
            onClick={() => setActiveTab("water")}
          >
            <Droplets size={18} />
            <span>Messung</span>
          </button>

          <button
            style={{
              ...styles.bottomNavButton,
              ...(activeTab === "history" ? styles.bottomNavButtonActive : {}),
            }}
            onClick={() => setActiveTab("history")}
          >
            <Waves size={18} />
            <span>Verlauf</span>
          </button>

          <button
            style={{
              ...styles.bottomNavButton,
              ...(activeTab === "chart" ? styles.bottomNavButtonActive : {}),
            }}
            onClick={() => setActiveTab("chart")}
          >
            <LineChartIcon size={18} />
            <span>Diagramm</span>
          </button>
        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 30%), linear-gradient(180deg, #f4fbff 0%, #eef6fb 45%, #f8fafc 100%)",
    padding: 16,
    fontFamily: "Inter, system-ui, sans-serif",
    color: "#0f172a",
  },

  containerWithBottomNav: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "grid",
    gap: 16,
    paddingBottom: 96,
  },

  screenGrid: {
    display: "grid",
    gap: 16,
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-start",
    background: "rgba(255,255,255,0.62)",
    border: "1px solid rgba(255,255,255,0.75)",
    borderRadius: 28,
    padding: 18,
    backdropFilter: "blur(14px)",
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  h1: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
  },

  sub: {
    margin: "8px 0 0",
    color: "#475569",
    maxWidth: 560,
    lineHeight: 1.5,
  },

  heroMetaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },

  heroMetaChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid #dbeafe",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 700,
  },

  heroMetaButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "10px 14px",
    background: "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  secondaryPillButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    padding: "10px 14px",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
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
    background: "rgba(255,255,255,0.78)",
    borderRadius: 24,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
    display: "grid",
    gap: 12,
    border: "1px solid rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
  },

  heroCard: {
    background:
      "linear-gradient(135deg, rgba(14,165,233,0.18) 0%, rgba(34,197,94,0.08) 100%), rgba(255,255,255,0.72)",
    borderRadius: 28,
    padding: 18,
    boxShadow: "0 12px 34px rgba(15, 23, 42, 0.08)",
    display: "grid",
    gap: 14,
    border: "1px solid rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
  },

  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#0369a1",
  },

  heroTitle: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: "-0.03em",
    marginTop: 6,
  },

  heroSubtitle: {
    marginTop: 4,
    color: "#475569",
    fontSize: 14,
  },

  heroOrb: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(180deg, #ffffff 0%, #e0f2fe 100%)",
    boxShadow: "0 8px 20px rgba(14,165,233,0.18)",
    color: "#0369a1",
    flexShrink: 0,
  },

  heroActionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },

  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 800,
    fontSize: 18,
  },

  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  muted: {
    color: "#64748b",
    fontSize: 14,
  },

  smallMuted: {
    color: "#64748b",
    fontSize: 13,
  },

  subhead: {
    fontWeight: 700,
    marginBottom: 8,
    color: "#334155",
  },

  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  badge: {
    background: "#e2e8f0",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },

  badgePrimary: {
    background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
    border: "1px solid #bfdbfe",
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
  },

  columnGap: {
    display: "grid",
    gap: 8,
  },

  buttonRowWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  primaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "12px 14px",
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(15,23,42,0.14)",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.95)",
    color: "#0f172a",
    fontWeight: 700,
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
    fontWeight: 700,
    cursor: "pointer",
  },

  secondarySmallButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "8px 10px",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },

  tabRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  tab: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 700,
  },

  tabActive: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    color: "white",
    borderColor: "#0f172a",
  },

  addAquariumButton: {
    border: "1px dashed #94a3b8",
    borderRadius: 16,
    padding: "10px 12px",
    background: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    background: "rgba(241,245,249,0.85)",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    border: "1px solid rgba(226,232,240,0.9)",
  },

  valueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  valueCard: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.06)",
    border: "1px solid #e2e8f0",
  },

  valueLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  valueNum: {
    fontSize: 24,
    fontWeight: 800,
    marginTop: 4,
  },

  valueNumSmall: {
    fontSize: 18,
    fontWeight: 800,
    marginTop: 4,
  },

  tipBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    padding: 12,
    color: "#334155",
    background: "rgba(248,250,252,0.82)",
  },

  syncBox: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
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
    fontWeight: 700,
  },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    boxSizing: "border-box",
    background: "rgba(255,255,255,0.95)",
    outline: "none",
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
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.94)",
  },

  historyItemColumn: {
    display: "grid",
    gap: 10,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 12,
    background: "rgba(255,255,255,0.94)",
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
    padding: 8,
    borderRadius: 12,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    padding: 14,
    color: "#64748b",
    fontSize: 14,
    background: "rgba(255,255,255,0.6)",
  },

  taskRow: {
    background: "rgba(255,255,255,0.95)",
    borderRadius: 12,
    padding: "9px 10px",
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },

  weekCard: {
    background: "rgba(248,250,252,0.86)",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
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
    fontWeight: 700,
  },

  weekTaskOpen: {
    background: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "6px 8px",
    fontSize: 13,
    fontWeight: 700,
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

  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(16px)",
    borderTop: "1px solid #e2e8f0",
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 8,
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
    zIndex: 1000,
  },

  bottomNavButton: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: 14,
    padding: "8px 4px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "#475569",
    fontWeight: 700,
  },

  bottomNavButtonActive: {
    background: "#eef2ff",
    color: "#0f172a",
    fontWeight: 800,
  },

  splashOverlay: {
  position: "fixed",
  inset: 0,
  zIndex: 3000,
  overflow: "hidden",
  background:
    "radial-gradient(circle at 20% 15%, rgba(125,211,252,0.22), transparent 18%), radial-gradient(circle at 75% 25%, rgba(34,211,238,0.14), transparent 22%), linear-gradient(180deg, #03131f 0%, #06253a 28%, #0a4560 58%, #0f6b88 100%)",
  animation: "fadeSplash 500ms ease",
},

  splashGlowA: {
  position: "absolute",
  width: 420,
  height: 420,
  borderRadius: "50%",
  background: "rgba(56, 189, 248, 0.09)",
  top: -90,
  left: -90,
  filter: "blur(30px)",
  animation: "pulseGlow 6s ease-in-out infinite",
},

  splashGlowB: {
  position: "absolute",
  width: 380,
  height: 380,
  borderRadius: "50%",
  background: "rgba(103, 232, 249, 0.08)",
  bottom: -120,
  right: -60,
  filter: "blur(32px)",
  animation: "pulseGlow 7s ease-in-out infinite",
},

  fishLane: {
  position: "absolute",
  inset: 0,
},

  splashFish: {
  position: "absolute",
  left: 0,
  width: 46,
  height: 22,
  animationName: "swimAcross",
  animationTimingFunction: "linear",
  animationIterationCount: 1,
},



  bubbleLayer: {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
},

  bubble: {
  position: "absolute",
  bottom: -30,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.28)",
  boxShadow: "0 0 10px rgba(255,255,255,0.1)",
  animationName: "bubbleUp",
  animationTimingFunction: "linear",
  animationIterationCount: "infinite",
},

  splashCenter: {
  position: "absolute",
  left: "50%",
  top: "54%",
  transform: "translate(-50%, -50%)",
  textAlign: "center",
  padding: 24,
  width: "min(92vw, 560px)",
  animation: "centerFloat 4.5s ease-in-out infinite",
},

  splashBadge: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  color: "#e0f2fe",
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.14em",
  backdropFilter: "blur(8px)",
},

  splashTitle: {
  margin: "18px 0 10px",
  fontSize: "clamp(34px, 6vw, 58px)",
  lineHeight: 1,
  letterSpacing: "-0.045em",
  color: "#f8fdff",
  textShadow: "0 8px 30px rgba(0,0,0,0.18)",
},

  splashText: {
  margin: 0,
  color: "rgba(240,249,255,0.9)",
  fontSize: 16,
  lineHeight: 1.6,
},

  splashGlowC: {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: "50%",
  background: "rgba(186, 230, 253, 0.08)",
  top: "28%",
  left: "50%",
  transform: "translateX(-50%)",
  filter: "blur(40px)",
  animation: "pulseGlow 8s ease-in-out infinite",
},

  splashWaterGradientTop: {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 30%)",
  pointerEvents: "none",
},

  splashWaterGradientBottom: {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "28%",
  background:
    "linear-gradient(180deg, rgba(4, 47, 66, 0) 0%, rgba(3, 31, 46, 0.34) 100%)",
  pointerEvents: "none",
},

  splashFishInner: {
  position: "relative",
  width: 46,
  height: 22,
  animation: "fishWiggle 1.6s ease-in-out infinite",
  transformOrigin: "center center",
},

  splashFishBody: {
  position: "absolute",
  left: 10,
  top: 4,
  width: 24,
  height: 14,
  borderRadius: "55% 60% 60% 55%",
  background:
    "linear-gradient(90deg, rgba(224,242,254,0.95) 0%, rgba(125,211,252,0.86) 52%, rgba(34,211,238,0.74) 100%)",
  boxShadow: "0 0 12px rgba(125,211,252,0.18)",
},

  splashFishTail: {
  position: "absolute",
  left: 0,
  top: 6,
  width: 0,
  height: 0,
  borderTop: "5px solid transparent",
  borderBottom: "5px solid transparent",
  borderRight: "10px solid rgba(103,232,249,0.72)",
},

  splashFishFinTop: {
  position: "absolute",
  left: 18,
  top: 1,
  width: 0,
  height: 0,
  borderLeft: "4px solid transparent",
  borderRight: "4px solid transparent",
  borderBottom: "7px solid rgba(186,230,253,0.55)",
},

  splashFishFinBottom: {
  position: "absolute",
  left: 18,
  top: 13,
  width: 0,
  height: 0,
  borderLeft: "4px solid transparent",
  borderRight: "4px solid transparent",
  borderTop: "7px solid rgba(186,230,253,0.4)",
},

  splashFishEye: {
  position: "absolute",
  left: 28,
  top: 9,
  width: 2.5,
  height: 2.5,
  borderRadius: "50%",
  background: "rgba(15,23,42,0.75)",
},
};
