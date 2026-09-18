import { toast } from "@/hooks/use-toast";

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.replace(/^Error:\s*/i, "").trim() || "An unknown error occurred.";
}

export function showLoginSuccess(method = "Discord") {
  toast({
    title: "Login successful",
    description: `${method} is connected. Your Opti Gods session is ready.`,
    variant: "success",
  });
}

export function showLoginError(error: unknown, method = "Discord") {
  const message = cleanError(error);
  const timedOut = /timed?\s*out|timeout|90 seconds/i.test(message);
  toast({
    title: timedOut ? `${method} login timed out` : `${method} login failed`,
    description: timedOut
      ? "The login was not completed in time. Close the browser tab and try again."
      : message,
    variant: "destructive",
  });
  return message;
}

export function showAccessCodeSuccess() {
  toast({
    title: "Code accepted",
    description: "Your Opti Gods access is ready.",
    variant: "success",
  });
}

export function showAccessCodeError(message: string) {
  toast({
    title: "Code verification failed",
    description: message,
    variant: "destructive",
  });
}