import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to PM&R Flashcards</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your study dashboard will appear here with review stats, upcoming
            cards, and progress tracking. Start by browsing the card library or
            jumping into a review session.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
