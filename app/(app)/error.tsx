"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. This has been logged and we will look
            into it. You can try again or navigate to another page.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={reset} className="h-11 w-full">
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
