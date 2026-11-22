const blogDateFormatters = {
  fr: new Intl.DateTimeFormat("fr-FR", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  en: new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
};

export const formatBlogDate = (isoDate: string, locale: "fr" | "en" = "fr"): string =>
  blogDateFormatters[locale].format(new Date(isoDate));
