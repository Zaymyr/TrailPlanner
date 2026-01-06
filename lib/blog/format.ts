const blogDateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export const formatBlogDate = (isoDate: string): string => blogDateFormatter.format(new Date(isoDate));
