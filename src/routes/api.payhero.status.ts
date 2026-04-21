import { createFileRoute } from "@tanstack/react-router";

const BASE = "https://backend.payhero.co.ke/api/v2";

declare global {
  // eslint-disable-next-line no-var
  var __payheroStatus: Map<string, { status: string; message?: string; purpose?: string; userPhone?: string }> | undefined;
}
if (!globalThis.__payheroStatus) globalThis.__payheroStatus = new Map();

export const Route = createFileRoute("/api/payhero/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const reference = url.searchParams.get("reference");
        if (!reference) {
          return Response.json({ status: "ERROR", message: "Missing reference" }, { status: 400 });
        }

        // Check cached callback result first
        const cached = globalThis.__payheroStatus!.get(reference);
        if (cached && (cached.status === "SUCCESS" || cached.status === "FAILED" || cached.status === "CANCELLED")) {
          return Response.json({ status: cached.status, message: cached.message });
        }

        // Otherwise query PayHero directly
        try {
          const auth = process.env.PAYHERO_AUTH_TOKEN;
          const res = await fetch(
            `${BASE}/transaction-status?reference=${encodeURIComponent(reference)}`,
            { headers: auth ? { Authorization: auth } : {} },
          );
          const data = (await res.json()) as { status?: string; success?: boolean };
          let mapped = "PENDING";
          const s = (data.status || "").toUpperCase();
          if (s === "SUCCESS" || data.success === true) mapped = "SUCCESS";
          else if (s === "FAILED" || s === "CANCELLED") mapped = s;

          if (mapped !== "PENDING") {
            const prev = globalThis.__payheroStatus!.get(reference) || { status: mapped };
            globalThis.__payheroStatus!.set(reference, { ...prev, status: mapped });
          }
          return Response.json({ status: mapped });
        } catch (e) {
          return Response.json({
            status: "PENDING",
            message: e instanceof Error ? e.message : "Could not fetch status",
          });
        }
      },
    },
  },
});
