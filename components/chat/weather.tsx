"use client";

import cx from "classnames";
import { format, isWithinInterval } from "date-fns";
import { useEffect, useState } from "react";

const SunIcon = ({ size = 40 }: { size?: number }) => (
  <svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
    <circle cx="12" cy="12" fill="currentColor" r="5" />
    <line stroke="currentColor" strokeWidth="2" x1="12" x2="12" y1="1" y2="3" />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="12"
      x2="12"
      y1="21"
      y2="23"
    />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="4.22"
      x2="5.64"
      y1="4.22"
      y2="5.64"
    />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="18.36"
      x2="19.78"
      y1="18.36"
      y2="19.78"
    />
    <line stroke="currentColor" strokeWidth="2" x1="1" x2="3" y1="12" y2="12" />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="21"
      x2="23"
      y1="12"
      y2="12"
    />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="4.22"
      x2="5.64"
      y1="19.78"
      y2="18.36"
    />
    <line
      stroke="currentColor"
      strokeWidth="2"
      x1="18.36"
      x2="19.78"
      y1="5.64"
      y2="4.22"
    />
  </svg>
);

const MoonIcon = ({ size = 40 }: { size?: number }) => (
  <svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"
      fill="currentColor"
    />
  </svg>
);

const CloudIcon = ({ size = 24 }: { size?: number }) => (
  <svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
    <path
      d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

type WeatherAtLocation = {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  cityName?: string;
  current_units: {
    time: string;
    interval: string;
    temperature_2m: string;
  };
  current: {
    time: string;
    interval: number;
    temperature_2m: number;
  };
  hourly_units: {
    time: string;
    temperature_2m: string;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
  };
  daily_units: {
    time: string;
    sunrise: string;
    sunset: string;
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
};

const SAMPLE = {
  current: { interval: 900, temperature_2m: 29.3, time: "2024-10-07T19:30" },
  current_units: { interval: "seconds", temperature_2m: "°C", time: "iso8601" },
  daily: {
    sunrise: [
      "2024-10-07T07:15",
      "2024-10-08T07:16",
      "2024-10-09T07:17",
      "2024-10-10T07:18",
      "2024-10-11T07:19",
    ],
    sunset: [
      "2024-10-07T19:00",
      "2024-10-08T18:58",
      "2024-10-09T18:57",
      "2024-10-10T18:55",
      "2024-10-11T18:54",
    ],
    time: [
      "2024-10-07",
      "2024-10-08",
      "2024-10-09",
      "2024-10-10",
      "2024-10-11",
    ],
  },
  daily_units: {
    sunrise: "iso8601",
    sunset: "iso8601",
    time: "iso8601",
  },
  elevation: 18,
  generationtime_ms: 0.027_894_973_754_882_812,
  hourly: {
    temperature_2m: [
      36.6, 32.8, 29.5, 28.6, 29.2, 28.2, 27.5, 26.6, 26.5, 26, 25, 23.5, 23.9,
      24.2, 22.9, 21, 24, 28.1, 31.4, 33.9, 32.1, 28.9, 26.9, 25.2, 23, 21.1,
      19.6, 18.6, 17.7, 16.8, 16.2, 15.5, 14.9, 14.4, 14.2, 13.7, 13.3, 12.9,
      12.5, 13.5, 15.8, 17.7, 19.6, 21, 21.9, 22.3, 22, 20.7, 18.9, 17.9, 17.3,
      17, 16.7, 16.2, 15.6, 15.2, 15, 15, 15.1, 14.8, 14.8, 14.9, 14.7, 14.8,
      15.3, 16.2, 17.9, 19.6, 20.5, 21.6, 21, 20.7, 19.3, 18.7, 18.4, 17.9,
      17.3, 17, 17, 16.8, 16.4, 16.2, 16, 15.8, 15.7, 15.4, 15.4, 16.1, 16.7,
      17, 18.6, 19, 19.5, 19.4, 18.5, 17.9, 17.5, 16.7, 16.3, 16.1,
    ],
    time: [
      "2024-10-07T00:00",
      "2024-10-07T01:00",
      "2024-10-07T02:00",
      "2024-10-07T03:00",
      "2024-10-07T04:00",
      "2024-10-07T05:00",
      "2024-10-07T06:00",
      "2024-10-07T07:00",
      "2024-10-07T08:00",
      "2024-10-07T09:00",
      "2024-10-07T10:00",
      "2024-10-07T11:00",
      "2024-10-07T12:00",
      "2024-10-07T13:00",
      "2024-10-07T14:00",
      "2024-10-07T15:00",
      "2024-10-07T16:00",
      "2024-10-07T17:00",
      "2024-10-07T18:00",
      "2024-10-07T19:00",
      "2024-10-07T20:00",
      "2024-10-07T21:00",
      "2024-10-07T22:00",
      "2024-10-07T23:00",
      "2024-10-08T00:00",
      "2024-10-08T01:00",
      "2024-10-08T02:00",
      "2024-10-08T03:00",
      "2024-10-08T04:00",
      "2024-10-08T05:00",
      "2024-10-08T06:00",
      "2024-10-08T07:00",
      "2024-10-08T08:00",
      "2024-10-08T09:00",
      "2024-10-08T10:00",
      "2024-10-08T11:00",
      "2024-10-08T12:00",
      "2024-10-08T13:00",
      "2024-10-08T14:00",
      "2024-10-08T15:00",
      "2024-10-08T16:00",
      "2024-10-08T17:00",
      "2024-10-08T18:00",
      "2024-10-08T19:00",
      "2024-10-08T20:00",
      "2024-10-08T21:00",
      "2024-10-08T22:00",
      "2024-10-08T23:00",
      "2024-10-09T00:00",
      "2024-10-09T01:00",
      "2024-10-09T02:00",
      "2024-10-09T03:00",
      "2024-10-09T04:00",
      "2024-10-09T05:00",
      "2024-10-09T06:00",
      "2024-10-09T07:00",
      "2024-10-09T08:00",
      "2024-10-09T09:00",
      "2024-10-09T10:00",
      "2024-10-09T11:00",
      "2024-10-09T12:00",
      "2024-10-09T13:00",
      "2024-10-09T14:00",
      "2024-10-09T15:00",
      "2024-10-09T16:00",
      "2024-10-09T17:00",
      "2024-10-09T18:00",
      "2024-10-09T19:00",
      "2024-10-09T20:00",
      "2024-10-09T21:00",
      "2024-10-09T22:00",
      "2024-10-09T23:00",
      "2024-10-10T00:00",
      "2024-10-10T01:00",
      "2024-10-10T02:00",
      "2024-10-10T03:00",
      "2024-10-10T04:00",
      "2024-10-10T05:00",
      "2024-10-10T06:00",
      "2024-10-10T07:00",
      "2024-10-10T08:00",
      "2024-10-10T09:00",
      "2024-10-10T10:00",
      "2024-10-10T11:00",
      "2024-10-10T12:00",
      "2024-10-10T13:00",
      "2024-10-10T14:00",
      "2024-10-10T15:00",
      "2024-10-10T16:00",
      "2024-10-10T17:00",
      "2024-10-10T18:00",
      "2024-10-10T19:00",
      "2024-10-10T20:00",
      "2024-10-10T21:00",
      "2024-10-10T22:00",
      "2024-10-10T23:00",
      "2024-10-11T00:00",
      "2024-10-11T01:00",
      "2024-10-11T02:00",
      "2024-10-11T03:00",
    ],
  },
  hourly_units: { temperature_2m: "°C", time: "iso8601" },
  latitude: 37.763_283,
  longitude: -122.412_86,
  timezone: "GMT",
  timezone_abbreviation: "GMT",
  utc_offset_seconds: 0,
};

function n(num: number): number {
  return Math.ceil(num);
}

export function Weather({
  weatherAtLocation = SAMPLE,
}: {
  weatherAtLocation?: WeatherAtLocation;
}) {
  const currentHigh = Math.max(
    ...weatherAtLocation.hourly.temperature_2m.slice(0, 24)
  );
  const currentLow = Math.min(
    ...weatherAtLocation.hourly.temperature_2m.slice(0, 24)
  );

  const isDay = isWithinInterval(new Date(weatherAtLocation.current.time), {
    end: new Date(weatherAtLocation.daily.sunset[0]),
    start: new Date(weatherAtLocation.daily.sunrise[0]),
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hoursToShow = isMobile ? 5 : 6;

  const currentTimeIndex = weatherAtLocation.hourly.time.findIndex(
    (time) => new Date(time) >= new Date(weatherAtLocation.current.time)
  );

  const displayTimes = weatherAtLocation.hourly.time.slice(
    currentTimeIndex,
    currentTimeIndex + hoursToShow
  );
  const displayTemperatures = weatherAtLocation.hourly.temperature_2m.slice(
    currentTimeIndex,
    currentTimeIndex + hoursToShow
  );

  const location =
    weatherAtLocation.cityName ||
    `${weatherAtLocation.latitude?.toFixed(1)}°, ${weatherAtLocation.longitude?.toFixed(1)}°`;

  return (
    <div
      className={cx(
        "relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl p-4 shadow-lg backdrop-blur-sm",
        {
          "bg-gradient-to-br from-sky-400 via-blue-500 to-blue-600": isDay,
        },
        {
          "bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900":
            !isDay,
        }
      )}
    >
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />

      <div className="relative z-10">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-medium text-white/80 text-xs">{location}</div>
          <div className="text-white/60 text-xs">
            {format(new Date(weatherAtLocation.current.time), "MMM d, h:mm a")}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cx("text-white/90", {
                "text-blue-200": !isDay,
                "text-yellow-200": isDay,
              })}
            >
              {isDay ? <SunIcon size={32} /> : <MoonIcon size={32} />}
            </div>
            <div className="font-light text-3xl text-white">
              {n(weatherAtLocation.current.temperature_2m)}
              <span className="text-lg text-white/80">
                {weatherAtLocation.current_units.temperature_2m}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="font-medium text-white/90 text-xs">
              H: {n(currentHigh)}°
            </div>
            <div className="text-white/70 text-xs">L: {n(currentLow)}°</div>
          </div>
        </div>

        <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
          <div className="mb-2 font-medium text-white/80 text-xs">
            Hourly Forecast
          </div>
          <div className="flex justify-between gap-1">
            {displayTimes.map((time, index) => {
              const hourTime = new Date(time);
              const isCurrentHour =
                hourTime.getHours() === new Date().getHours();

              return (
                <div
                  className={cx(
                    "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1.5",
                    {
                      "bg-white/20": isCurrentHour,
                    }
                  )}
                  key={time}
                >
                  <div className="font-medium text-white/70 text-xs">
                    {index === 0 ? "Now" : format(hourTime, "ha")}
                  </div>

                  <div
                    className={cx("text-white/60", {
                      "text-blue-200": !isDay,
                      "text-yellow-200": isDay,
                    })}
                  >
                    <CloudIcon size={16} />
                  </div>

                  <div className="font-medium text-white text-xs">
                    {n(displayTemperatures[index])}°
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-white/60 text-xs">
          <div>
            Sunrise:{" "}
            {format(new Date(weatherAtLocation.daily.sunrise[0]), "h:mm a")}
          </div>
          <div>
            Sunset:{" "}
            {format(new Date(weatherAtLocation.daily.sunset[0]), "h:mm a")}
          </div>
        </div>
      </div>
    </div>
  );
}
