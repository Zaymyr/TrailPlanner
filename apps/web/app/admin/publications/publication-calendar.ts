import { utcToParisLocal, type PublicSocialPost } from "../../../lib/social-posts";

/** The date a post sits on in the calendar: its publication, or its scheduled time; drafts have none. */
export const getCalendarTime = (post: Pick<PublicSocialPost, "status" | "publishedAt" | "scheduledAt">) => {
  if (post.status === "published") return post.publishedAt;
  if (post.status === "scheduled" || post.status === "publishing") return post.scheduledAt;
  return null;
};

/** "YYYY-MM-DD" of an instant in Europe/Paris. */
export const toParisDay = (iso: string) => utcToParisLocal(iso).slice(0, 10);

export type CalendarDay<T> = { day: string; inMonth: boolean; posts: T[] };

const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/**
 * Month grid (weeks start on Monday, French style) with the posts of each Paris day, in time order.
 * `month` is 1-12. Days of the neighbouring months fill the first and last weeks.
 */
export const buildMonthGrid = <T extends Pick<PublicSocialPost, "status" | "publishedAt" | "scheduledAt">>(
  year: number,
  month: number,
  posts: T[],
): CalendarDay<T>[][] => {
  const byDay = new Map<string, Array<{ post: T; time: string }>>();
  for (const post of posts) {
    const time = getCalendarTime(post);
    if (!time) continue;
    const key = toParisDay(time);
    byDay.set(key, [...(byDay.get(key) ?? []), { post, time }]);
  }
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, month - 1, 1 - offset));
  const weeks: CalendarDay<T>[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay<T>[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = new Date(start.getTime() + (week * 7 + weekday) * 86_400_000);
      const key = dayKey(date);
      days.push({
        day: key,
        inMonth: date.getUTCMonth() === month - 1,
        posts: (byDay.get(key) ?? []).sort((left, right) => left.time.localeCompare(right.time)).map((entry) => entry.post),
      });
    }
    // A sixth week made only of next-month days is dropped.
    if (week === 5 && !days.some((day) => day.inMonth)) break;
    weeks.push(days);
  }
  return weeks;
};

/** Year and month (1-12) of today in Paris. */
export const currentParisMonth = (now = new Date()) => {
  const [year, month] = toParisDay(now.toISOString()).split("-").map(Number);
  return { year, month };
};

export const shiftMonth = ({ year, month }: { year: number; month: number }, delta: number) => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

export const formatMonthTitle = ({ year, month }: { year: number; month: number }) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
