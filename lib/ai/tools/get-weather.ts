import { tool } from "ai";
import { z } from "zod";

async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch {
    return null;
  }
}

export const getWeather = tool({
  description:
    "Get the current weather at a location. You can provide either coordinates or a city name.",
  inputSchema: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    city: z
      .string()
      .describe("City name (e.g., 'San Francisco', 'New York', 'London')")
      .optional(),
  }),
  execute: async (input) => {
    let latitude: number;
    let longitude: number;

    if (input.city) {
      const coords = await geocodeCity(input.city);
      if (!coords) {
        return {
          connectorType: "weather",
          data: {
            error: `Could not find coordinates for "${input.city}". Please check the city name.`,
          },
          schemaVersion: 1,
        };
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else if (input.latitude !== undefined && input.longitude !== undefined) {
      latitude = input.latitude;
      longitude = input.longitude;
    } else {
      return {
        connectorType: "weather",
        data: {
          error:
            "Please provide either a city name or both latitude and longitude coordinates.",
        },
        schemaVersion: 1,
      };
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
    );

    const weatherData = await response.json();

    const cityName = "city" in input ? input.city : undefined;
    const location =
      cityName ||
      `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°`;

    // Determine day/night from sunrise/sunset
    let isDay = true;
    if (weatherData.daily?.sunrise?.[0] && weatherData.daily?.sunset?.[0]) {
      const now = new Date();
      const sunrise = new Date(weatherData.daily.sunrise[0]);
      const sunset = new Date(weatherData.daily.sunset[0]);
      isDay = now >= sunrise && now <= sunset;
    }

    // Simple weather condition from temperature
    const temp = weatherData.current?.temperature_2m;
    let condition = "unknown";
    if (temp !== undefined) {
      if (temp > 30) condition = "hot";
      else if (temp > 20) condition = "warm";
      else if (temp > 10) condition = "mild";
      else if (temp > 0) condition = "cool";
      else condition = "cold";
    }

    const currentHigh = weatherData.hourly?.temperature_2m
      ? Math.max(...weatherData.hourly.temperature_2m.slice(0, 24))
      : temp;
    const currentLow = weatherData.hourly?.temperature_2m
      ? Math.min(...weatherData.hourly.temperature_2m.slice(0, 24))
      : temp;

    return {
      connectorType: "weather",
      data: {
        temperature: temp,
        weather: condition,
        location,
        units: weatherData.current_units?.temperature_2m || "°C",
        currentHigh,
        currentLow,
        isDay,
        timezone: weatherData.timezone,
      },
      schemaVersion: 1,
    };
  },
});
