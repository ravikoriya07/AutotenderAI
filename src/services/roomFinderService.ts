import { autoCountClient } from "@/lib/autoCountClient";
import type { AxiosRequestConfig } from "axios";
import type { AutoCountRoi } from "@/services/autoCountService";
import { toAutoCountApiFilePath } from "@/services/autoCountService";

type RoomFinderRequestConfig = AxiosRequestConfig & {
  skipGlobalLoader?: boolean;
};

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
