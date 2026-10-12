import type { Module } from "@idosgames/module-sdk";
import { leaderboardModule } from "./modules/leaderboard";
import { solMassModule } from "./modules/sol-mass";

export const modules: Module[] = [solMassModule, leaderboardModule];
