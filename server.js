import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SERVICE_ROLE_KEY || "";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add JSON body parsing middleware
  app.use(express.json());

  // Initialize Supabase admin client
  const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

  // Add health check API endpoint first
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // MFA Reset endpoint for administrators
  app.post("/api/admin/reset-mfa", async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // List all MFA factors for the user
      const { data: factorsData, error: listError } =
        await supabaseAdmin.auth.admin.mfa.listFactors({
          userId,
        });

      if (listError) {
        console.error("Error listing MFA factors:", listError);
        if (process.env.NODE_ENV === "production") {
          return res.status(500).json({ error: "Failed to list MFA factors" });
        } else {
          return res.status(500).json({
            error: "Failed to list MFA factors",
            details: listError.message,
          });
        }
      }

      // Delete each MFA factor
      const factors = factorsData?.factors || [];
      if (factors.length > 0) {
        for (const factor of factors) {
          const { error: deleteError } =
            await supabaseAdmin.auth.admin.mfa.deleteFactor({
              id: factor.id,
              userId,
            });

          if (deleteError) {
            console.error(
              `Error deleting MFA factor ${factor.id}:`,
              deleteError,
            );
            if (process.env.NODE_ENV === "production") {
              return res
                .status(500)
                .json({ error: `Failed to delete MFA factor` });
            } else {
              return res.status(500).json({
                error: `Failed to delete MFA factor`,
                details: deleteError.message,
              });
            }
          }
        }
      }

      res.json({ success: true, message: "MFA factors reset successfully" });
    } catch (err) {
      console.error("Error in reset-mfa endpoint:", err);
      if (process.env.NODE_ENV === "production") {
        res.status(500).json({ error: "Internal server error" });
      } else {
        res
          .status(500)
          .json({ error: "Internal server error", details: err.message });
      }
    }
  });

  // Vite middleware for development fallback
  if (process.env.NODE_ENV !== "production") {
    console.log(
      "Starting full-stack server in Development Mode (Vite Middleware active)...",
    );
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(
      "Starting full-stack server in Production Mode (Static Distribution active)...",
    );
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
