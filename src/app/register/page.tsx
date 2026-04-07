"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { AppFooter } from "@/components/layout/AppFooter";
import { RegisterForm } from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4 pb-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your details to get started.
            </p>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
      <AppFooter />
    </div>
  );
}
