import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type RoomFinderRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

/** Default `pixel_to_meter` for `/analyze_rooms`; reuse for client-side area fallback. */
export const ROOM_FINDER_DEFAULT_PIXEL_TO_METER = 0.01;

/**
 * Reads room area (m²) from an API row. Handles string JSON numbers and alternate keys.
 */
export function readRoomAreaM2FromRow(row: unknown): number | null {
  if (row == null || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const keys = [
    "area_m2",
    "areaM2",
    "area",
    "Area_m2",
    "room_area_m2",
    "total_area_m2",
  ];
  for (const k of keys) {
    const v = o[k];
    if (v == null) continue;
    const n = typeof v === "string" ? parseFloat(v.trim()) : Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export type RoomFinderPolygonPoint = { x: number; y: number };

export type RoomFinderRoomRow = {
  area_m2: number;
  center: RoomFinderPolygonPoint;
  confidence?: number;
  polygon: RoomFinderPolygonPoint[];
};

export type RoomFinderApiResponse = {
  success?: boolean;
  mode?: string;
  /** Primary list of detected rooms */
  rooms?: RoomFinderRoomRow[];
  /** Some backends mirror room rows under `dimensions` */
  dimensions?: RoomFinderRoomRow[];
  total_area_m2?: number;
  total_rooms?: number;
};

export type AnalyzeRoomsRequest = {
  job_id: string;
  file_path: string;
  roi: AutoCountRoi;
  pixel_to_meter: number;
  confidence: number;
};

export function pickRoomRowsFromResponse(
  response: RoomFinderApiResponse
): RoomFinderRoomRow[] {
  const r = response as unknown as Record<string, unknown>;
  const nests: unknown[] = [
    response.rooms,
    response.dimensions,
    r.Rooms,
    r.room_list,
  ];
  for (const c of nests) {
    if (Array.isArray(c) && c.length > 0) return c as RoomFinderRoomRow[];
  }
  return [];
}

export async function postAnalyzeRooms(
  payload: AnalyzeRoomsRequest
): Promise<RoomFinderApiResponse> {
  const config: RoomFinderRequestConfig = { skipGlobalLoader: true };
  const { data } = await autoCountClient.post<RoomFinderApiResponse>(
    "/analyze_rooms",
    {
      job_id: payload.job_id,
      file_path: toAutoCountApiFilePath(payload.file_path),
      roi: payload.roi,
      pixel_to_meter: payload.pixel_to_meter,
      confidence: payload.confidence,
    },
    config
  );
  return data;
}
