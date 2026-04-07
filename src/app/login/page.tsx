"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AppFooter } from "@/components/layout/AppFooter";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4 pb-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Log in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your username and password to continue.
            </p>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
      <AppFooter />
    </div>
  );
}
