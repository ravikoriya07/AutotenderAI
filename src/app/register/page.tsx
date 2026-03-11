"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your details to get started.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="register-first-name"
                  className="text-sm font-medium text-foreground"
                >
                  First Name
                </label>
                <Input
                  id="register-first-name"
                  type="text"
                  placeholder="John"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="register-last-name"
                  className="text-sm font-medium text-foreground"
                >
                  Last Name
                </label>
                <Input
                  id="register-last-name"
                  type="text"
                  placeholder="Doe"
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="register-email"
                className="text-sm font-medium text-foreground"
              >
                Email
              </label>
              <Input
                id="register-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="register-phone"
                className="text-sm font-medium text-foreground"
              >
                Phone Number
              </label>
              <Input
                id="register-phone"
                type="tel"
                placeholder="+1 234 567 8900"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="register-password"
                className="text-sm font-medium text-foreground"
              >
                Password
              </label>
              <Input
                id="register-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="register-confirm-password"
                className="text-sm font-medium text-foreground"
              >
                Confirm Password
              </label>
              <Input
                id="register-confirm-password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Register
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
