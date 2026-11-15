let pendingDeepLink: string | null = null;

export function setPendingDeepLink(href: string) {
  pendingDeepLink = href;
}

export function consumePendingDeepLink() {
  const href = pendingDeepLink;
  pendingDeepLink = null;
  return href;
}
