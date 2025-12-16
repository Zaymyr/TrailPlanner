import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

export default function SignUpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-lg border border-slate-800 bg-slate-950/60 p-6 shadow-lg">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">Sign up</h1>
        <p className="text-slate-300">
          Create your Trailplanner account to start organizing your race day fueling.
        </p>
      </div>

      <form className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" type="text" required placeholder="Alex Runner" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="••••••••"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="••••••••"
          />
        </div>

        <Button type="submit">Create account</Button>
      </form>

      <p className="text-xs text-slate-500">
        Note: Authentication flow will be wired to Supabase in a future update.
      </p>
    </div>
  );
}
