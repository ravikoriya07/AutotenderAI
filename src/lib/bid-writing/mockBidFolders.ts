import type { LibraryFolderOption } from "./types";

/** Mock `/api/folders` until wired to Qdrant. */
export const MOCK_LIBRARY_FOLDERS: LibraryFolderOption[] = [
  { name: "6. HARINGEY HCBS VOIDS - 17 JULY 2023", count: 412 },
  { name: "9. NOTTING HILL GENESIS - KITCHENS AND BATHROOMS FRAMEWORK - 7 AUGUST 2023", count: 389 },
  { name: "15. HARINGEY  REPAIRS & DISREPAIRS 9 NOVEMBER 2023", count: 501 },
  { name: "22. EXAMPLE RETROFIT WAVE 2 - FEB 2024", count: 276 },
  { name: "31. REGIONAL HA KITCHENS - JUNE 2024", count: 198 },
  { name: "44. TOWN COUNCIL CIVIC - JAN 2025", count: 143 },
];
