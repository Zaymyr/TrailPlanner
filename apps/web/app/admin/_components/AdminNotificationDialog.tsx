"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export type AdminNotificationFormValue = {
  notificationId: string;
  title: string;
  body: string;
  sendEmail: boolean;
  sendPush: boolean;
};

export function AdminNotificationDialog({
  open,
  recipient,
  initialTitle = "",
  initialBody = "",
  submitLabel = "Envoyer le message",
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  recipient: string;
  initialTitle?: string;
  initialBody?: string;
  submitLabel?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: AdminNotificationFormValue) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [sendEmail, setSendEmail] = useState(false);
  const [sendPush, setSendPush] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationId, setNotificationId] = useState(() => open ? crypto.randomUUID() : "");
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open && !wasOpenRef.current) setNotificationId(crypto.randomUUID());
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setBody(initialBody);
    setSendEmail(false);
    setSendPush(false);
    setError(null);
  }, [initialBody, initialTitle, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Le titre et le message sont obligatoires.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ notificationId, title: title.trim(), body: body.trim(), sendEmail, sendPush });
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’envoyer le message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notifier un utilisateur</DialogTitle>
          <DialogDescription>Destinataire : {recipient || "Utilisateur sans e-mail"}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="admin-notification-title">Titre</Label>
            <Input
              id="admin-notification-title"
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-notification-body">Message</Label>
            <textarea
              id="admin-notification-body"
              className="min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={4000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={submitting}
            />
          </div>
          <fieldset className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-semibold">Canaux</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled />
              Notification dans l’application (obligatoire)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                disabled={submitting}
              />
              E-mail via Resend
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendPush}
                onChange={(event) => setSendPush(event.target.checked)}
                disabled={submitting}
              />
              Notification push
            </label>
          </fieldset>
          {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Envoi…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
