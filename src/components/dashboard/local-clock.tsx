"use client";

import dayjs from "dayjs";
import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

function getTimezoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

export function LocalClock() {
  const [clock, setClock] = useState({ time: "", timezone: "Local" });

  useEffect(() => {
    const updateClock = () => {
      setClock({
        time: dayjs().format("YYYY/MM/DD HH:mm:ss"),
        timezone: getTimezoneLabel()
      });
    };

    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="status-pill status-pill-blue local-clock" title={clock.time ? clock.timezone : undefined}>
      <Clock3 aria-hidden="true" size={14} />
      <span>{clock.time || "----/--/-- --:--:--"}</span>
    </span>
  );
}
