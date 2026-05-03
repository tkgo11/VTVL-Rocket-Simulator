import { pgTable, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomTypeEnum = pgEnum("room_type", ["coop", "versus"]);
export const roomStatusEnum = pgEnum("room_status", ["lobby", "in_progress", "ended"]);
export const participantRoleEnum = pgEnum("participant_role", ["player", "spectator"]);

// ---- Users ----
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ---- Rooms ----
export const roomsTable = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: roomTypeEnum("type").notNull(),
  missionId: text("mission_id").notNull(),
  status: roomStatusEnum("status").notNull().default("lobby"),
  hostId: text("host_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ createdAt: true, endedAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;

// ---- Runs ----
export const runsTable = pgTable("runs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  guestName: text("guest_name"),
  missionId: text("mission_id").notNull(),
  score: integer("score").notNull(),
  grade: text("grade").notNull(),
  crashed: boolean("crashed").notNull().default(false),
  touchdownSpeed: real("touchdown_speed"),
  padDeviation: real("pad_deviation"),
  fuelRemaining: real("fuel_remaining"),
  tiltDeg: real("tilt_deg"),
  flightDuration: real("flight_duration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRunSchema = createInsertSchema(runsTable).omit({ createdAt: true });
export type InsertRun = z.infer<typeof insertRunSchema>;
export type Run = typeof runsTable.$inferSelect;

// ---- Leaderboard ----
export const leaderboardTable = pgTable("leaderboard_entries", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => runsTable.id),
  userId: text("user_id"),
  displayName: text("display_name").notNull(),
  missionId: text("mission_id").notNull(),
  score: integer("score").notNull(),
  grade: text("grade").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaderboardSchema = createInsertSchema(leaderboardTable).omit({ createdAt: true });
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type LeaderboardEntry = typeof leaderboardTable.$inferSelect;
