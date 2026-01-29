import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center py-20 bg-background px-4">
      <div className="w-full max-w-5xl mb-8">
        <Link
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          href="/"
        >
          <ArrowLeftIcon className="size-4" />
          Back to Chat
        </Link>
      </div>

      <div className="mb-12 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
          Upgrade your experience
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that best fits your needs. Unlock more power, speed,
          and capabilities.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 w-full max-w-5xl items-start">
        {/* FREE Plan */}
        <Card className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-border transition-colors">
          <CardHeader>
            <CardTitle className="text-2xl">Free</CardTitle>
            <CardDescription>Essential features for everyone.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-4xl font-bold mb-6">
              $0
              <span className="text-lg font-normal text-muted-foreground">
                /mo
              </span>
            </div>
            <ul className="space-y-3">
              <FeatureItem>Basic chat access</FeatureItem>
              <FeatureItem>Standard response speed</FeatureItem>
              <FeatureItem>Daily message limits</FeatureItem>
              <FeatureItem>Community support</FeatureItem>
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              asChild
              className="w-full h-10 rounded-full"
              variant="outline"
            >
              <Link href="/">Get Started</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* BETA Plan */}
        <Card className="flex flex-col h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Beta</CardTitle>
            <CardDescription>Early access to new features.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-4xl font-bold mb-6">
              $15
              <span className="text-lg font-normal text-muted-foreground">
                /mo
              </span>
            </div>
            <ul className="space-y-3">
              <FeatureItem>Everything in Free</FeatureItem>
              <FeatureItem>Priority access to new models</FeatureItem>
              <FeatureItem>Faster response times</FeatureItem>
              <FeatureItem>Increased limits</FeatureItem>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Subscribe to Beta
            </Button>
          </CardFooter>
        </Card>

        {/* PRO Plan */}
        <Card className="flex flex-col h-full bg-card relative overflow-hidden border-primary/50 shadow-xl scale-105 z-10">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-orange-400" />
          <CardHeader>
            <CardTitle className="text-2xl">Pro</CardTitle>
            <CardDescription>Maximum power and speed.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-4xl font-bold mb-6">
              $25
              <span className="text-lg font-normal text-muted-foreground">
                /mo
              </span>
            </div>
            <ul className="space-y-3">
              <FeatureItem>Unlimited messages</FeatureItem>
              <FeatureItem>Access to most reasoning models</FeatureItem>
              <FeatureItem>Fastest generation speed</FeatureItem>
              <FeatureItem>Priority support</FeatureItem>
              <FeatureItem>Early access to features</FeatureItem>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full h-10 rounded-full bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white shadow-md">
              Go Pro
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckIcon className="size-4 text-primary shrink-0" />
      <span>{children}</span>
    </li>
  );
}
