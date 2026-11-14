// 展签 for each achievement: 150–250 characters, every fact traceable (member museums' data/museums/*.yaml
// or well-documented history). Written in Task 3.
import { ACHIEVEMENTS } from "./achievements"
export const ACHIEVEMENT_LABELS: Record<string, string> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, ""]))
